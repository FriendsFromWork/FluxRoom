/** Must match the signaling server's limit on room names. */
export const MAX_ROOM_CODE_LENGTH = 64;

/**
 * Turns whatever someone typed or pasted into a room code: accepts a full invite link
 * (".../r/4821"), and normalizes case, whitespace, and stray characters.
 * Returns '' if nothing usable remains.
 */
export function normalizeRoomCode(input: string): string {
  let value = input.trim();
  const linkMatch = value.match(/\/r\/([^/?#\s]+)/i);
  if (linkMatch) {
    try {
      value = decodeURIComponent(linkMatch[1]);
    } catch {
      value = linkMatch[1];
    }
  }

  return value
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_ROOM_CODE_LENGTH)
    .replace(/-+$/, '');
}

/** Generates a shareable 4-digit room code, e.g. "0482". */
export function generateRoomCode(): string {
  const number = Math.floor(Math.random() * 10_000);
  return String(number).padStart(4, '0');
}
