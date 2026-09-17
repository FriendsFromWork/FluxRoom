import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocket } from 'ws';
import type { AddressInfo } from 'node:net';
import { createSignalingServer, type SignalingServer } from './server.js';
import { RelayKind, decodeRelayFrame, encodeRelayFrame, type ServerToClient } from '@fluxroom/shared';

let server: SignalingServer;
let baseUrl: string;

function startServer(options?: Parameters<typeof createSignalingServer>[0]) {
  server = createSignalingServer(options);
  return new Promise<void>((resolve) => {
    server.httpServer.listen(0, () => {
      const port = (server.httpServer.address() as AddressInfo).port;
      baseUrl = `ws://127.0.0.1:${port}`;
      resolve();
    });
  });
}

beforeEach(async () => {
  await startServer();
});

afterEach(async () => {
  await server.close();
});

interface Client {
  ws: WebSocket;
  messages: ServerToClient[];
}

function connect(headers?: Record<string, string>): Promise<Client> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(baseUrl, { headers });
    const messages: ServerToClient[] = [];
    ws.on('message', (raw) => messages.push(JSON.parse(raw.toString())));
    ws.on('open', () => resolve({ ws, messages }));
    ws.on('error', reject);
  });
}

function join(client: Client, room: string, name: string, avatarId = 1): void {
  client.ws.send(JSON.stringify({ type: 'join', room, name, avatarId }));
}

function waitFor(client: Client, predicate: (m: ServerToClient) => boolean, timeoutMs = 2000): Promise<ServerToClient> {
  const existing = client.messages.find(predicate);
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      client.ws.off('message', onMessage);
      reject(new Error(`Timed out waiting for message matching predicate. Received: ${JSON.stringify(client.messages)}`));
    }, timeoutMs);

    function onMessage(raw: Buffer) {
      const parsed = JSON.parse(raw.toString()) as ServerToClient;
      if (predicate(parsed)) {
        clearTimeout(timer);
        client.ws.off('message', onMessage);
        resolve(parsed);
      }
    }
    client.ws.on('message', onMessage);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('signaling server: join & roster', () => {
  it('sends room-state with an empty peer list to the first joiner', async () => {
    const alice = await connect();
    join(alice, 'room-a', 'Alice', 2);
    const state = await waitFor(alice, (m) => m.type === 'room-state');
    expect(state).toMatchObject({ type: 'room-state', selfName: 'Alice', room: 'room-a', peers: [] });
    alice.ws.close();
  });

  it('tells the second joiner about the first, and tells the first about the second', async () => {
    const alice = await connect();
    join(alice, 'room-a', 'Alice');
    const aliceState = await waitFor(alice, (m) => m.type === 'room-state');
    const aliceId = aliceState.type === 'room-state' ? aliceState.selfId : '';

    const bob = await connect();
    join(bob, 'room-a', 'Bob', 4);
    const bobState = await waitFor(bob, (m) => m.type === 'room-state');
    expect(bobState).toMatchObject({ peers: [{ id: aliceId, name: 'Alice' }] });

    const joinedMsg = await waitFor(alice, (m) => m.type === 'peer-joined');
    expect(joinedMsg).toMatchObject({ type: 'peer-joined', peer: { name: 'Bob', avatarId: 4 } });

    alice.ws.close();
    bob.ws.close();
  });

  it('de-duplicates a colliding name and reports the resolved name back via selfName', async () => {
    const alice1 = await connect();
    join(alice1, 'room-a', 'Alice');
    await waitFor(alice1, (m) => m.type === 'room-state');

    const alice2 = await connect();
    join(alice2, 'room-a', 'Alice');
    const state2 = await waitFor(alice2, (m) => m.type === 'room-state');
    expect(state2).toMatchObject({ selfName: 'Alice (2)' });

    // The first Alice should see the second joiner announced under the de-duplicated name.
    const joinedMsg = await waitFor(alice1, (m) => m.type === 'peer-joined');
    expect(joinedMsg).toMatchObject({ peer: { name: 'Alice (2)' } });

    alice1.ws.close();
    alice2.ws.close();
  });

  it('keeps rooms isolated from each other', async () => {
    const alice = await connect();
    join(alice, 'room-a', 'Alice');
    await waitFor(alice, (m) => m.type === 'room-state');

    const carol = await connect();
    join(carol, 'room-b', 'Carol');
    const carolState = await waitFor(carol, (m) => m.type === 'room-state');
    expect(carolState).toMatchObject({ peers: [] }); // must not see Alice from the other room

    expect(server.registry.roomCount).toBe(2);
    alice.ws.close();
    carol.ws.close();
  });
});

describe('signaling server: signal relay', () => {
  it('relays a signal payload to the correct peer, tagged with the sender id', async () => {
    const alice = await connect();
    join(alice, 'room-a', 'Alice');
    const aliceState = await waitFor(alice, (m) => m.type === 'room-state');
    const aliceId = aliceState.type === 'room-state' ? aliceState.selfId : '';

    const bob = await connect();
    join(bob, 'room-a', 'Bob');
    const bobState = await waitFor(bob, (m) => m.type === 'room-state');
    const bobId = bobState.type === 'room-state' ? bobState.selfId : '';

    alice.ws.send(JSON.stringify({ type: 'signal', to: bobId, data: { kind: 'offer', sdp: 'FAKE_SDP' } }));
    const signal = await waitFor(bob, (m) => m.type === 'signal');
    expect(signal).toMatchObject({ type: 'signal', from: aliceId, data: { kind: 'offer', sdp: 'FAKE_SDP' } });

    alice.ws.close();
    bob.ws.close();
  });

  it('does not deliver a signal to a peer id that belongs to a different room', async () => {
    const alice = await connect();
    join(alice, 'room-a', 'Alice');
    const aliceState = await waitFor(alice, (m) => m.type === 'room-state');
    const aliceId = aliceState.type === 'room-state' ? aliceState.selfId : '';

    const carol = await connect();
    join(carol, 'room-b', 'Carol');
    await waitFor(carol, (m) => m.type === 'room-state');

    // Carol tries to signal Alice's id, but Alice is in a different room than Carol.
    carol.ws.send(JSON.stringify({ type: 'signal', to: aliceId, data: { kind: 'offer', sdp: 'SHOULD_NOT_ARRIVE' } }));
    await sleep(300);
    expect(alice.messages.find((m) => m.type === 'signal')).toBeUndefined();

    alice.ws.close();
    carol.ws.close();
  });
});

describe('signaling server: disconnects', () => {
  it('broadcasts peer-left and frees the room when everyone leaves', async () => {
    const alice = await connect();
    join(alice, 'room-a', 'Alice');
    const aliceState = await waitFor(alice, (m) => m.type === 'room-state');
    const aliceId = aliceState.type === 'room-state' ? aliceState.selfId : '';

    const bob = await connect();
    join(bob, 'room-a', 'Bob');
    await waitFor(bob, (m) => m.type === 'room-state');

    bob.ws.close();
    const leftMsg = await waitFor(alice, (m) => m.type === 'peer-left');
    expect(leftMsg).not.toMatchObject({ id: aliceId }); // it's Bob who left, not Alice

    alice.ws.close();
    await sleep(200);
    expect(server.registry.roomCount).toBe(0);
  });
});

describe('signaling server: malformed input', () => {
  it('silently ignores a join with an out-of-range avatarId instead of crashing', async () => {
    const alice = await connect();
    alice.ws.send(JSON.stringify({ type: 'join', room: 'room-a', name: 'Alice', avatarId: 999 }));
    await sleep(300);
    expect(alice.messages).toHaveLength(0);
    expect(server.registry.roomCount).toBe(0);
    alice.ws.close();
  });

  it('ignores non-JSON frames without crashing the connection', async () => {
    const alice = await connect();
    alice.ws.send('not json{{{');
    await sleep(200);
    // Connection should still be usable afterwards.
    join(alice, 'room-a', 'Alice');
    const state = await waitFor(alice, (m) => m.type === 'room-state');
    expect(state.type).toBe('room-state');
    alice.ws.close();
  });
});

describe('signaling server: origin allow-list', () => {
  it('rejects the upgrade when origin is not in the allow-list', async () => {
    await server.close();
    await startServer({ allowedOrigins: ['https://allowed.example.com'] });

    await expect(connect({ Origin: 'https://evil.example.com' })).rejects.toThrow();
  });

  it('accepts the upgrade when origin is in the allow-list', async () => {
    await server.close();
    await startServer({ allowedOrigins: ['https://allowed.example.com'] });

    const client = await connect({ Origin: 'https://allowed.example.com' });
    expect(client.ws.readyState).toBe(WebSocket.OPEN);
    client.ws.close();
  });
});

function httpUrl(path: string): string {
  return baseUrl.replace(/^ws/, 'http') + path;
}

describe('signaling server: GET /ice-servers', () => {
  const turn = { urls: ['turn:relay.example.com:443?transport=tcp'], username: 'u', credential: 'c' };

  it('returns an empty list when no TURN provider is configured', async () => {
    const res = await fetch(httpUrl('/ice-servers'));
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(await res.json()).toEqual({ iceServers: [] });
  });

  it('returns the provider list, echoing an allowed origin for CORS', async () => {
    await server.close();
    await startServer({ allowedOrigins: ['https://app.example.com'], iceServers: async () => [turn] });

    const res = await fetch(httpUrl('/ice-servers'), { headers: { Origin: 'https://app.example.com' } });
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://app.example.com');
    expect(await res.json()).toEqual({ iceServers: [turn] });
  });

  it('refuses a disallowed origin, so relay credentials are not handed to other sites', async () => {
    await server.close();
    await startServer({ allowedOrigins: ['https://app.example.com'], iceServers: async () => [turn] });

    const res = await fetch(httpUrl('/ice-servers'), { headers: { Origin: 'https://evil.example.com' } });
    expect(res.status).toBe(403);
  });

  it('ignores a query string on the path', async () => {
    const res = await fetch(httpUrl('/ice-servers?t=1'));
    expect(res.status).toBe(200);
  });
});

describe('signaling server: limits', () => {
  it('rejects a join into a full room with an error, without adding the peer', async () => {
    await server.close();
    await startServer({ maxPeersPerRoom: 2 });

    const a = await connect();
    join(a, 'room-a', 'A');
    await waitFor(a, (m) => m.type === 'room-state');
    const b = await connect();
    join(b, 'room-a', 'B');
    await waitFor(b, (m) => m.type === 'room-state');

    const c = await connect();
    join(c, 'room-a', 'C');
    const err = await waitFor(c, (m) => m.type === 'error');
    expect(err).toMatchObject({ type: 'error' });
    expect(server.registry.get('room-a')?.peers.size).toBe(2);
    expect(a.messages.filter((m) => m.type === 'peer-joined')).toHaveLength(1);

    a.ws.close();
    b.ws.close();
    c.ws.close();
  });

  it('closes a connection that sends an oversized message, and keeps serving others', async () => {
    const alice = await connect();
    const closed = new Promise<void>((resolve) => alice.ws.on('close', () => resolve()));
    alice.ws.send('x'.repeat(300 * 1024));
    await closed;
    expect(alice.ws.readyState).toBe(WebSocket.CLOSED);

    const bob = await connect();
    join(bob, 'room-a', 'Bob');
    await waitFor(bob, (m) => m.type === 'room-state');
    bob.ws.close();
  });

  it('ignores an oversized JSON text message without crashing', async () => {
    const alice = await connect();
    alice.ws.send(JSON.stringify({ type: 'join', room: 'r', name: 'x'.repeat(100 * 1024), avatarId: 1 }));
    await sleep(200);
    join(alice, 'room-a', 'Alice');
    const state = await waitFor(alice, (m) => m.type === 'room-state');
    expect(state.type).toBe('room-state');
    alice.ws.close();
  });
});

describe('signaling server: relay', () => {
  interface BinaryClient extends Client {
    frames: Uint8Array[];
  }

  async function connectBinary(): Promise<BinaryClient> {
    const client = (await connect()) as BinaryClient;
    client.frames = [];
    client.ws.removeAllListeners('message');
    client.ws.on('message', (raw, isBinary) => {
      if (isBinary) {
        const buf = raw as Buffer;
        client.frames.push(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
      } else {
        client.messages.push(JSON.parse(raw.toString()));
      }
    });
    return client;
  }

  async function joinAs(client: Client, room: string, name: string): Promise<string> {
    join(client, room, name);
    const state = await waitFor(client, (m) => m.type === 'room-state');
    return state.type === 'room-state' ? state.selfId : '';
  }

  it('advertises relay support in room-state', async () => {
    const alice = await connectBinary();
    join(alice, 'room-a', 'Alice');
    expect(await waitFor(alice, (m) => m.type === 'room-state')).toMatchObject({ relay: true });
    alice.ws.close();
  });

  it('forwards a frame to the addressed peer, stamped with the real sender id', async () => {
    const alice = await connectBinary();
    const aliceId = await joinAs(alice, 'room-a', 'Alice');
    const bob = await connectBinary();
    const bobId = await joinAs(bob, 'room-a', 'Bob');

    const payload = new Uint8Array([1, 2, 3, 250]);
    alice.ws.send(encodeRelayFrame(RelayKind.Binary, bobId, payload));

    await vi.waitFor(() => expect(bob.frames).toHaveLength(1));
    const frame = decodeRelayFrame(bob.frames[0]);
    expect(frame).toMatchObject({ kind: RelayKind.Binary, peerId: aliceId });
    expect(frame?.payload).toEqual(payload);
    expect(alice.frames).toHaveLength(0);

    alice.ws.close();
    bob.ws.close();
  });

  it('never relays across rooms, before joining, to yourself, or malformed frames', async () => {
    const alice = await connectBinary();
    const aliceId = await joinAs(alice, 'room-a', 'Alice');
    const carol = await connectBinary();
    await joinAs(carol, 'room-b', 'Carol');
    const lurker = await connectBinary();

    carol.ws.send(encodeRelayFrame(RelayKind.Text, aliceId, new Uint8Array([1])));
    lurker.ws.send(encodeRelayFrame(RelayKind.Text, aliceId, new Uint8Array([2])));
    alice.ws.send(encodeRelayFrame(RelayKind.Text, aliceId, new Uint8Array([3])));
    alice.ws.send(new Uint8Array([99, 1, 2, 3]));
    await sleep(300);

    expect(alice.frames).toHaveLength(0);
    for (const c of [alice, carol, lurker]) c.ws.close();
  });

  it('drops relay traffic entirely when relay is disabled', async () => {
    await server.close();
    await startServer({ relay: false });

    const alice = await connectBinary();
    join(alice, 'room-a', 'Alice');
    expect(await waitFor(alice, (m) => m.type === 'room-state')).toMatchObject({ relay: false });
    const bob = await connectBinary();
    const bobId = await joinAs(bob, 'room-a', 'Bob');

    alice.ws.send(encodeRelayFrame(RelayKind.Text, bobId, new Uint8Array([1])));
    await sleep(300);
    expect(bob.frames).toHaveLength(0);
    alice.ws.close();
    bob.ws.close();
  });

  it('counts relay traffic as liveness, so a busy transfer is never marked stale', async () => {
    await server.close();
    await startServer({ staleCheckIntervalMs: 30, staleAfterMs: 120 });

    const alice = await connectBinary();
    await joinAs(alice, 'room-a', 'Alice');
    const bob = await connectBinary();
    const bobId = await joinAs(bob, 'room-a', 'Bob');
    const bobPinger = setInterval(() => bob.ws.send(JSON.stringify({ type: 'ping' })), 40);

    const sender = setInterval(() => alice.ws.send(encodeRelayFrame(RelayKind.Binary, bobId, new Uint8Array(10))), 40);
    await sleep(400);
    clearInterval(sender);
    clearInterval(bobPinger);

    expect(alice.ws.readyState).toBe(WebSocket.OPEN);
    alice.ws.close();
    bob.ws.close();
  });
});

describe('signaling server: liveness / keepalive', () => {
  // Regression coverage for a real production bug: the server used to track liveness
  // with raw WebSocket ping/pong control frames, which a reverse proxy in front of the
  // deployment (Cloudflare in front of Render) didn't reliably relay — silently killing
  // every connection ~60s in regardless of activity. Liveness is now tracked from real
  // application messages (join/signal/ping) instead, which are guaranteed to travel the
  // same path as ordinary traffic.

  it('replies to an app-level ping with a pong', async () => {
    const alice = await connect();
    join(alice, 'room-a', 'Alice');
    await waitFor(alice, (m) => m.type === 'room-state');

    alice.ws.send(JSON.stringify({ type: 'ping' }));
    const pong = await waitFor(alice, (m) => m.type === 'pong');
    expect(pong).toMatchObject({ type: 'pong' });

    alice.ws.close();
  });

  it('keeps a connection open across multiple stale-check cycles as long as pings keep arriving', async () => {
    await server.close();
    await startServer({ staleCheckIntervalMs: 40, staleAfterMs: 120 });

    const alice = await connect();
    join(alice, 'room-a', 'Alice');
    await waitFor(alice, (m) => m.type === 'room-state');

    // Ping faster than staleAfterMs, for several multiples of the stale-check interval —
    // long enough that the old ping/pong-frame-based heartbeat would have torn this down.
    const pinger = setInterval(() => alice.ws.send(JSON.stringify({ type: 'ping' })), 50);
    await sleep(400);
    clearInterval(pinger);

    expect(alice.ws.readyState).toBe(WebSocket.OPEN);
    alice.ws.close();
  });

  it('terminates a connection that goes silent past staleAfterMs', async () => {
    await server.close();
    await startServer({ staleCheckIntervalMs: 40, staleAfterMs: 120 });

    const alice = await connect();
    join(alice, 'room-a', 'Alice');
    await waitFor(alice, (m) => m.type === 'room-state');

    // Send nothing else — the server should eventually give up on this connection.
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('connection was not terminated as stale')), 2000);
      alice.ws.on('close', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  });
});
