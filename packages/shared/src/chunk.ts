/**
 * Binary framing for file chunks sent over an RTCDataChannel.
 * Layout: [1 byte idLen][idLen bytes utf8 fileId][4 bytes seq (uint32 LE)][payload bytes]
 * Kept out-of-band from the JSON DataChannelMessage protocol so large payloads
 * never pay JSON/base64 encoding overhead.
 */

export interface DecodedChunk {
  fileId: string;
  seq: number;
  bytes: ArrayBuffer;
}

export function encodeChunk(fileId: string, seq: number, bytes: ArrayBuffer): ArrayBuffer {
  const idBytes = new TextEncoder().encode(fileId);
  if (idBytes.byteLength > 255) {
    throw new Error('fileId too long to encode in chunk header');
  }

  const header = new Uint8Array(1 + idBytes.byteLength + 4);
  header[0] = idBytes.byteLength;
  header.set(idBytes, 1);
  new DataView(header.buffer).setUint32(1 + idBytes.byteLength, seq, true);

  const out = new Uint8Array(header.byteLength + bytes.byteLength);
  out.set(header, 0);
  out.set(new Uint8Array(bytes), header.byteLength);
  return out.buffer;
}

export function decodeChunk(buffer: ArrayBuffer): DecodedChunk {
  const view = new DataView(buffer);
  const idLen = view.getUint8(0);
  const idBytes = new Uint8Array(buffer, 1, idLen);
  const fileId = new TextDecoder().decode(idBytes);
  const seq = view.getUint32(1 + idLen, true);
  const bytes = buffer.slice(1 + idLen + 4);
  return { fileId, seq, bytes };
}
