import { CHUNK_SIZE } from '@fluxroom/shared';

/** Streams a File as fixed-size ArrayBuffer chunks without loading the whole file into memory at once. */
export async function* chunksFromFile(
  file: File,
  chunkSize: number = CHUNK_SIZE
): AsyncGenerator<ArrayBuffer> {
  const reader = file.stream().getReader();
  let buffer = new Uint8Array(0);

  while (true) {
    const { done, value } = await reader.read();

    if (value) {
      const merged = new Uint8Array(buffer.byteLength + value.byteLength);
      merged.set(buffer, 0);
      merged.set(value, buffer.byteLength);
      buffer = merged;
    }

    while (buffer.byteLength >= chunkSize) {
      yield buffer.slice(0, chunkSize).buffer as ArrayBuffer;
      buffer = buffer.slice(chunkSize);
    }

    if (done) {
      if (buffer.byteLength > 0) yield buffer.buffer as ArrayBuffer;
      return;
    }
  }
}
