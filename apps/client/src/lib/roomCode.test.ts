import { describe, it, expect } from 'vitest';
import { generateRoomCode, normalizeRoomCode, MAX_ROOM_CODE_LENGTH } from './roomCode';

describe('normalizeRoomCode', () => {
  it('keeps a valid code unchanged', () => {
    expect(normalizeRoomCode('swift-otter-42')).toBe('swift-otter-42');
  });

  it('extracts the code from a pasted invite link', () => {
    expect(normalizeRoomCode('https://fluxxxroom.vercel.app/r/swift-otter-42')).toBe('swift-otter-42');
    expect(normalizeRoomCode('  fluxxxroom.vercel.app/r/Swift-Otter-42?ref=qr#x ')).toBe('swift-otter-42');
  });

  it('normalizes case, spaces, underscores, and stray characters', () => {
    expect(normalizeRoomCode('  Swift Otter_42! ')).toBe('swift-otter-42');
    expect(normalizeRoomCode('--a---b--')).toBe('a-b');
  });

  it('returns empty for input with nothing usable', () => {
    expect(normalizeRoomCode('')).toBe('');
    expect(normalizeRoomCode('   ')).toBe('');
    expect(normalizeRoomCode('!!!')).toBe('');
  });

  it('caps the length to what the server accepts, without a trailing dash', () => {
    const result = normalizeRoomCode(`${'a'.repeat(63)}-bbbb`);
    expect(result.length).toBeLessThanOrEqual(MAX_ROOM_CODE_LENGTH);
    expect(result.endsWith('-')).toBe(false);
  });
});

describe('generateRoomCode', () => {
  it('produces a 4-digit code, zero-padded, that is already normalized', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateRoomCode();
      expect(code).toMatch(/^\d{4}$/);
      expect(normalizeRoomCode(code)).toBe(code);
    }
  });
});
