import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createSignalingServer, type SignalingServer, type SignalingServerOptions } from '../../../server/src/server';
import { RoomConnection, type RoomConnectionEvents, type RoomConnectionOptions } from './roomConnection';

// ---------------------------------------------------------------------------
// A tiny in-memory WebRTC stand-in. Offer/answer SDPs carry the fake connection's id,
// so applying an answer pairs the two sides' data channels and "connects" them.
//
// Every connection lives on a mock network. Two clients on the same network (same Wi-Fi,
// same device) connect directly; clients on different networks never do — exactly what
// carrier-grade NAT does to two phones on different mobile operators.
// ---------------------------------------------------------------------------

class FakeDataChannel extends EventTarget {
  static stallSends = false;
  readyState: RTCDataChannelState = 'connecting';
  binaryType = 'blob';
  bufferedAmount = 0;
  bufferedAmountLowThreshold = 0;
  partner: FakeDataChannel | null = null;

  constructor(readonly label: string) {
    super();
  }

  send(data: string | ArrayBuffer): void {
    if (this.readyState !== 'open') throw new Error('InvalidStateError');
    if (FakeDataChannel.stallSends) {
      this.bufferedAmount += typeof data === 'string' ? data.length : data.byteLength;
    }
    const partner = this.partner;
    queueMicrotask(() => {
      if (partner?.readyState === 'open') partner.dispatchEvent(new MessageEvent('message', { data }));
    });
  }

  open(): void {
    this.readyState = 'open';
    this.dispatchEvent(new Event('open'));
  }

  close(): void {
    if (this.readyState === 'closed') return;
    this.readyState = 'closed';
    const partner = this.partner;
    setTimeout(() => {
      this.dispatchEvent(new Event('close'));
      if (partner && partner.readyState !== 'closed') {
        partner.readyState = 'closed';
        partner.dispatchEvent(new Event('close'));
      }
    }, 0);
  }
}

const fakePcs = new Map<string, FakePeerConnection>();
let fakePcCounter = 0;

class FakePeerConnection extends EventTarget {
  static blockConnections = false;
  static offers: Array<{ iceRestart: boolean }> = [];
  static configs: RTCConfiguration[] = [];

  readonly fakeId = `pc${++fakePcCounter}`;
  connectionState: RTCPeerConnectionState = 'new';
  localDescription: RTCSessionDescriptionInit | null = null;
  ownChannel: FakeDataChannel | null = null;

  constructor(
    config: RTCConfiguration | undefined,
    readonly network: string
  ) {
    super();
    fakePcs.set(this.fakeId, this);
    if (config) FakePeerConnection.configs.push(config);
  }

  createDataChannel(label: string): FakeDataChannel {
    this.ownChannel = new FakeDataChannel(label);
    return this.ownChannel;
  }

  async createOffer(options?: RTCOfferOptions): Promise<RTCSessionDescriptionInit> {
    FakePeerConnection.offers.push({ iceRestart: Boolean(options?.iceRestart) });
    return { type: 'offer', sdp: `offer:${this.fakeId}` };
  }

  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    return { type: 'answer', sdp: `answer:${this.fakeId}` };
  }

  async setLocalDescription(description: RTCSessionDescriptionInit): Promise<void> {
    this.localDescription = description;
  }

  async setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
    if (description.type !== 'answer' || FakePeerConnection.blockConnections) return;
    const answerer = fakePcs.get(String(description.sdp).split(':')[1]);
    const local = this.ownChannel;
    if (!answerer || !local || local.readyState === 'open' || this.connectionState === 'closed') return;
    if (answerer.network !== this.network) {
      // No route between NATed networks: ICE eventually gives up.
      setTimeout(() => {
        for (const pc of [this, answerer]) {
          if (pc.connectionState === 'closed') continue;
          pc.connectionState = 'failed';
          pc.dispatchEvent(new Event('connectionstatechange'));
        }
      }, 30);
      return;
    }

    const remote = new FakeDataChannel(local.label);
    local.partner = remote;
    remote.partner = local;
    setTimeout(() => {
      answerer.dispatchEvent(Object.assign(new Event('datachannel'), { channel: remote }));
      local.open();
      remote.open();
      for (const pc of [this, answerer]) {
        pc.connectionState = 'connected';
        pc.dispatchEvent(new Event('connectionstatechange'));
      }
    }, 0);
  }

  async addIceCandidate(): Promise<void> {}

  close(): void {
    this.connectionState = 'closed';
  }
}

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

type RecordedEvent = { [K in keyof RoomConnectionEvents]: { type: K; payload: RoomConnectionEvents[K] } }[keyof RoomConnectionEvents];

interface Client {
  conn: RoomConnection;
  events: RecordedEvent[];
}

const EVENT_NAMES: Array<keyof RoomConnectionEvents> = [
  'self-joined',
  'peer-update',
  'peer-removed',
  'feed-item',
  'feed-item-update',
  'reconnecting',
  'error',
];

let server: SignalingServer;
let wsUrl: string;
const clients: Client[] = [];

async function startServer(options: SignalingServerOptions = {}): Promise<void> {
  server = createSignalingServer(options);
  await new Promise<void>((resolve) => server.httpServer.listen(0, '127.0.0.1', resolve));
  wsUrl = `ws://127.0.0.1:${(server.httpServer.address() as AddressInfo).port}`;
}

const FAST: RoomConnectionOptions = {
  keepaliveIntervalMs: 1_000,
  pongTimeoutMs: 1_000,
  joinTimeoutMs: 2_000,
  reconnectBaseDelayMs: 20,
  reconnectMaxDelayMs: 100,
  peerConnectTimeoutMs: 2_000,
  iceFetchTimeoutMs: 1_000,
};

const HOME_WIFI = 'home-wifi';
const MOBILE_A = 'carrier-a-4g';
const MOBILE_B = 'carrier-b-5g';

function join(name: string, room = 'room-1', options: RoomConnectionOptions = {}, network = HOME_WIFI): Client {
  const conn = new RoomConnection({
    ...FAST,
    createPeerConnection: (config) => new FakePeerConnection(config, network) as unknown as RTCPeerConnection,
    ...options,
  });
  const events: RecordedEvent[] = [];
  for (const type of EVENT_NAMES) {
    conn.on(type, (payload) => events.push({ type, payload } as RecordedEvent));
  }
  conn.connect(wsUrl, room, name, 1);
  const client = { conn, events };
  clients.push(client);
  return client;
}

async function until(predicate: () => boolean, timeoutMs = 4_000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('condition not met in time');
    await new Promise((r) => setTimeout(r, 10));
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function eventsOf<K extends keyof RoomConnectionEvents>(client: Client, type: K): RoomConnectionEvents[K][] {
  return client.events.filter((e) => e.type === type).map((e) => e.payload as RoomConnectionEvents[K]);
}

function selfId(client: Client): string | undefined {
  return eventsOf(client, 'self-joined').at(-1)?.selfId;
}

/** Latest status each peer id was reported with (ignoring peers since removed). */
function peerStatuses(client: Client): Map<string, string> {
  const statuses = new Map<string, string>();
  for (const event of client.events) {
    if (event.type === 'peer-update') statuses.set(event.payload.id, event.payload.status);
    if (event.type === 'peer-removed') statuses.delete(event.payload.id);
  }
  return statuses;
}

function connectedTo(client: Client, other: Client): boolean {
  const id = selfId(other);
  return id !== undefined && peerStatuses(client).get(id) === 'connected';
}

async function joinPair(options: RoomConnectionOptions = {}): Promise<[Client, Client]> {
  const alice = join('Alice', 'room-1', options);
  await until(() => selfId(alice) !== undefined);
  const bob = join('Bob', 'room-1', options);
  await until(() => connectedTo(alice, bob) && connectedTo(bob, alice));
  return [alice, bob];
}

beforeEach(async () => {
  FakeDataChannel.stallSends = false;
  FakePeerConnection.blockConnections = false;
  FakePeerConnection.offers = [];
  FakePeerConnection.configs = [];
  fakePcs.clear();
  await startServer();
});

afterEach(async () => {
  for (const client of clients.splice(0)) client.conn.disconnect();
  vi.restoreAllMocks();
  if (server.httpServer.listening) await server.close();
});

// ---------------------------------------------------------------------------

describe('RoomConnection: joining and messaging', () => {
  it('connects two peers and delivers chat, text, and code both ways', async () => {
    const [alice, bob] = await joinPair();

    alice.conn.sendChat('hi bob');
    bob.conn.sendText('a longer block of text');
    bob.conn.sendCode('typescript', 'const x = 1;');

    await until(() => eventsOf(bob, 'feed-item').some((i) => i.kind === 'chat' && !i.self && i.text === 'hi bob'));
    await until(() => eventsOf(alice, 'feed-item').some((i) => i.kind === 'text' && !i.self));
    await until(() =>
      eventsOf(alice, 'feed-item').some((i) => i.kind === 'code' && i.lang === 'typescript' && i.content === 'const x = 1;')
    );

    const bobsChat = eventsOf(bob, 'feed-item').find((i) => i.kind === 'chat');
    expect(bobsChat).toMatchObject({ from: 'Alice', self: false });
  });

  it('passes TURN relays from the server into every peer connection', async () => {
    await server.close();
    const relay = { urls: 'turn:relay.example.com:443?transport=tcp', username: 'u', credential: 'c' };
    await startServer({ iceServers: async () => [relay] });

    await joinPair();
    expect(FakePeerConnection.configs.length).toBeGreaterThanOrEqual(2);
    for (const config of FakePeerConnection.configs) {
      expect(config.iceServers).toContainEqual(relay);
    }
  });

  it('still joins (STUN only) when the ICE server endpoint is unreachable', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    const [alice] = await joinPair();
    expect(fetchSpy).toHaveBeenCalled();
    expect(selfId(alice)).toBeDefined();
  });
});

describe('RoomConnection: file transfer', () => {
  it('transfers a file intact, with throttled progress updates', async () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL');
    const [alice, bob] = await joinPair();

    const bytes = new Uint8Array(300 * 1024).map((_, i) => i % 251);
    await alice.conn.sendFile(new File([bytes], 'data.bin', { type: 'application/octet-stream' }));

    await until(() => eventsOf(bob, 'feed-item-update').some((u) => 'status' in u && u.status === 'done'));
    expect(eventsOf(alice, 'feed-item-update').at(-1)).toMatchObject({ status: 'done', progress: 1 });

    const received = createObjectURL.mock.calls.map(([blob]) => blob as Blob).find((b) => b.size === bytes.length && !(b instanceof File));
    expect(received).toBeDefined();
    expect(new Uint8Array(await received!.arrayBuffer())).toEqual(bytes);

    const progressUpdates = eventsOf(bob, 'feed-item-update').filter((u) => 'progress' in u);
    expect(progressUpdates.length).toBeLessThanOrEqual(102);
  });

  it('marks an outgoing file failed (instead of hanging) when the receiver vanishes mid-transfer', async () => {
    const [alice, bob] = await joinPair();
    FakeDataChannel.stallSends = true;

    const sending = alice.conn.sendFile(new File([new Uint8Array(5 * 1024 * 1024)], 'big.bin'));
    await sleep(50);
    bob.conn.disconnect();

    await Promise.race([sending, sleep(3_000).then(() => Promise.reject(new Error('sendFile hung')))]);
    expect(eventsOf(alice, 'feed-item-update').at(-1)).toMatchObject({ status: 'failed' });
  });

  it('marks an incoming file failed when the sender leaves mid-transfer', async () => {
    const [alice, bob] = await joinPair();
    FakeDataChannel.stallSends = true;

    void alice.conn.sendFile(new File([new Uint8Array(5 * 1024 * 1024)], 'big.bin'));
    await until(() => eventsOf(bob, 'feed-item').some((i) => i.kind === 'file'));
    alice.conn.disconnect();

    await until(() => eventsOf(bob, 'feed-item-update').some((u) => 'status' in u && u.status === 'failed'));
  });
});

describe('RoomConnection: roster correctness', () => {
  it('does not leave a ghost "disconnected" peer behind after someone leaves', async () => {
    const [alice, bob] = await joinPair();
    const bobId = selfId(bob)!;

    bob.conn.disconnect();
    await until(() => eventsOf(alice, 'peer-removed').some((p) => p.id === bobId));
    const removedAt = alice.events.findIndex((e) => e.type === 'peer-removed' && e.payload.id === bobId);

    await sleep(150); // let every late channel/connection event fire
    const lateUpdates = alice.events.slice(removedAt + 1).filter((e) => e.type === 'peer-update' && e.payload.id === bobId);
    expect(lateUpdates).toEqual([]);
    expect(peerStatuses(alice).has(bobId)).toBe(false);
    expect(eventsOf(alice, 'feed-item').some((i) => i.kind === 'system' && i.text === 'Bob left the room')).toBe(true);
  });

  it('shows only the new entry when a peer refreshes the page (leave + rejoin)', async () => {
    const [alice, bob] = await joinPair();
    const oldBobId = selfId(bob)!;

    bob.conn.disconnect();
    const bob2 = join('Bob');
    await until(() => connectedTo(alice, bob2) && connectedTo(bob2, alice));
    await sleep(150);

    const statuses = peerStatuses(alice);
    expect(statuses.has(oldBobId)).toBe(false);
    expect([...statuses.values()]).toEqual(['connected']);
  });

  it('reports a peer as failed when no route exists and the server does not relay, after trying ICE restarts', async () => {
    await server.close();
    await startServer({ relay: false });
    FakePeerConnection.blockConnections = true;
    const options = { peerConnectTimeoutMs: 60 };
    const alice = join('Alice', 'room-1', options);
    await until(() => selfId(alice) !== undefined);
    const bob = join('Bob', 'room-1', options);
    await until(() => selfId(bob) !== undefined);

    await until(() => peerStatuses(alice).get(selfId(bob)!) === 'failed');
    await until(() => peerStatuses(bob).get(selfId(alice)!) === 'failed');
    expect(FakePeerConnection.offers.filter((o) => o.iceRestart)).toHaveLength(2);
  });
});

describe('RoomConnection: signaling resilience', () => {
  it('keeps the signaling socket open indefinitely with app-level keepalives', async () => {
    await server.close();
    await startServer({ staleCheckIntervalMs: 20, staleAfterMs: 150 });

    const [alice, bob] = await joinPair({ keepaliveIntervalMs: 40 });
    await sleep(600);

    expect(eventsOf(alice, 'reconnecting')).toEqual([]);
    expect(eventsOf(bob, 'reconnecting')).toEqual([]);
    expect(connectedTo(alice, bob)).toBe(true);
  });

  it('reconnects automatically after the signaling socket drops, and rebuilds the peer link', async () => {
    const [alice, bob] = await joinPair();
    const aliceFirstId = selfId(alice)!;

    server.registry.get('room-1')!.peers.get(aliceFirstId)!.ws.terminate();

    await until(() => eventsOf(alice, 'reconnecting').length > 0);
    await until(() => selfId(alice) !== aliceFirstId && selfId(alice) !== undefined);
    await until(() => connectedTo(alice, bob) && connectedTo(bob, alice));
    expect(eventsOf(alice, 'self-joined').at(-1)?.selfName).toBe('Alice');

    alice.conn.sendChat('back online');
    await until(() => eventsOf(bob, 'feed-item').some((i) => i.kind === 'chat' && i.text === 'back online'));
  });

  it('keeps retrying while the server is down, then joins once it is back', async () => {
    const port = (server.httpServer.address() as AddressInfo).port;
    await server.close();

    const alice = join('Alice');
    await until(() => eventsOf(alice, 'reconnecting').length >= 2);
    expect(selfId(alice)).toBeUndefined();

    server = createSignalingServer();
    await new Promise<void>((resolve) => server.httpServer.listen(port, '127.0.0.1', resolve));
    await until(() => selfId(alice) !== undefined, 6_000);
    expect(eventsOf(alice, 'error')).toEqual([]);
  });

  it('treats a full room as a final error and stops retrying', async () => {
    await server.close();
    await startServer({ maxPeersPerRoom: 1 });

    const alice = join('Alice');
    await until(() => selfId(alice) !== undefined);
    const bob = join('Bob');

    await until(() => eventsOf(bob, 'error').length === 1);
    expect(eventsOf(bob, 'error')[0].message).toMatch(/full/i);
    await sleep(200);
    expect(eventsOf(bob, 'reconnecting')).toEqual([]);
    expect(server.registry.get('room-1')!.peers.size).toBe(1);
  });

  it('goes completely silent after disconnect()', async () => {
    const [alice, bob] = await joinPair();
    alice.conn.disconnect();
    const count = alice.events.length;

    bob.conn.sendChat('anyone?');
    await server.close();
    await startServer();
    await sleep(300);

    expect(alice.events.length).toBe(count);
  });
});

// ---------------------------------------------------------------------------
// Two (and three) mock networks: the real-world failure this app hit in production —
// sessions on one device or one Wi-Fi worked, phones on different mobile networks didn't.
// ---------------------------------------------------------------------------

/** Counts binary WebSocket frames every client sends, i.e. traffic going through the relay. */
function countRelayedFrames(): () => number {
  const spy = vi.spyOn(WebSocket.prototype, 'send');
  return () => spy.mock.calls.filter(([data]) => data instanceof ArrayBuffer).length;
}

async function joinOn(name: string, network: string, options: RoomConnectionOptions = {}): Promise<Client> {
  const client = join(name, 'room-1', { peerConnectTimeoutMs: 150, ...options }, network);
  await until(() => selfId(client) !== undefined);
  return client;
}

function statusOf(client: Client, other: Client): string | undefined {
  return peerStatuses(client).get(selfId(other)!);
}

describe('two mock networks', () => {
  it('same network: connects directly and sends nothing through the server', async () => {
    const relayed = countRelayedFrames();
    const alice = await joinOn('Alice', HOME_WIFI);
    const bob = await joinOn('Bob', HOME_WIFI);
    await until(() => statusOf(alice, bob) === 'connected' && statusOf(bob, alice) === 'connected');

    alice.conn.sendChat('same wifi');
    await alice.conn.sendFile(new File([new Uint8Array(200 * 1024)], 'local.bin'));
    await until(() => eventsOf(bob, 'feed-item-update').some((u) => 'status' in u && u.status === 'done'));
    expect(eventsOf(bob, 'feed-item').some((i) => i.kind === 'chat' && i.text === 'same wifi')).toBe(true);

    expect(relayed()).toBe(0);
  });

  it('different mobile networks: both sides fall back to the server relay', async () => {
    const alice = await joinOn('Alice', MOBILE_A);
    const bob = await joinOn('Bob', MOBILE_B);

    await until(() => statusOf(alice, bob) === 'relayed' && statusOf(bob, alice) === 'relayed');
    expect(FakePeerConnection.offers.some((o) => o.iceRestart)).toBe(true); // direct was still retried
  });

  it('different networks: chat, text, and code are delivered both ways', async () => {
    const relayed = countRelayedFrames();
    const alice = await joinOn('Alice', MOBILE_A);
    const bob = await joinOn('Bob', MOBILE_B);
    await until(() => statusOf(alice, bob) === 'relayed' && statusOf(bob, alice) === 'relayed');

    alice.conn.sendChat('hello from carrier A');
    bob.conn.sendChat('hello from carrier B');
    alice.conn.sendText('नमस्ते — non-ASCII survives the relay 👋'.repeat(50));
    bob.conn.sendCode('python', 'print("relayed")');

    await until(() => eventsOf(bob, 'feed-item').some((i) => i.kind === 'chat' && i.text === 'hello from carrier A'));
    await until(() => eventsOf(alice, 'feed-item').some((i) => i.kind === 'chat' && i.text === 'hello from carrier B'));
    await until(() => eventsOf(bob, 'feed-item').some((i) => i.kind === 'text' && i.content.startsWith('नमस्ते')));
    await until(() => eventsOf(alice, 'feed-item').some((i) => i.kind === 'code' && i.lang === 'python'));

    const bobsChat = eventsOf(bob, 'feed-item').find((i) => i.kind === 'chat' && !i.self);
    expect(bobsChat).toMatchObject({ from: 'Alice', self: false });
    expect(relayed()).toBeGreaterThanOrEqual(4);
  });

  it('different networks: a message sent the instant someone joins is not lost while the connection is still being set up', async () => {
    const alice = await joinOn('Alice', MOBILE_A, { peerConnectTimeoutMs: 5_000 });
    const bob = await joinOn('Bob', MOBILE_B, { peerConnectTimeoutMs: 5_000 });
    await until(() => statusOf(alice, bob) === 'connecting');

    alice.conn.sendChat('sent before any route was decided');
    await until(() => eventsOf(bob, 'feed-item').some((i) => i.kind === 'chat' && i.text === 'sent before any route was decided'));
  });

  it('different networks: a multi-megabyte file arrives byte-for-byte intact via the relay', async () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL');
    const alice = await joinOn('Alice', MOBILE_A);
    const bob = await joinOn('Bob', MOBILE_B);
    await until(() => statusOf(alice, bob) === 'relayed' && statusOf(bob, alice) === 'relayed');

    const bytes = new Uint8Array(3 * 1024 * 1024 + 12_345).map((_, i) => (i * 31) % 256);
    await alice.conn.sendFile(new File([bytes], 'photo.jpg', { type: 'image/jpeg' }));

    await until(() => eventsOf(bob, 'feed-item-update').some((u) => 'status' in u && u.status === 'done'), 15_000);
    expect(eventsOf(alice, 'feed-item-update').at(-1)).toMatchObject({ status: 'done', progress: 1 });

    const received = createObjectURL.mock.calls
      .map(([blob]) => blob as Blob)
      .find((b) => !(b instanceof File) && b.size === bytes.length);
    expect(received?.type).toBe('image/jpeg');
    expect(sameBytes(new Uint8Array(await received!.arrayBuffer()), bytes)).toBe(true);
  }, 20_000);

  it('different networks: files sent in both directions at once both arrive intact', async () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL');
    const alice = await joinOn('Alice', MOBILE_A);
    const bob = await joinOn('Bob', MOBILE_B);
    await until(() => statusOf(alice, bob) === 'relayed' && statusOf(bob, alice) === 'relayed');

    const a = new Uint8Array(1_500_000).map((_, i) => i % 7);
    const b = new Uint8Array(1_700_000).map((_, i) => i % 11);
    await Promise.all([
      alice.conn.sendFile(new File([a], 'a.bin')),
      bob.conn.sendFile(new File([b], 'b.bin')),
    ]);

    const doneFor = (c: Client) => eventsOf(c, 'feed-item-update').some((u) => 'status' in u && u.status === 'done' && 'blobUrl' in u);
    await until(() => doneFor(alice) && doneFor(bob), 15_000);

    const blobs = createObjectURL.mock.calls.map(([blob]) => blob as Blob).filter((x) => !(x instanceof File));
    expect(sameBytes(new Uint8Array(await blobs.find((x) => x.size === a.length)!.arrayBuffer()), a)).toBe(true);
    expect(sameBytes(new Uint8Array(await blobs.find((x) => x.size === b.length)!.arrayBuffer()), b)).toBe(true);
  }, 20_000);

  it('mixed room: people on the same Wi-Fi go direct while the phone on mobile data is relayed', async () => {
    const alice = await joinOn('Alice', HOME_WIFI);
    const bob = await joinOn('Bob', HOME_WIFI);
    const carol = await joinOn('Carol', MOBILE_A);

    await until(
      () =>
        statusOf(alice, bob) === 'connected' &&
        statusOf(bob, alice) === 'connected' &&
        statusOf(alice, carol) === 'relayed' &&
        statusOf(carol, alice) === 'relayed' &&
        statusOf(bob, carol) === 'relayed' &&
        statusOf(carol, bob) === 'relayed'
    );

    carol.conn.sendChat('hi from mobile data');
    alice.conn.sendChat('hi from wifi');
    for (const reader of [alice, bob]) {
      await until(() => eventsOf(reader, 'feed-item').some((i) => i.kind === 'chat' && i.text === 'hi from mobile data'));
    }
    for (const reader of [bob, carol]) {
      await until(() => eventsOf(reader, 'feed-item').some((i) => i.kind === 'chat' && i.text === 'hi from wifi'));
    }
  });

  it('switching networks mid-session (direct link drops): falls back to the relay and keeps delivering', async () => {
    const alice = await joinOn('Alice', HOME_WIFI);
    const bob = await joinOn('Bob', HOME_WIFI);
    await until(() => statusOf(alice, bob) === 'connected' && statusOf(bob, alice) === 'connected');

    // The direct link dies, as when a phone leaves Wi-Fi for mobile data.
    const offerer = [...fakePcs.values()].find((pc) => pc.ownChannel?.readyState === 'open');
    offerer!.ownChannel!.close();

    await until(() => statusOf(alice, bob) === 'relayed' && statusOf(bob, alice) === 'relayed');
    bob.conn.sendChat('still here after the switch');
    await until(() => eventsOf(alice, 'feed-item').some((i) => i.kind === 'chat' && i.text === 'still here after the switch'));
  });

  it('different networks: a relayed send fails cleanly (no hang) when the receiver leaves mid-transfer', async () => {
    const alice = await joinOn('Alice', MOBILE_A);
    const bob = await joinOn('Bob', MOBILE_B);
    await until(() => statusOf(alice, bob) === 'relayed' && statusOf(bob, alice) === 'relayed');

    const sending = alice.conn.sendFile(new File([new Uint8Array(20 * 1024 * 1024)], 'huge.bin'));
    await until(() => eventsOf(bob, 'feed-item').some((i) => i.kind === 'file'));
    bob.conn.disconnect();

    await Promise.race([sending, sleep(5_000).then(() => Promise.reject(new Error('relayed sendFile hung')))]);
    expect(eventsOf(alice, 'feed-item-update').at(-1)).toMatchObject({ status: 'failed' });
  });

  it('different networks: the sender waits for acks, so the server never holds much more than the flow-control window', async () => {
    const alice = await joinOn('Alice', MOBILE_A);
    const bob = await joinOn('Bob', MOBILE_B);
    await until(() => statusOf(alice, bob) === 'relayed' && statusOf(bob, alice) === 'relayed');

    // Freeze Bob's client (a phone that stopped reading): nothing he receives is processed, so he never acks.
    const bobConn = bob.conn as unknown as { handleRelayFrame: (buffer: ArrayBuffer) => void };
    bobConn.handleRelayFrame = () => {};

    const sentBytes = countRelayedBytes();
    void alice.conn.sendFile(new File([new Uint8Array(10 * 1024 * 1024)], 'big.bin'));
    await sleep(800);

    // 1 MB window + at most one 64 KB chunk and small framing overhead.
    expect(sentBytes()).toBeLessThan(1.2 * 1024 * 1024);
    expect(sentBytes()).toBeGreaterThan(900 * 1024);
  });

  it('relay disabled on the server: different networks cannot talk, and the UI is told so', async () => {
    await server.close();
    await startServer({ relay: false });
    const alice = await joinOn('Alice', MOBILE_A);
    const bob = await joinOn('Bob', MOBILE_B);

    await until(() => statusOf(alice, bob) === 'failed' && statusOf(bob, alice) === 'failed');
    expect(eventsOf(alice, 'self-joined').at(-1)?.relay).toBe(false);
  });
});

/** Fast byte-for-byte comparison; a deep-equality matcher over millions of elements is far too slow. */
function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return Buffer.from(a.buffer, a.byteOffset, a.byteLength).equals(Buffer.from(b.buffer, b.byteOffset, b.byteLength));
}

function countRelayedBytes(): () => number {
  const spy = vi.spyOn(WebSocket.prototype, 'send');
  return () =>
    spy.mock.calls.reduce((sum, [data]) => sum + (data instanceof ArrayBuffer ? data.byteLength : 0), 0);
}
