import { describe, it, expect } from 'vitest';
import {
  ChatMessageSchema,
  TextMessageSchema,
  CodeMessageSchema,
  FileMetaSchema,
  DataChannelMessageSchema,
  MAX_PASTE_LENGTH,
} from './dataChannel.js';

const base = { id: 'm1', from: 'Alice', avatarId: 1 as const, ts: Date.now() };

describe('ChatMessageSchema', () => {
  it('accepts a normal chat message', () => {
    expect(ChatMessageSchema.safeParse({ ...base, type: 'chat', text: 'hi' }).success).toBe(true);
  });

  it('rejects empty text', () => {
    expect(ChatMessageSchema.safeParse({ ...base, type: 'chat', text: '' }).success).toBe(false);
  });

  it('rejects text over 4000 characters', () => {
    expect(ChatMessageSchema.safeParse({ ...base, type: 'chat', text: 'a'.repeat(4001) }).success).toBe(false);
  });
});

describe('TextMessageSchema / CodeMessageSchema paste limits', () => {
  it('accepts content exactly at MAX_PASTE_LENGTH', () => {
    const content = 'a'.repeat(MAX_PASTE_LENGTH);
    expect(TextMessageSchema.safeParse({ ...base, type: 'text', content }).success).toBe(true);
    expect(CodeMessageSchema.safeParse({ ...base, type: 'code', lang: 'js', content }).success).toBe(true);
  });

  it('rejects content one character over MAX_PASTE_LENGTH', () => {
    const content = 'a'.repeat(MAX_PASTE_LENGTH + 1);
    expect(TextMessageSchema.safeParse({ ...base, type: 'text', content }).success).toBe(false);
    expect(CodeMessageSchema.safeParse({ ...base, type: 'code', lang: 'js', content }).success).toBe(false);
  });

  it('rejects empty content', () => {
    expect(TextMessageSchema.safeParse({ ...base, type: 'text', content: '' }).success).toBe(false);
  });
});

describe('FileMetaSchema', () => {
  it('accepts zero-byte files', () => {
    const result = FileMetaSchema.safeParse({ ...base, type: 'file-meta', name: 'empty.txt', size: 0, mime: 'text/plain' });
    expect(result.success).toBe(true);
  });

  it('rejects a negative size', () => {
    const result = FileMetaSchema.safeParse({ ...base, type: 'file-meta', name: 'x', size: -1, mime: 'text/plain' });
    expect(result.success).toBe(false);
  });
});

describe('DataChannelMessageSchema union', () => {
  it('discriminates correctly between message kinds', () => {
    expect(DataChannelMessageSchema.safeParse({ ...base, type: 'chat', text: 'hi' }).success).toBe(true);
    expect(DataChannelMessageSchema.safeParse({ ...base, type: 'code', lang: 'ts', content: 'x' }).success).toBe(true);
    expect(DataChannelMessageSchema.safeParse({ id: 'm2', from: 'Bob', type: 'file-done', ts: Date.now() }).success).toBe(
      true
    );
  });

  it('rejects a message with no recognizable type', () => {
    expect(DataChannelMessageSchema.safeParse({ ...base, type: 'unknown' }).success).toBe(false);
  });
});
