import { describe, it, expect } from 'vitest';
import {
  RelayKind,
  encodeRelayFrame,
  decodeRelayFrame,
  encodeAck,
  decodeAck,
  encodeRelayText,
  decodeRelayText,
} from './relay.js';

describe('relay frames', () => {
  it('round-trips kind, peer id, and payload', () => {
    const payload = new Uint8Array([0, 255, 7, 128]);
    const frame = decodeRelayFrame(new Uint8Array(encodeRelayFrame(RelayKind.Binary, 'peer-abc', payload)));
    expect(frame?.kind).toBe(RelayKind.Binary);
    expect(frame?.peerId).toBe('peer-abc');
    expect(frame?.payload).toEqual(payload);
  });

  it('round-trips UTF-8 text including non-ASCII', () => {
    const json = JSON.stringify({ type: 'chat', text: 'नमस्ते 👋' });
    const frame = decodeRelayFrame(new Uint8Array(encodeRelayFrame(RelayKind.Text, 'p', encodeRelayText(json))));
    expect(decodeRelayText(frame!.payload)).toBe(json);
  });

  it('allows an empty payload', () => {
    const frame = decodeRelayFrame(new Uint8Array(encodeRelayFrame(RelayKind.Text, 'p', new Uint8Array(0))));
    expect(frame?.payload.byteLength).toBe(0);
  });

  it('rejects malformed input instead of throwing', () => {
    expect(decodeRelayFrame(new Uint8Array([]))).toBeNull();
    expect(decodeRelayFrame(new Uint8Array([9, 1, 65]))).toBeNull(); // unknown kind
    expect(decodeRelayFrame(new Uint8Array([0, 0, 65]))).toBeNull(); // empty id
    expect(decodeRelayFrame(new Uint8Array([0, 50, 65, 66]))).toBeNull(); // id longer than frame
  });

  it('rejects peer ids that cannot be encoded', () => {
    expect(() => encodeRelayFrame(RelayKind.Text, '', new Uint8Array(0))).toThrow();
    expect(() => encodeRelayFrame(RelayKind.Text, 'x'.repeat(256), new Uint8Array(0))).toThrow();
  });

  it('decodes a frame that sits at an offset inside a larger buffer (as Node delivers it)', () => {
    const encoded = new Uint8Array(encodeRelayFrame(RelayKind.Ack, 'id-1', encodeAck(42)));
    const host = new Uint8Array(encoded.byteLength + 10);
    host.set(encoded, 5);
    const frame = decodeRelayFrame(host.subarray(5, 5 + encoded.byteLength));
    expect(frame?.peerId).toBe('id-1');
    expect(decodeAck(frame!.payload)).toBe(42);
  });
});

describe('acks', () => {
  it('round-trips byte counts beyond 32 bits', () => {
    expect(decodeAck(encodeAck(0))).toBe(0);
    expect(decodeAck(encodeAck(5 * 1024 ** 3))).toBe(5 * 1024 ** 3);
  });

  it('rejects wrong sizes and invalid values', () => {
    expect(decodeAck(new Uint8Array(4))).toBeNull();
    expect(decodeAck(encodeAck(-1))).toBeNull();
    expect(decodeAck(encodeAck(Number.NaN))).toBeNull();
  });
});
