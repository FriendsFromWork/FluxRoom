import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import type { AddressInfo } from 'node:net';
import { createSignalingServer, type SignalingServer } from './server.js';
import type { ServerToClient } from '@fluxroom/shared';

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
