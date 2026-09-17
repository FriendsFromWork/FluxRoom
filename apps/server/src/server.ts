import { createServer, type Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket, type RawData } from 'ws';
import {
  ClientToServerSchema,
  decodeRelayFrame,
  encodeRelayFrame,
  type ServerToClient,
  type SignalData,
} from '@fluxroom/shared';
import { RoomRegistry, type Peer } from './room.js';
import type { IceServerProvider } from './iceServers.js';

/** How often we scan for connections that have gone silent for too long. */
const STALE_CHECK_INTERVAL_MS = 20_000;
/**
 * A connection is considered dead if we haven't received any message (join, signal,
 * or the client's periodic keepalive ping) from it in this long. Liveness is tracked
 * from real application messages rather than raw WebSocket ping/pong control frames,
 * since those aren't reliably relayed by every reverse proxy a deployment sits behind.
 */
const STALE_AFTER_MS = 90_000;
/** Full-mesh WebRTC degrades quickly past a handful of peers, so rooms are capped. */
export const MAX_PEERS_PER_ROOM = 10;
/** Bounds total server memory: each room is cheap, but nothing else limits how many can exist at once. */
export const MAX_ROOMS = 5_000;
/** JSON signaling messages are small (SDP/ICE); anything bigger is not a legitimate client. */
const MAX_JSON_MESSAGE_BYTES = 64 * 1024;
/**
 * Binary relay frames carry a file chunk (64 KB) or a pasted text/code message
 * (60,000 characters, up to ~180 KB as UTF-8 JSON), plus a small header.
 */
const MAX_FRAME_BYTES = 256 * 1024;
/**
 * If a recipient's socket already has this much queued (it's reading slower than the sender
 * writes), further relayed frames are dropped. Clients keep well under it with their own
 * ack-based flow control; this only protects server memory from a misbehaving client.
 */
const MAX_RECIPIENT_BUFFERED_BYTES = 8 * 1024 * 1024;

function toUint8Array(raw: RawData): Uint8Array {
  if (Array.isArray(raw)) return new Uint8Array(Buffer.concat(raw));
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
  return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
}

export interface SignalingServerOptions {
  /** Comma-separated-equivalent allow-list already split into an array, or null to allow any origin. */
  allowedOrigins?: string[] | null;
  staleCheckIntervalMs?: number;
  staleAfterMs?: number;
  maxPeersPerRoom?: number;
  maxRooms?: number;
  /** Supplies TURN relays for `GET /ice-servers`; defaults to none (browsers fall back to STUN only). */
  iceServers?: IceServerProvider;
  /**
   * Relay chat and files through this server for peers that can't connect directly
   * (default true). Relayed data passes through the server in memory and is never stored.
   */
  relay?: boolean;
}

export interface SignalingServer {
  httpServer: Server;
  registry: RoomRegistry;
  close: () => Promise<void>;
}

export function createSignalingServer(options: SignalingServerOptions = {}): SignalingServer {
  const allowedOrigins = options.allowedOrigins ?? null;
  const registry = new RoomRegistry();

  const iceServers: IceServerProvider = options.iceServers ?? (async () => []);

  const httpServer = createServer((req, res) => {
    const path = (req.url ?? '/').split('?')[0];

    if (req.method === 'GET' && path === '/ice-servers') {
      const origin = req.headers.origin;
      if (allowedOrigins && (!origin || !allowedOrigins.includes(origin))) {
        res.writeHead(403);
        res.end();
        return;
      }
      void iceServers().then(
        (servers) => {
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
            'Access-Control-Allow-Origin': allowedOrigins ? (origin ?? allowedOrigins[0]) : '*',
            Vary: 'Origin',
          });
          res.end(JSON.stringify({ iceServers: servers }));
        },
        () => {
          res.writeHead(500);
          res.end();
        }
      );
      return;
    }

    if (req.method === 'GET' && path === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'ok',
          service: 'fluxroom-signaling',
          rooms: registry.roomCount,
          peers: registry.peerCount,
        })
      );
      return;
    }
    res.writeHead(404);
    res.end();
  });

  const maxPeersPerRoom = options.maxPeersPerRoom ?? MAX_PEERS_PER_ROOM;
  const maxRooms = options.maxRooms ?? MAX_ROOMS;
  const relayEnabled = options.relay ?? true;
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_FRAME_BYTES });

  function isOriginAllowed(origin: string | undefined): boolean {
    if (!allowedOrigins) return true;
    if (!origin) return false;
    return allowedOrigins.includes(origin);
  }

  httpServer.on('upgrade', (request, socket, head) => {
    if (!isOriginAllowed(request.headers.origin)) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  function send(ws: WebSocket, message: ServerToClient): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  wss.on('connection', (ws) => {
    const socket = ws as WebSocket & { lastSeen: number };
    socket.lastSeen = Date.now();
    // Without a listener, a protocol error (e.g. an oversized frame) is an unhandled 'error'
    // event that crashes the whole process. ws closes the socket itself; 'close' cleans up.
    ws.on('error', () => {});

    let peer: Peer | null = null;
    let roomName: string | null = null;

    /** Forwards a binary frame to another peer in the same room, stamped with the sender's id. */
    function relayFrame(data: Uint8Array): void {
      if (!relayEnabled || !peer || !roomName) return;
      socket.lastSeen = Date.now();

      const frame = decodeRelayFrame(data);
      if (!frame || frame.peerId === peer.id) return;
      const target = registry.get(roomName)?.peers.get(frame.peerId);
      if (!target || target.ws.readyState !== WebSocket.OPEN) return;
      if (target.ws.bufferedAmount > MAX_RECIPIENT_BUFFERED_BYTES) return;

      target.ws.send(encodeRelayFrame(frame.kind, peer.id, frame.payload), { binary: true });
    }

    ws.on('message', (raw, isBinary) => {
      if (isBinary) {
        relayFrame(toUint8Array(raw));
        return;
      }

      const text = raw.toString();
      if (text.length > MAX_JSON_MESSAGE_BYTES) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        return;
      }

      const result = ClientToServerSchema.safeParse(parsed);
      if (!result.success) return;
      const message = result.data;
      socket.lastSeen = Date.now();

      if (message.type === 'ping') {
        send(ws, { type: 'pong' });
        return;
      }

      if (message.type === 'join') {
        if (peer) return; // already joined, ignore duplicate joins on this socket

        const existing = registry.get(message.room);
        if (existing && existing.peers.size >= maxPeersPerRoom) {
          send(ws, { type: 'error', message: `This room is full (max ${maxPeersPerRoom} people).` });
          return;
        }

        const room = registry.getOrCreate(message.room, maxRooms);
        if (!room) {
          send(ws, { type: 'error', message: 'Too many rooms are active right now — try again shortly.' });
          return;
        }
        const name = room.uniqueName(message.name);
        const id = randomUUID();

        peer = { id, name, avatarId: message.avatarId, ws };
        roomName = message.room;
        room.add(peer);

        send(ws, {
          type: 'room-state',
          selfId: id,
          selfName: name,
          room: message.room,
          peers: room.others(id).map((p) => ({ id: p.id, name: p.name, avatarId: p.avatarId })),
          relay: relayEnabled,
        });

        for (const other of room.others(id)) {
          send(other.ws, { type: 'peer-joined', peer: { id, name, avatarId: message.avatarId } });
        }
        return;
      }

      if (message.type === 'signal') {
        if (!peer || !roomName) return;
        const room = registry.get(roomName);
        const target = room?.peers.get(message.to);
        if (!target) return;

        send(target.ws, {
          type: 'signal',
          from: peer.id,
          data: message.data as SignalData,
        });
      }
    });

    ws.on('close', () => {
      if (!peer || !roomName) return;
      const room = registry.get(roomName);
      if (!room) return;

      room.remove(peer.id);
      for (const other of room.others(peer.id)) {
        send(other.ws, { type: 'peer-left', id: peer!.id });
      }
      registry.deleteIfEmpty(roomName);
    });
  });

  const staleAfterMs = options.staleAfterMs ?? STALE_AFTER_MS;
  const staleCheck = setInterval(() => {
    const now = Date.now();
    for (const ws of wss.clients) {
      const socket = ws as WebSocket & { lastSeen: number };
      if (now - socket.lastSeen > staleAfterMs) {
        socket.terminate();
      }
    }
  }, options.staleCheckIntervalMs ?? STALE_CHECK_INTERVAL_MS);

  wss.on('close', () => clearInterval(staleCheck));

  return {
    httpServer,
    registry,
    close: () =>
      new Promise<void>((resolve, reject) => {
        wss.close();
        for (const client of wss.clients) client.terminate();
        httpServer.close((err) => (err ? reject(err) : resolve()));
        // Idle keep-alive HTTP sockets (e.g. from /ice-servers fetches) would otherwise delay close for seconds.
        httpServer.closeAllConnections();
      }),
  };
}
