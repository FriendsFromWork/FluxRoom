import { createServer, type Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { ClientToServerSchema, type ServerToClient, type SignalData } from '@fluxroom/shared';
import { RoomRegistry, type Peer } from './room.js';

const HEARTBEAT_INTERVAL_MS = 30_000;

export interface SignalingServerOptions {
  /** Comma-separated-equivalent allow-list already split into an array, or null to allow any origin. */
  allowedOrigins?: string[] | null;
  heartbeatIntervalMs?: number;
}

export interface SignalingServer {
  httpServer: Server;
  registry: RoomRegistry;
  close: () => Promise<void>;
}

export function createSignalingServer(options: SignalingServerOptions = {}): SignalingServer {
  const allowedOrigins = options.allowedOrigins ?? null;
  const registry = new RoomRegistry();

  const httpServer = createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/') {
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

  const wss = new WebSocketServer({ noServer: true });

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
    const socket = ws as WebSocket & { isAlive: boolean };
    socket.isAlive = true;
    socket.on('pong', () => {
      socket.isAlive = true;
    });

    let peer: Peer | null = null;
    let roomName: string | null = null;

    ws.on('message', (raw) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw.toString());
      } catch {
        return;
      }

      const result = ClientToServerSchema.safeParse(parsed);
      if (!result.success) return;
      const message = result.data;

      if (message.type === 'join') {
        if (peer) return; // already joined, ignore duplicate joins on this socket

        const room = registry.getOrCreate(message.room);
        const name = room.uniqueName(message.name);
        const id = randomUUID();

        peer = { id, name, avatarId: message.avatarId, ws, isAlive: true };
        roomName = message.room;
        room.add(peer);

        send(ws, {
          type: 'room-state',
          selfId: id,
          selfName: name,
          room: message.room,
          peers: room.others(id).map((p) => ({ id: p.id, name: p.name, avatarId: p.avatarId })),
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

  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      const socket = ws as WebSocket & { isAlive: boolean };
      if (!socket.isAlive) {
        socket.terminate();
        continue;
      }
      socket.isAlive = false;
      socket.ping();
    }
  }, options.heartbeatIntervalMs ?? HEARTBEAT_INTERVAL_MS);

  wss.on('close', () => clearInterval(heartbeat));

  return {
    httpServer,
    registry,
    close: () =>
      new Promise<void>((resolve, reject) => {
        wss.close();
        for (const client of wss.clients) client.terminate();
        httpServer.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
