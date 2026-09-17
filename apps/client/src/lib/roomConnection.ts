import {
  ServerToClientSchema,
  DataChannelMessageSchema,
  encodeChunk,
  decodeChunk,
  BUFFERED_AMOUNT_LOW_THRESHOLD,
  RelayKind,
  encodeRelayFrame,
  decodeRelayFrame,
  encodeAck,
  decodeAck,
  encodeRelayText,
  decodeRelayText,
  type ClientToServer,
  type ServerToClient,
  type SignalData,
  type FileMeta,
  type PeerInfo,
  type DataChannelMessage,
} from '@fluxroom/shared';
import { Emitter } from './emitter';
import { buildRtcConfig, fetchIceServers } from './rtcConfig';
import { chunksFromFile } from './fileChunks';
import type { FeedItem, PeerStatus, RoomPeer } from '@/types/feed';

/** How bytes reach a peer: a direct WebRTC data channel, or relayed through the signaling server. */
type Transport = 'direct' | 'relay';

interface PeerRecord {
  id: string;
  name: string;
  avatarId: number;
  pc: RTCPeerConnection;
  dc: RTCDataChannel | null;
  isOfferer: boolean;
  remoteDescSet: boolean;
  pendingCandidates: RTCIceCandidateInit[];
  iceRestarts: number;
  /** Set once a direct connection has failed or timed out at least once. */
  directFailed: boolean;
  connectTimeoutId: ReturnType<typeof setTimeout> | null;
  /** Aborted when the peer is torn down, so in-flight sends waiting on backpressure never hang. */
  abort: AbortController;
  relaySentBytes: number;
  relayAckedBytes: number;
  relayReceivedBytes: number;
  relayLastAckSent: number;
  relayWaiters: Set<() => void>;
}

interface IncomingFile {
  meta: FileMeta;
  peerId: string;
  via: Transport;
  chunks: ArrayBuffer[];
  receivedBytes: number;
  lastEmittedProgress: number;
}

export type RoomConnectionEvents = {
  'self-joined': { selfId: string; selfName: string; roomName: string; relay: boolean };
  'peer-update': RoomPeer;
  'peer-removed': { id: string };
  'feed-item': FeedItem;
  'feed-item-update': Partial<FeedItem> & { id: string };
  /** The signaling socket dropped (or never connected) and a retry is scheduled. */
  reconnecting: { attempt: number };
  /** Unrecoverable — no further reconnect attempts will be made. */
  error: { message: string };
};

export interface RoomConnectionOptions {
  keepaliveIntervalMs?: number;
  pongTimeoutMs?: number;
  joinTimeoutMs?: number;
  reconnectBaseDelayMs?: number;
  reconnectMaxDelayMs?: number;
  peerConnectTimeoutMs?: number;
  iceFetchTimeoutMs?: number;
  /** Creates each peer connection; defaults to the browser's RTCPeerConnection. */
  createPeerConnection?: (config: RTCConfiguration) => RTCPeerConnection;
}

const DEFAULT_OPTIONS: Required<RoomConnectionOptions> = {
  // Sent as a regular JSON message, not a WebSocket ping frame: some reverse proxies
  // (e.g. Cloudflare in front of Render) don't reliably relay control frames.
  keepaliveIntervalMs: 20_000,
  pongTimeoutMs: 10_000,
  // Generous: a free-tier server can take a while to wake from sleep.
  joinTimeoutMs: 20_000,
  reconnectBaseDelayMs: 1_000,
  reconnectMaxDelayMs: 10_000,
  // After this long without a direct link, the peer is shown as relayed (traffic already flows via the server).
  peerConnectTimeoutMs: 10_000,
  iceFetchTimeoutMs: 8_000,
  createPeerConnection: (config) => new RTCPeerConnection(config),
};

const DATA_CHANNEL_LABEL = 'fluxroom';
const MAX_ICE_RESTARTS = 2;
/** Progress events are throttled to whole-percent steps so large files don't re-render the feed thousands of times. */
const PROGRESS_STEP = 0.01;
/** Relayed file bytes the sender may have in flight before waiting for the receiver's ack. */
const RELAY_WINDOW_BYTES = 1024 * 1024;
/** The receiver acks after this many relayed bytes. Must be smaller than the window, or transfers deadlock. */
const RELAY_ACK_EVERY_BYTES = 256 * 1024;
/** Pause relayed file sends while the browser's own socket send buffer is this full. */
const RELAY_SOCKET_BUFFER_LIMIT = 2 * 1024 * 1024;
/** WebSocket has no "buffer drained" event, so a waiting relayed send re-checks on this interval. */
const RELAY_POLL_MS = 50;

function randomId(): string {
  return crypto.randomUUID();
}

export class RoomConnection extends Emitter<RoomConnectionEvents> {
  private readonly opts: Required<RoomConnectionOptions>;
  private ws: WebSocket | null = null;
  private signalingUrl = '';
  private room = '';
  private requestedName = '';
  private selfName = '';
  private selfAvatarId = 1;
  private closed = true;
  private relayEnabled = false;
  private rtcConfig: RTCConfiguration = buildRtcConfig([]);
  private reconnectAttempt = 0;
  private reconnectTimerId: ReturnType<typeof setTimeout> | null = null;
  private joinTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private keepaliveId: ReturnType<typeof setInterval> | null = null;
  private pongTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private pingSentAt = 0;
  private readonly peers = new Map<string, PeerRecord>();
  private readonly incoming = new Map<string, IncomingFile>();
  private readonly blobUrls = new Set<string>();

  constructor(options: RoomConnectionOptions = {}) {
    super();
    this.opts = { ...DEFAULT_OPTIONS, ...options };
  }

  connect(signalingUrl: string, room: string, name: string, avatarId: number): void {
    this.signalingUrl = signalingUrl;
    this.room = room;
    this.requestedName = name;
    this.selfName = name;
    this.selfAvatarId = avatarId;
    this.closed = false;
    this.addLifecycleListeners();

    void fetchIceServers(signalingUrl, this.opts.iceFetchTimeoutMs).then((servers) => {
      if (this.closed) return;
      this.rtcConfig = buildRtcConfig(servers);
      this.openSocket();
    });
  }

  disconnect(): void {
    this.closed = true;
    this.removeLifecycleListeners();
    this.clearSocketTimers();
    if (this.reconnectTimerId !== null) {
      clearTimeout(this.reconnectTimerId);
      this.reconnectTimerId = null;
    }

    const ws = this.ws;
    this.ws = null;
    ws?.close();

    for (const peer of this.peers.values()) this.closePeer(peer);
    this.peers.clear();
    this.incoming.clear();
    for (const url of this.blobUrls) URL.revokeObjectURL(url);
    this.blobUrls.clear();

    // A torn-down connection must never touch app state again (late socket/channel events).
    this.removeAllListeners();
  }

  // ---- outgoing content ----

  sendChat(text: string): void {
    const ts = Date.now();
    const id = randomId();
    this.broadcast({ type: 'chat', id, from: this.selfName, avatarId: this.selfAvatarId, text, ts });
    this.emit('feed-item', { kind: 'chat', id, from: this.selfName, avatarId: this.selfAvatarId, self: true, text, ts });
  }

  sendText(content: string): void {
    const ts = Date.now();
    const id = randomId();
    this.broadcast({ type: 'text', id, from: this.selfName, avatarId: this.selfAvatarId, content, ts });
    this.emit('feed-item', { kind: 'text', id, from: this.selfName, avatarId: this.selfAvatarId, self: true, content, ts });
  }

  sendCode(lang: string, content: string): void {
    const ts = Date.now();
    const id = randomId();
    this.broadcast({ type: 'code', id, from: this.selfName, avatarId: this.selfAvatarId, lang, content, ts });
    this.emit('feed-item', {
      kind: 'code',
      id,
      from: this.selfName,
      avatarId: this.selfAvatarId,
      self: true,
      lang,
      content,
      ts,
    });
  }

  async sendFile(file: File): Promise<void> {
    const id = randomId();
    const ts = Date.now();
    const mime = file.type || 'application/octet-stream';

    // Each receiver's route is fixed for the whole transfer, so its chunks and file-done
    // can't be split across two paths and arrive out of order.
    const targets: Array<{ peer: PeerRecord; via: Transport }> = [];
    for (const peer of this.peers.values()) {
      const via = this.transportFor(peer);
      if (via) targets.push({ peer, via });
    }

    const selfBlobUrl = URL.createObjectURL(file);
    this.blobUrls.add(selfBlobUrl);

    const initialProgress = file.size === 0 ? 1 : 0;
    this.emit('feed-item', {
      kind: 'file',
      id,
      from: this.selfName,
      avatarId: this.selfAvatarId,
      self: true,
      name: file.name,
      size: file.size,
      mime,
      ts,
      status: 'transferring',
      progress: initialProgress,
      blobUrl: selfBlobUrl,
    });

    const meta: DataChannelMessage = {
      type: 'file-meta',
      id,
      from: this.selfName,
      avatarId: this.selfAvatarId,
      name: file.name,
      size: file.size,
      mime,
      ts,
    };
    const alive = new Set(targets.filter((t) => this.sendJson(t.peer, meta, t.via)));

    let sentBytes = 0;
    let seq = 0;
    let lastEmitted = initialProgress;
    try {
      for await (const chunk of chunksFromFile(file)) {
        if (targets.length > 0 && alive.size === 0) break;
        const framed = encodeChunk(id, seq, chunk);
        const results = await Promise.all(
          Array.from(alive, async (t) => [t, await this.sendBinary(t.peer, framed, t.via)] as const)
        );
        for (const [t, ok] of results) if (!ok) alive.delete(t);

        sentBytes += chunk.byteLength;
        seq += 1;
        const progress = file.size === 0 ? 1 : Math.min(1, sentBytes / file.size);
        if (progress - lastEmitted >= PROGRESS_STEP || progress === 1) {
          lastEmitted = progress;
          this.emit('feed-item-update', { id, progress });
        }
      }
    } catch {
      this.emit('feed-item-update', { id, status: 'failed' });
      return;
    }

    if (targets.length > 0 && alive.size === 0) {
      this.emit('feed-item-update', { id, status: 'failed' });
      return;
    }

    const done: DataChannelMessage = { type: 'file-done', id, from: this.selfName, ts: Date.now() };
    for (const t of alive) this.sendJson(t.peer, done, t.via);
    this.emit('feed-item-update', { id, status: 'done', progress: 1 });
  }

  // ---- signaling socket ----

  private openSocket(): void {
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.signalingUrl);
    } catch {
      this.fail('The signaling server URL is invalid.');
      return;
    }
    ws.binaryType = 'arraybuffer';
    this.ws = ws;

    this.joinTimeoutId = setTimeout(() => this.dropSocket(ws), this.opts.joinTimeoutMs);

    ws.addEventListener('open', () => {
      if (this.ws !== ws) return;
      this.sendToServer({ type: 'join', room: this.room, name: this.requestedName, avatarId: this.selfAvatarId });
      this.keepaliveId = setInterval(() => this.ping(), this.opts.keepaliveIntervalMs);
    });

    ws.addEventListener('message', (event) => {
      if (this.ws !== ws) return;
      this.noteServerTraffic();

      if (event.data instanceof ArrayBuffer) {
        this.handleRelayFrame(event.data);
        return;
      }
      if (typeof event.data !== 'string') return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(event.data);
      } catch {
        return;
      }
      const result = ServerToClientSchema.safeParse(parsed);
      if (result.success) this.handleServerMessage(result.data);
    });

    // Browsers follow 'error' with 'close', but not every WebSocket implementation does —
    // either one starts recovery, and the `this.ws === ws` guard makes the second a no-op.
    ws.addEventListener('close', () => {
      if (this.ws === ws) this.handleSocketLost();
    });
    ws.addEventListener('error', () => this.dropSocket(ws));
  }

  /** Abandons a socket we believe is dead and moves on to a reconnect, without waiting for the browser's close timeout. */
  private dropSocket(ws: WebSocket): void {
    if (this.ws !== ws) return;
    this.handleSocketLost();
    try {
      ws.close();
    } catch {
      // already closing
    }
  }

  private handleSocketLost(): void {
    this.ws = null;
    this.clearSocketTimers();
    if (this.closed) return;

    // The server tells every other peer we left, and they tear down their side of each
    // connection — so ours are dead too. They are rebuilt from the fresh room-state on rejoin.
    this.teardownPeers();

    this.reconnectAttempt += 1;
    this.emit('reconnecting', { attempt: this.reconnectAttempt });
    const delay = Math.min(
      this.opts.reconnectMaxDelayMs,
      this.opts.reconnectBaseDelayMs * 2 ** (this.reconnectAttempt - 1)
    );
    this.reconnectTimerId = setTimeout(() => {
      this.reconnectTimerId = null;
      if (!this.closed) this.openSocket();
    }, delay);
  }

  private ping(): void {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    this.sendToServer({ type: 'ping' });
    if (this.pongTimeoutId !== null) return;

    this.pingSentAt = Date.now();
    const armTimeout = () => {
      this.pongTimeoutId = setTimeout(() => {
        this.pongTimeoutId = null;
        if (this.ws !== ws) return;
        // If far more time passed than the timeout, the tab was suspended (backgrounded
        // mobile browser) — the timer is stale, not the socket. Re-check instead of dropping.
        if (Date.now() - this.pingSentAt > this.opts.pongTimeoutMs * 2) {
          this.pingSentAt = Date.now();
          this.sendToServer({ type: 'ping' });
          armTimeout();
          return;
        }
        this.dropSocket(ws);
      }, this.opts.pongTimeoutMs);
    };
    armTimeout();
  }

  private noteServerTraffic(): void {
    if (this.pongTimeoutId !== null) {
      clearTimeout(this.pongTimeoutId);
      this.pongTimeoutId = null;
    }
  }

  private readonly onWake = (): void => {
    if (this.closed) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ping();
    } else if (this.reconnectTimerId !== null) {
      clearTimeout(this.reconnectTimerId);
      this.reconnectTimerId = null;
      this.openSocket();
    }
  };

  private addLifecycleListeners(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('online', this.onWake);
    document.addEventListener('visibilitychange', this.onWake);
  }

  private removeLifecycleListeners(): void {
    if (typeof window === 'undefined') return;
    window.removeEventListener('online', this.onWake);
    document.removeEventListener('visibilitychange', this.onWake);
  }

  private clearSocketTimers(): void {
    if (this.joinTimeoutId !== null) clearTimeout(this.joinTimeoutId);
    if (this.keepaliveId !== null) clearInterval(this.keepaliveId);
    if (this.pongTimeoutId !== null) clearTimeout(this.pongTimeoutId);
    this.joinTimeoutId = null;
    this.keepaliveId = null;
    this.pongTimeoutId = null;
  }

  /** Stops for good and reports why. Used for errors a retry can't fix (e.g. room full). */
  private fail(message: string): void {
    this.closed = true;
    this.removeLifecycleListeners();
    this.clearSocketTimers();
    const ws = this.ws;
    this.ws = null;
    ws?.close();
    this.teardownPeers();
    this.emit('error', { message });
  }

  private sendToServer(message: ClientToServer): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private sendSignal(to: string, data: SignalData): void {
    this.sendToServer({ type: 'signal', to, data });
  }

  private handleServerMessage(message: ServerToClient): void {
    switch (message.type) {
      case 'room-state': {
        if (this.joinTimeoutId !== null) {
          clearTimeout(this.joinTimeoutId);
          this.joinTimeoutId = null;
        }
        this.reconnectAttempt = 0;
        this.relayEnabled = message.relay === true;
        // The server may have de-duplicated our requested name — sign outgoing messages with its answer.
        this.selfName = message.selfName;
        this.emit('self-joined', {
          selfId: message.selfId,
          selfName: message.selfName,
          roomName: message.room,
          relay: this.relayEnabled,
        });
        for (const peer of message.peers) {
          // We are the newcomer: each existing peer sends us an offer.
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
        if (!peer) break;
        this.removePeer(peer);
        this.emit('feed-item', { kind: 'system', id: randomId(), text: `${peer.name} left the room`, ts: Date.now() });
        break;
      }
      case 'signal': {
        void this.handleSignal(message.from, message.data);
        break;
      }
      case 'error': {
        this.fail(message.message);
        break;
      }
      case 'pong': {
        break;
      }
    }
  }

  // ---- peers ----

  private isCurrent(peer: PeerRecord): boolean {
    return this.peers.get(peer.id) === peer;
  }

  /**
   * Only the live record for a peer may report status. Without this guard, a data
   * channel's asynchronous 'close' event after the peer left would re-add a ghost
   * entry to the roster.
   */
  private emitPeerStatus(peer: PeerRecord, status: PeerStatus): void {
    if (!this.isCurrent(peer)) return;
    this.emit('peer-update', { id: peer.id, name: peer.name, avatarId: peer.avatarId, status });
  }

  private registerPeer(info: PeerInfo, isOfferer: boolean): void {
    if (this.peers.has(info.id)) return;

    const pc = this.opts.createPeerConnection(this.rtcConfig);
    const peer: PeerRecord = {
      id: info.id,
      name: info.name,
      avatarId: info.avatarId,
      pc,
      dc: null,
      isOfferer,
      remoteDescSet: false,
      pendingCandidates: [],
      iceRestarts: 0,
      directFailed: false,
      connectTimeoutId: null,
      abort: new AbortController(),
      relaySentBytes: 0,
      relayAckedBytes: 0,
      relayReceivedBytes: 0,
      relayLastAckSent: 0,
      relayWaiters: new Set(),
    };
    this.peers.set(info.id, peer);
    this.emitPeerStatus(peer, 'connecting');
    this.armConnectTimeout(peer);

    pc.addEventListener('icecandidate', (event) => {
      if (!event.candidate || !this.isCurrent(peer)) return;
      this.sendSignal(peer.id, {
        kind: 'ice-candidate',
        candidate: event.candidate.candidate,
        sdpMid: event.candidate.sdpMid,
        sdpMLineIndex: event.candidate.sdpMLineIndex,
      });
    });

    pc.addEventListener('connectionstatechange', () => {
      if (!this.isCurrent(peer)) return;
      switch (pc.connectionState) {
        case 'connected':
          if (peer.dc?.readyState === 'open') this.markConnected(peer);
          break;
        case 'disconnected':
          // Often transient (e.g. a phone switching networks) — it may recover on its own.
          this.emitPeerStatus(peer, peer.directFailed && this.relayEnabled ? 'relayed' : 'connecting');
          break;
        case 'failed':
          this.handlePeerFailure(peer);
          break;
      }
    });

    pc.addEventListener('datachannel', (event) => {
      if (this.isCurrent(peer)) this.wireDataChannel(peer, event.channel);
    });

    if (isOfferer) {
      this.wireDataChannel(peer, pc.createDataChannel(DATA_CHANNEL_LABEL, { ordered: true }));
      void this.sendOffer(peer, false);
    }
  }

  private armConnectTimeout(peer: PeerRecord): void {
    if (peer.connectTimeoutId !== null) clearTimeout(peer.connectTimeoutId);
    peer.connectTimeoutId = setTimeout(() => {
      peer.connectTimeoutId = null;
      if (this.isCurrent(peer) && peer.dc?.readyState !== 'open') this.handlePeerFailure(peer);
    }, this.opts.peerConnectTimeoutMs);
  }

  private markConnected(peer: PeerRecord): void {
    if (peer.connectTimeoutId !== null) {
      clearTimeout(peer.connectTimeoutId);
      peer.connectTimeoutId = null;
    }
    peer.iceRestarts = 0;
    this.emitPeerStatus(peer, 'connected');
  }

  private handlePeerFailure(peer: PeerRecord): void {
    if (!this.isCurrent(peer)) return;
    peer.directFailed = true;

    // Only the offerer renegotiates, so the two sides never race each other. Retrying continues
    // in the background even while relayed, and upgrades to direct if a route turns up.
    const canRestart = peer.isOfferer && peer.iceRestarts < MAX_ICE_RESTARTS;
    if (canRestart) {
      peer.iceRestarts += 1;
      this.armConnectTimeout(peer);
      void this.sendOffer(peer, true);
    }

    this.emitPeerStatus(peer, this.relayEnabled ? 'relayed' : canRestart ? 'connecting' : 'failed');
  }

  private async sendOffer(peer: PeerRecord, iceRestart: boolean): Promise<void> {
    try {
      const offer = await peer.pc.createOffer(iceRestart ? { iceRestart: true } : undefined);
      if (!this.isCurrent(peer)) return;
      await peer.pc.setLocalDescription(offer);
      const sdp = peer.pc.localDescription?.sdp;
      if (sdp && this.isCurrent(peer)) this.sendSignal(peer.id, { kind: 'offer', sdp });
    } catch (err) {
      console.warn('[fluxroom] could not create an offer', err);
    }
  }

  private async handleSignal(from: string, data: SignalData): Promise<void> {
    // Signals only come from peers the server announced to us; anything else is stale.
    const peer = this.peers.get(from);
    if (!peer) return;

    try {
      if (data.kind === 'offer') {
        await peer.pc.setRemoteDescription({ type: 'offer', sdp: data.sdp });
        peer.remoteDescSet = true;
        await this.flushPendingCandidates(peer);
        const answer = await peer.pc.createAnswer();
        if (!this.isCurrent(peer)) return;
        await peer.pc.setLocalDescription(answer);
        const sdp = peer.pc.localDescription?.sdp;
        if (sdp && this.isCurrent(peer)) this.sendSignal(from, { kind: 'answer', sdp });
        return;
      }

      if (data.kind === 'answer') {
        await peer.pc.setRemoteDescription({ type: 'answer', sdp: data.sdp });
        peer.remoteDescSet = true;
        await this.flushPendingCandidates(peer);
        return;
      }

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
    } catch (err) {
      // A single bad or stale candidate/description must not break the connection flow.
      console.warn('[fluxroom] ignoring signal that could not be applied', err);
    }
  }

  private async flushPendingCandidates(peer: PeerRecord): Promise<void> {
    const queued = peer.pendingCandidates;
    peer.pendingCandidates = [];
    for (const candidate of queued) {
      try {
        await peer.pc.addIceCandidate(candidate);
      } catch {
        // skip a candidate that no longer applies
      }
    }
  }

  private closePeer(peer: PeerRecord): void {
    if (peer.connectTimeoutId !== null) clearTimeout(peer.connectTimeoutId);
    peer.connectTimeoutId = null;
    peer.abort.abort();
    try {
      peer.dc?.close();
    } catch {
      // ignore
    }
    try {
      peer.pc.close();
    } catch {
      // ignore
    }
  }

  /** Removes from the roster *before* closing, so the channel's late 'close' event is ignored. */
  private removePeer(peer: PeerRecord): void {
    if (!this.isCurrent(peer)) return;
    this.peers.delete(peer.id);
    this.closePeer(peer);
    this.emit('peer-removed', { id: peer.id });
    this.failIncomingTransfersFrom(peer.id);
  }

  private teardownPeers(): void {
    for (const peer of Array.from(this.peers.values())) this.removePeer(peer);
    for (const fileId of this.incoming.keys()) {
      this.emit('feed-item-update', { id: fileId, status: 'failed' });
    }
    this.incoming.clear();
  }

  // ---- transport selection ----

  private relayAvailable(): boolean {
    return this.relayEnabled && this.ws?.readyState === WebSocket.OPEN;
  }

  /** Direct when the data channel is open; otherwise through the server, if it relays. */
  private transportFor(peer: PeerRecord): Transport | null {
    if (peer.dc?.readyState === 'open') return 'direct';
    if (this.relayAvailable() && this.isCurrent(peer)) return 'relay';
    return null;
  }

  private sendJson(peer: PeerRecord, message: DataChannelMessage, via = this.transportFor(peer)): boolean {
    if (via === 'relay') {
      return this.sendRelayFrame(peer, RelayKind.Text, encodeRelayText(JSON.stringify(message)));
    }
    const dc = peer.dc;
    if (via !== 'direct' || !dc || dc.readyState !== 'open') return false;
    try {
      dc.send(JSON.stringify(message));
      return true;
    } catch {
      return false;
    }
  }

  private broadcast(message: DataChannelMessage): void {
    for (const peer of this.peers.values()) this.sendJson(peer, message);
  }

  private sendBinary(peer: PeerRecord, data: ArrayBuffer, via: Transport): Promise<boolean> {
    return via === 'relay' ? this.sendRelayBinary(peer, data) : this.sendDirectBinary(peer, data);
  }

  // ---- direct (data channel) ----

  private wireDataChannel(peer: PeerRecord, dc: RTCDataChannel): void {
    peer.dc = dc;
    dc.binaryType = 'arraybuffer';
    dc.bufferedAmountLowThreshold = BUFFERED_AMOUNT_LOW_THRESHOLD;

    const onOpen = () => {
      if (peer.dc === dc && this.isCurrent(peer)) this.markConnected(peer);
    };
    // The answerer can receive a channel that is already open.
    if (dc.readyState === 'open') onOpen();
    dc.addEventListener('open', onOpen);

    dc.addEventListener('close', () => {
      if (peer.dc !== dc || !this.isCurrent(peer)) return;
      peer.directFailed = true;
      // Transfers already running over this channel can't continue; new traffic falls back to the relay.
      this.failIncomingTransfersFrom(peer.id, 'direct');
      this.emitPeerStatus(peer, this.relayEnabled ? 'relayed' : 'disconnected');
    });

    dc.addEventListener('message', (event: MessageEvent) => {
      if (!this.isCurrent(peer)) return;
      if (typeof event.data === 'string') {
        this.handleControlMessage(peer, event.data, 'direct');
      } else if (event.data instanceof ArrayBuffer) {
        this.handleBinaryChunk(peer, event.data);
      }
    });
  }

  /** Resolves true once sent, or false if the channel closes or the peer is torn down while waiting on backpressure. */
  private sendDirectBinary(peer: PeerRecord, data: ArrayBuffer): Promise<boolean> {
    const dc = peer.dc;
    if (!dc || dc.readyState !== 'open' || !this.isCurrent(peer)) return Promise.resolve(false);

    const trySend = (): boolean => {
      try {
        dc.send(data);
        return true;
      } catch {
        return false;
      }
    };

    if (dc.bufferedAmount <= dc.bufferedAmountLowThreshold) return Promise.resolve(trySend());

    return new Promise((resolve) => {
      const signal = peer.abort.signal;
      const finish = (ok: boolean) => {
        dc.removeEventListener('bufferedamountlow', onLow);
        dc.removeEventListener('close', onClose);
        signal.removeEventListener('abort', onClose);
        resolve(ok);
      };
      const onLow = () => finish(dc.readyState === 'open' && trySend());
      const onClose = () => finish(false);
      if (signal.aborted) return finish(false);
      dc.addEventListener('bufferedamountlow', onLow);
      dc.addEventListener('close', onClose);
      signal.addEventListener('abort', onClose);
    });
  }

  // ---- relay (through the signaling server) ----

  private sendRelayFrame(peer: PeerRecord, kind: RelayKind, payload: Uint8Array): boolean {
    const ws = this.ws;
    if (!this.relayAvailable() || !ws || !this.isCurrent(peer)) return false;
    try {
      ws.send(encodeRelayFrame(kind, peer.id, payload));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Sends a file chunk through the server with flow control: at most RELAY_WINDOW_BYTES may be
   * unacknowledged by the receiver, so a slow phone never makes the server buffer a whole file.
   */
  private async sendRelayBinary(peer: PeerRecord, data: ArrayBuffer): Promise<boolean> {
    const signal = peer.abort.signal;
    while (
      peer.relaySentBytes - peer.relayAckedBytes >= RELAY_WINDOW_BYTES ||
      (this.ws?.bufferedAmount ?? 0) > RELAY_SOCKET_BUFFER_LIMIT
    ) {
      if (signal.aborted || !this.relayAvailable()) return false;
      await this.waitForRelayProgress(peer);
    }
    if (signal.aborted || !this.sendRelayFrame(peer, RelayKind.Binary, new Uint8Array(data))) return false;
    peer.relaySentBytes += data.byteLength;
    return true;
  }

  private waitForRelayProgress(peer: PeerRecord): Promise<void> {
    return new Promise((resolve) => {
      const signal = peer.abort.signal;
      const done = () => {
        clearTimeout(timer);
        peer.relayWaiters.delete(done);
        signal.removeEventListener('abort', done);
        resolve();
      };
      const timer = setTimeout(done, RELAY_POLL_MS);
      peer.relayWaiters.add(done);
      signal.addEventListener('abort', done);
    });
  }

  private handleRelayFrame(buffer: ArrayBuffer): void {
    const frame = decodeRelayFrame(new Uint8Array(buffer));
    if (!frame) return;
    // The server stamps the sender's id, and only relays between members of one room.
    const peer = this.peers.get(frame.peerId);
    if (!peer) return;

    switch (frame.kind) {
      case RelayKind.Text:
        this.handleControlMessage(peer, decodeRelayText(frame.payload), 'relay');
        return;
      case RelayKind.Binary: {
        peer.relayReceivedBytes += frame.payload.byteLength;
        this.handleBinaryChunk(peer, frame.payload.slice().buffer);
        if (peer.relayReceivedBytes - peer.relayLastAckSent >= RELAY_ACK_EVERY_BYTES) {
          peer.relayLastAckSent = peer.relayReceivedBytes;
          this.sendRelayFrame(peer, RelayKind.Ack, encodeAck(peer.relayReceivedBytes));
        }
        return;
      }
      case RelayKind.Ack: {
        const acked = decodeAck(frame.payload);
        if (acked === null) return;
        peer.relayAckedBytes = Math.max(peer.relayAckedBytes, Math.min(acked, peer.relaySentBytes));
        for (const wake of Array.from(peer.relayWaiters)) wake();
        return;
      }
    }
  }

  // ---- incoming content (either transport) ----

  /** Marks in-progress receives from a peer as failed instead of leaving a frozen progress bar. */
  private failIncomingTransfersFrom(peerId: string, via?: Transport): void {
    for (const [fileId, incoming] of this.incoming) {
      if (incoming.peerId !== peerId || (via && incoming.via !== via)) continue;
      this.incoming.delete(fileId);
      this.emit('feed-item-update', { id: fileId, status: 'failed' });
    }
  }

  private handleControlMessage(peer: PeerRecord, raw: string, via: Transport): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    const result = DataChannelMessageSchema.safeParse(parsed);
    if (!result.success) return;
    const message = result.data;

    switch (message.type) {
      case 'chat':
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
      case 'text':
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
      case 'code':
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
      case 'file-meta': {
        if (this.incoming.has(message.id)) return;
        const progress = message.size === 0 ? 1 : 0;
        this.incoming.set(message.id, {
          meta: message,
          peerId: peer.id,
          via,
          chunks: [],
          receivedBytes: 0,
          lastEmittedProgress: progress,
        });
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
          progress,
        });
        return;
      }
      case 'file-done': {
        const incoming = this.incoming.get(message.id);
        if (!incoming || incoming.peerId !== peer.id) return;
        this.incoming.delete(message.id);
        if (incoming.receivedBytes !== incoming.meta.size) {
          this.emit('feed-item-update', { id: message.id, status: 'failed' });
          return;
        }
        const blobUrl = URL.createObjectURL(new Blob(incoming.chunks, { type: incoming.meta.mime }));
        this.blobUrls.add(blobUrl);
        this.emit('feed-item-update', { id: message.id, status: 'done', progress: 1, blobUrl });
        return;
      }
    }
  }

  private handleBinaryChunk(peer: PeerRecord, buffer: ArrayBuffer): void {
    let decoded: ReturnType<typeof decodeChunk>;
    try {
      decoded = decodeChunk(buffer);
    } catch {
      return;
    }
    const { fileId, seq, bytes } = decoded;
    const incoming = this.incoming.get(fileId);
    // A peer may only write into its own transfer.
    if (!incoming || incoming.peerId !== peer.id) return;

    if (incoming.chunks[seq] === undefined) incoming.receivedBytes += bytes.byteLength;
    incoming.chunks[seq] = bytes;

    if (incoming.receivedBytes > incoming.meta.size) {
      this.incoming.delete(fileId);
      this.emit('feed-item-update', { id: fileId, status: 'failed' });
      return;
    }

    const progress = incoming.meta.size === 0 ? 1 : incoming.receivedBytes / incoming.meta.size;
    if (progress - incoming.lastEmittedProgress >= PROGRESS_STEP || progress === 1) {
      incoming.lastEmittedProgress = progress;
      this.emit('feed-item-update', { id: fileId, progress });
    }
  }
}
