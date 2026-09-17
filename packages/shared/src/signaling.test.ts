import { describe, it, expect } from 'vitest';
import {
  ClientToServerSchema,
  ServerToClientSchema,
  PeerInfoSchema,
  AvatarIdSchema,
  parseIceServers,
} from './signaling.js';

describe('parseIceServers', () => {
  const turn = { urls: 'turn:relay.example.com:443?transport=tcp', username: 'u', credential: 'c' };

  it('accepts a bare array (TURN provider shape)', () => {
    expect(parseIceServers([{ urls: 'stun:stun.example.com' }, turn])).toEqual([
      { urls: 'stun:stun.example.com' },
      turn,
    ]);
  });

  it('accepts an { iceServers } object and array-valued urls', () => {
    const multi = { urls: ['turn:a:80', 'turns:a:443'], username: 'u', credential: 'c' };
    expect(parseIceServers({ iceServers: [multi] })).toEqual([multi]);
  });

  it('drops malformed entries but keeps valid ones', () => {
    expect(parseIceServers([{ nope: true }, { urls: '' }, turn])).toEqual([turn]);
  });

  it('returns null for unusable input', () => {
    for (const bad of [null, 'x', 42, {}, [], [{ urls: 5 }], { iceServers: 'x' }]) {
      expect(parseIceServers(bad)).toBeNull();
    }
  });
});

describe('keepalive messages', () => {
  it('accepts ping from the client and pong from the server', () => {
    expect(ClientToServerSchema.safeParse({ type: 'ping' }).success).toBe(true);
    expect(ServerToClientSchema.safeParse({ type: 'pong' }).success).toBe(true);
  });
});

describe('AvatarIdSchema', () => {
  it('accepts 1 through 8', () => {
    for (let i = 1; i <= 8; i++) {
      expect(AvatarIdSchema.safeParse(i).success).toBe(true);
    }
  });

  it('rejects 0, 9, negative, and non-integer values', () => {
    for (const bad of [0, 9, -1, 3.5]) {
      expect(AvatarIdSchema.safeParse(bad).success).toBe(false);
    }
  });
});

describe('ClientToServerSchema', () => {
  it('accepts a valid join message', () => {
    const result = ClientToServerSchema.safeParse({ type: 'join', room: 'my-room', name: 'Alice', avatarId: 3 });
    expect(result.success).toBe(true);
  });

  it('rejects a join with an out-of-range avatarId', () => {
    const result = ClientToServerSchema.safeParse({ type: 'join', room: 'my-room', name: 'Alice', avatarId: 99 });
    expect(result.success).toBe(false);
  });

  it('rejects a join with an empty name or room', () => {
    expect(ClientToServerSchema.safeParse({ type: 'join', room: '', name: 'Alice', avatarId: 1 }).success).toBe(false);
    expect(ClientToServerSchema.safeParse({ type: 'join', room: 'r', name: '', avatarId: 1 }).success).toBe(false);
  });

  it('rejects a name or room over the length limit', () => {
    expect(
      ClientToServerSchema.safeParse({ type: 'join', room: 'r', name: 'a'.repeat(41), avatarId: 1 }).success
    ).toBe(false);
    expect(
      ClientToServerSchema.safeParse({ type: 'join', room: 'r'.repeat(65), name: 'Alice', avatarId: 1 }).success
    ).toBe(false);
  });

  it('accepts a valid signal message with an ICE candidate', () => {
    const result = ClientToServerSchema.safeParse({
      type: 'signal',
      to: 'peer-1',
      data: { kind: 'ice-candidate', candidate: 'candidate:foo', sdpMid: '0', sdpMLineIndex: 0 },
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown message type', () => {
    expect(ClientToServerSchema.safeParse({ type: 'hack', room: 'r' }).success).toBe(false);
  });
});

describe('ServerToClientSchema', () => {
  it('accepts a room-state message including selfName', () => {
    const result = ServerToClientSchema.safeParse({
      type: 'room-state',
      selfId: 'id-1',
      selfName: 'Alice (2)',
      room: 'my-room',
      peers: [{ id: 'id-2', name: 'Bob', avatarId: 5 }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects room-state missing selfName (protocol drift guard)', () => {
    const result = ServerToClientSchema.safeParse({
      type: 'room-state',
      selfId: 'id-1',
      room: 'my-room',
      peers: [],
    });
    expect(result.success).toBe(false);
  });
});

describe('PeerInfoSchema', () => {
  it('requires avatarId to be present and valid', () => {
    expect(PeerInfoSchema.safeParse({ id: '1', name: 'Alice' }).success).toBe(false);
    expect(PeerInfoSchema.safeParse({ id: '1', name: 'Alice', avatarId: 4 }).success).toBe(true);
  });
});
