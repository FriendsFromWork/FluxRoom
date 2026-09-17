/**
 * Binary framing for traffic relayed through the signaling server when two peers can't
 * open a direct WebRTC connection (e.g. phones on different mobile networks).
 *
 * Layout: [1 byte kind][1 byte peerIdLen][peerIdLen bytes utf8 peerId][payload bytes]
 *
 * Client → server: peerId is the *recipient*. Server → client: the server rewrites it to
 * the *sender*, so a client can never spoof who a relayed message came from.
 */

export const RelayKind = {
  /** UTF-8 JSON DataChannelMessage (chat, text, code, file-meta, file-done). */
  Text: 0,
  /** A file chunk, already framed by encodeChunk. */
  Binary: 1,
  /** Flow control: payload is a float64 (LE) count of relayed bytes received so far. */
  Ack: 2,
} as const;
export type RelayKind = (typeof RelayKind)[keyof typeof RelayKind];

export interface RelayFrame {
  kind: RelayKind;
  peerId: string;
  payload: Uint8Array;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function encodeRelayFrame(kind: RelayKind, peerId: string, payload: Uint8Array): ArrayBuffer {
  const idBytes = textEncoder.encode(peerId);
  if (idBytes.byteLength === 0 || idBytes.byteLength > 255) {
    throw new Error('peerId must be 1-255 bytes');
  }
  const out = new Uint8Array(2 + idBytes.byteLength + payload.byteLength);
  out[0] = kind;
  out[1] = idBytes.byteLength;
  out.set(idBytes, 2);
  out.set(payload, 2 + idBytes.byteLength);
  return out.buffer;
}

/** Returns null for anything malformed, so untrusted input can never throw. */
export function decodeRelayFrame(data: Uint8Array): RelayFrame | null {
  if (data.byteLength < 3) return null;
  const kind = data[0];
  if (kind !== RelayKind.Text && kind !== RelayKind.Binary && kind !== RelayKind.Ack) return null;
  const idLen = data[1];
  if (idLen === 0 || 2 + idLen > data.byteLength) return null;
  const peerId = textDecoder.decode(data.subarray(2, 2 + idLen));
  return { kind, peerId, payload: data.subarray(2 + idLen) };
}

export function encodeAck(receivedBytes: number): Uint8Array {
  const payload = new Uint8Array(8);
  new DataView(payload.buffer).setFloat64(0, receivedBytes, true);
  return payload;
}

export function decodeAck(payload: Uint8Array): number | null {
  if (payload.byteLength !== 8) return null;
  const value = new DataView(payload.buffer, payload.byteOffset, 8).getFloat64(0, true);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function encodeRelayText(json: string): Uint8Array {
  return textEncoder.encode(json);
}

export function decodeRelayText(payload: Uint8Array): string {
  return textDecoder.decode(payload);
}
