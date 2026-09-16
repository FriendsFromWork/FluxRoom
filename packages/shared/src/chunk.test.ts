import { describe, it, expect } from 'vitest';
import { encodeChunk, decodeChunk } from './chunk.js';

function bytesOf(str: string): ArrayBuffer {
  return new TextEncoder().encode(str).buffer as ArrayBuffer;
}

describe('chunk encode/decode', () => {
  it('round-trips fileId, seq, and payload bytes', () => {
    const payload = bytesOf('hello world');
    const framed = encodeChunk('file-123', 42, payload);
    const decoded = decodeChunk(framed);

    expect(decoded.fileId).toBe('file-123');
    expect(decoded.seq).toBe(42);
    expect(new TextDecoder().decode(decoded.bytes)).toBe('hello world');
  });

  it('handles seq 0 and large seq numbers', () => {
    const payload = bytesOf('x');
    expect(decodeChunk(encodeChunk('a', 0, payload)).seq).toBe(0);
    expect(decodeChunk(encodeChunk('a', 4_000_000, payload)).seq).toBe(4_000_000);
  });

  it('handles an empty payload', () => {
    const framed = encodeChunk('empty-file', 1, new ArrayBuffer(0));
    const decoded = decodeChunk(framed);
    expect(decoded.bytes.byteLength).toBe(0);
    expect(decoded.fileId).toBe('empty-file');
  });

  it('preserves binary data that is not valid UTF-8 text', () => {
    const bytes = new Uint8Array([0, 255, 128, 1, 254, 10, 13]);
    const framed = encodeChunk('bin', 7, bytes.buffer);
    const decoded = decodeChunk(framed);
    expect(new Uint8Array(decoded.bytes)).toEqual(bytes);
  });

  it('rejects a fileId longer than 255 bytes', () => {
    const longId = 'x'.repeat(256);
    expect(() => encodeChunk(longId, 0, bytesOf('a'))).toThrow();
  });

  it('distinguishes different fileIds sharing a similar prefix', () => {
    const a = decodeChunk(encodeChunk('id-1', 0, bytesOf('a')));
    const b = decodeChunk(encodeChunk('id-10', 0, bytesOf('b')));
    expect(a.fileId).toBe('id-1');
    expect(b.fileId).toBe('id-10');
  });
});
