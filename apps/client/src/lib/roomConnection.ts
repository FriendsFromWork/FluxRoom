import {
  ServerToClientSchema,
  DataChannelMessageSchema,
  encodeChunk,
  decodeChunk,
  type ClientToServer,
  type SignalData,
  type FileMeta,
  type PeerInfo,
  type DataChannelMessage,
} from '@fluxroom/shared';
import { Emitter } from './emitter';
import { getRtcConfig } from './rtcConfig';
import { chunksFromFile } from './fileChunks';
import type { FeedItem, RoomPeer } from '@/types/feed';

interface PeerRecord {
  id: string;
  name: string;
  avatarId: number;
  pc: RTCPeerConnection;
  dc: RTCDataChannel | null;
  remoteDescSet: boolean;
  pendingCandidates: RTCIceCandidateInit[];
}

interface IncomingFile {
  meta: FileMeta;
  peerId: string;
  chunks: ArrayBuffer[];
  receivedBytes: number;
}

type RoomConnectionEvents = {
  'self-joined': { selfId: string; selfName: string; roomName: string };
  'peer-update': RoomPeer;
  'peer-removed': { id: string };
  'feed-item': FeedItem;
  'feed-item-update': Partial<FeedItem> & { id: string };
  error: { message: string };
  'socket-closed': void;
};

const DATA_CHANNEL_LABEL = 'fluxroom';
const JOIN_TIMEOUT_MS = 10_000;

function randomId(): string {
  return crypto.randomUUID();
}

export class RoomConnection extends Emitter<RoomConnectionEvents> {
  private ws: WebSocket | null = null;
  private selfName = '';
  private selfAvatarId = 1;
  private joinTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private readonly peers = new Map<string, PeerRecord>();
  private readonly incoming = new Map<string, IncomingFile>();
  private readonly blobUrls = new Set<string>();

  connect(signalingUrl: string, room: string, name: string, avatarId: number): void {
    this.selfName = name;
    this.selfAvatarId = avatarId;

    const ws = new WebSocket(signalingUrl);
    this.ws = ws;

    this.joinTimeoutId = setTimeout(() => {
      this.emit('error', { message: 'Timed out connecting to the room. The signaling server may be waking up — try again in a few seconds.' });
      ws.close();
    }, JOIN_TIMEOUT_MS);

    ws.addEventListener('open', () => {
      this.sendToServer({ type: 'join', room, name, avatarId });
    });

    ws.addEventListener('message', (event) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(event.data as string);
      } catch {
        return;
      }
      const result = ServerToClientSchema.safeParse(parsed);
      if (!result.success) return;
      this.handleServerMessage(result.data);
    });

    ws.addEventListener('close', () => {
      this.clearJoinTimeout();
      this.emit('socket-closed', undefined);
    });

    ws.addEventListener('error', () => {
      this.clearJoinTimeout();
      this.emit('error', { message: 'Could not reach the signaling server.' });
    });
  }

  disconnect(): void {
    this.clearJoinTimeout();
    this.ws?.close();
    this.ws = null;
    for (const peer of this.peers.values()) {
      peer.dc?.close();
      peer.pc.close();
    }
    this.peers.clear();
    this.incoming.clear();
    for (const url of this.blobUrls) {
      URL.revokeObjectURL(url);
    }
    this.blobUrls.clear();
  }

  private clearJoinTimeout(): void {
    if (this.joinTimeoutId !== null) {
      clearTimeout(this.joinTimeoutId);
      this.joinTimeoutId = null;
    }
  }

  // ---- outgoing content ----

  sendChat(text: string): void {
    const item: FeedItem = {
      kind: 'chat',
      id: randomId(),
      from: this.selfName,
      avatarId: this.selfAvatarId,
      self: true,
      text,
      ts: Date.now(),
    };
    this.broadcast({ type: 'chat', id: item.id, from: this.selfName, avatarId: this.selfAvatarId, text, ts: item.ts });
    this.emit('feed-item', item);
  }

  sendText(content: string): void {
    const item: FeedItem = {
      kind: 'text',
      id: randomId(),
      from: this.selfName,
      avatarId: this.selfAvatarId,
      self: true,
      content,
      ts: Date.now(),
    };
    this.broadcast({ type: 'text', id: item.id, from: this.selfName, avatarId: this.selfAvatarId, content, ts: item.ts });
    this.emit('feed-item', item);
  }

  sendCode(lang: string, content: string): void {
    const item: FeedItem = {
      kind: 'code',
      id: randomId(),
      from: this.selfName,
      avatarId: this.selfAvatarId,
      self: true,
      lang,
      content,
      ts: Date.now(),
    };
    this.broadcast({
      type: 'code',
      id: item.id,
      from: this.selfName,
      avatarId: this.selfAvatarId,
      lang,
      content,
      ts: item.ts,
    });
    this.emit('feed-item', item);
  }

  async sendFile(file: File): Promise<void> {
    const id = randomId();
    const ts = Date.now();
    const targets = Array.from(this.peers.values()).filter((p) => p.dc?.readyState === 'open');

    const selfBlobUrl = URL.createObjectURL(file);
    this.blobUrls.add(selfBlobUrl);

    const item: FeedItem = {
      kind: 'file',
      id,
      from: this.selfName,
      avatarId: this.selfAvatarId,
      self: true,
      name: file.name,
      size: file.size,
      mime: file.type || 'application/octet-stream',
      ts,
      status: 'transferring',
      progress: file.size === 0 ? 1 : 0,
      blobUrl: selfBlobUrl,
    };
    this.emit('feed-item', item);

    this.broadcast({
      type: 'file-meta',
      id,
      from: this.selfName,
      avatarId: this.selfAvatarId,
      name: file.name,
      size: file.size,
      mime: item.mime,
      ts,
    });

    let sentBytes = 0;
    let seq = 0;
    for await (const chunk of chunksFromFile(file)) {
      const framed = encodeChunk(id, seq, chunk);
      await Promise.all(targets.map((peer) => this.sendBinaryWithBackpressure(peer, framed)));
      sentBytes += chunk.byteLength;
      seq += 1;

      const progress = file.size === 0 ? 1 : Math.min(1, sentBytes / file.size);
      this.emit('feed-item-update', { id, progress });
    }

    this.broadcast({ type: 'file-done', id, from: this.selfName, ts: Date.now() });
    this.emit('feed-item-update', { id, status: 'done', progress: 1 });
  }

  // ---- signaling ----

  private sendToServer(message: ClientToServer): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private sendSignal(to: string, data: SignalData): void {
    this.sendToServer({ type: 'signal', to, data });
  }

  private handleServerMessage(message: ReturnType<typeof ServerToClientSchema.parse>): void {
    switch (message.type) {
      case 'room-state': {
        this.clearJoinTimeout();
        // The server may have de-duplicated our requested name — adopt its answer as the
        // name we sign our own outgoing messages with, so it matches what peers see in their roster.
        this.selfName = message.selfName;
        this.emit('self-joined', { selfId: message.selfId, selfName: message.selfName, roomName: message.room });
        for (const peer of message.peers) {
          // We are the newcomer: wait for each existing peer's offer rather than racing them.
          this.registerPeer(peer, false);
        }
        break;
      }
      case 'peer-joined': {
        // We are already in the room: we initiate the connection to the newcomer.
        this.registerPeer(message.peer, true);
        break;
      }
      case 'peer-left': {
        const peer = this.peers.get(message.id);
        if (peer) {
          peer.dc?.close();
          peer.pc.close();
          this.peers.delete(message.id);
          this.emit('peer-removed', { id: message.id });
          this.emit('feed-item', {
            kind: 'system',
            id: randomId(),
            text: `${peer.name} left the room`,
            ts: Date.now(),
          });
          this.failIncomingTransfersFrom(message.id);
        }
        break;
      }
      case 'signal': {
        void this.handleSignal(message.from, message.data);
        break;
      }
      case 'error': {
        this.emit('error', { message: message.message });
        break;
      }
    }
  }

  /** Marks any in-progress file receives from a peer as failed once they disconnect, instead of leaving a frozen progress bar. */
  private failIncomingTransfersFrom(peerId: string): void {
    for (const [fileId, incoming] of this.incoming) {
      if (incoming.peerId !== peerId) continue;
      this.incoming.delete(fileId);
      this.emit('feed-item-update', { id: fileId, status: 'failed' });
    }
  }

  private registerPeer(info: PeerInfo, isOfferer: boolean): void {
    if (this.peers.has(info.id)) return;

    const pc = new RTCPeerConnection(getRtcConfig());
    const record: PeerRecord = {
      id: info.id,
      name: info.name,
      avatarId: info.avatarId,
      pc,
      dc: null,
      remoteDescSet: false,
      pendingCandidates: [],
    };
    this.peers.set(info.id, record);

    this.emit('peer-update', { id: info.id, name: info.name, avatarId: info.avatarId, status: 'connecting' });

    pc.addEventListener('icecandidate', (event) => {
      if (!event.candidate) return;
      this.sendSignal(info.id, {
        kind: 'ice-candidate',
        candidate: event.candidate.candidate,
        sdpMid: event.candidate.sdpMid,
        sdpMLineIndex: event.candidate.sdpMLineIndex,
      });
    });

    pc.addEventListener('connectionstatechange', () => {
      if (pc.connectionState === 'connected') {
        this.emit('peer-update', { id: info.id, name: info.name, avatarId: info.avatarId, status: 'connected' });
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        this.emit('peer-update', { id: info.id, name: info.name, avatarId: info.avatarId, status: 'disconnected' });
      }
    });

    pc.addEventListener('datachannel', (event) => {
      this.wireDataChannel(record, event.channel);
    });

    if (isOfferer) {
      const dc = pc.createDataChannel(DATA_CHANNEL_LABEL, { ordered: true });
      this.wireDataChannel(record, dc);

      void pc
        .createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          const sdp = pc.localDescription?.sdp;
          if (sdp) this.sendSignal(info.id, { kind: 'offer', sdp });
        });
    }
  }

  private async handleSignal(from: string, data: SignalData): Promise<void> {
    let peer = this.peers.get(from);

    if (data.kind === 'offer') {
      if (!peer) {
        // Peer connection wasn't created yet (offer arrived before room-state peer list) — create as answerer.
        this.registerPeer({ id: from, name: 'Peer', avatarId: 1 }, false);
        peer = this.peers.get(from);
      }
      if (!peer) return;

      await peer.pc.setRemoteDescription({ type: 'offer', sdp: data.sdp });
      peer.remoteDescSet = true;
      await this.flushPendingCandidates(peer);

      const answer = await peer.pc.createAnswer();
      await peer.pc.setLocalDescription(answer);
      const sdp = peer.pc.localDescription?.sdp;
      if (sdp) this.sendSignal(from, { kind: 'answer', sdp });
      return;
    }

    if (!peer) return;

    if (data.kind === 'answer') {
      await peer.pc.setRemoteDescription({ type: 'answer', sdp: data.sdp });
      peer.remoteDescSet = true;
      await this.flushPendingCandidates(peer);
      return;
    }

    if (data.kind === 'ice-candidate') {
      const candidate: RTCIceCandidateInit = {
        candidate: data.candidate,
        sdpMid: data.sdpMid ?? undefined,
        sdpMLineIndex: data.sdpMLineIndex ?? undefined,
      };
      if (peer.remoteDescSet) {
        await peer.pc.addIceCandidate(candidate);
      } else {
        peer.pendingCandidates.push(candidate);
      }
    }
  }

  private async flushPendingCandidates(peer: PeerRecord): Promise<void> {
    const queued = peer.pendingCandidates;
    peer.pendingCandidates = [];
    for (const candidate of queued) {
      await peer.pc.addIceCandidate(candidate);
    }
  }

  // ---- data channel ----

  private wireDataChannel(peer: PeerRecord, dc: RTCDataChannel): void {
    peer.dc = dc;
    dc.binaryType = 'arraybuffer';

    dc.addEventListener('open', () => {
      this.emit('peer-update', { id: peer.id, name: peer.name, avatarId: peer.avatarId, status: 'connected' });
    });

    dc.addEventListener('close', () => {
      this.emit('peer-update', { id: peer.id, name: peer.name, avatarId: peer.avatarId, status: 'disconnected' });
    });

    dc.addEventListener('message', (event) => {
      if (typeof event.data === 'string') {
        this.handleControlMessage(peer.id, event.data);
      } else if (event.data instanceof ArrayBuffer) {
        this.handleBinaryChunk(event.data);
      }
    });
  }

  private handleControlMessage(peerId: string, raw: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    const result = DataChannelMessageSchema.safeParse(parsed);
    if (!result.success) return;
    const message = result.data;

    if (message.type === 'chat') {
      this.emit('feed-item', {
        kind: 'chat',
        id: message.id,
        from: message.from,
        avatarId: message.avatarId,
        self: false,
        text: message.text,
        ts: message.ts,
      });
      return;
    }
    if (message.type === 'text') {
      this.emit('feed-item', {
        kind: 'text',
        id: message.id,
        from: message.from,
        avatarId: message.avatarId,
        self: false,
        content: message.content,
        ts: message.ts,
      });
      return;
    }
    if (message.type === 'code') {
      this.emit('feed-item', {
        kind: 'code',
        id: message.id,
        from: message.from,
        avatarId: message.avatarId,
        self: false,
        lang: message.lang,
        content: message.content,
        ts: message.ts,
      });
      return;
    }
    if (message.type === 'file-meta') {
      this.incoming.set(message.id, { meta: message, peerId, chunks: [], receivedBytes: 0 });
      this.emit('feed-item', {
        kind: 'file',
        id: message.id,
        from: message.from,
        avatarId: message.avatarId,
        self: false,
        name: message.name,
        size: message.size,
        mime: message.mime,
        ts: message.ts,
        status: 'transferring',
        progress: message.size === 0 ? 1 : 0,
      });
      return;
    }
    if (message.type === 'file-done') {
      const incoming = this.incoming.get(message.id);
      if (!incoming) return;
      const blob = new Blob(incoming.chunks, { type: incoming.meta.mime });
      const blobUrl = URL.createObjectURL(blob);
      this.blobUrls.add(blobUrl);
      this.incoming.delete(message.id);
      this.emit('feed-item-update', { id: message.id, status: 'done', progress: 1, blobUrl });
    }
  }

  private handleBinaryChunk(buffer: ArrayBuffer): void {
    const { fileId, seq, bytes } = decodeChunk(buffer);
    const incoming = this.incoming.get(fileId);
    if (!incoming) return;

    incoming.chunks[seq] = bytes;
    incoming.receivedBytes += bytes.byteLength;

    const progress = incoming.meta.size === 0 ? 1 : Math.min(1, incoming.receivedBytes / incoming.meta.size);
    this.emit('feed-item-update', { id: fileId, progress });
  }

  private broadcast(message: DataChannelMessage): void {
    const payload = JSON.stringify(message);
    for (const peer of this.peers.values()) {
      if (peer.dc?.readyState === 'open') {
        peer.dc.send(payload);
      }
    }
  }

  private sendBinaryWithBackpressure(peer: PeerRecord, data: ArrayBuffer): Promise<void> {
    const dc = peer.dc;
    if (!dc || dc.readyState !== 'open') return Promise.resolve();

    const LOW_THRESHOLD = 1 * 1024 * 1024;
    dc.bufferedAmountLowThreshold = LOW_THRESHOLD;

    if (dc.bufferedAmount <= LOW_THRESHOLD) {
      dc.send(data);
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const onLow = () => {
        dc.removeEventListener('bufferedamountlow', onLow);
        dc.send(data);
        resolve();
      };
      dc.addEventListener('bufferedamountlow', onLow);
    });
  }
}
