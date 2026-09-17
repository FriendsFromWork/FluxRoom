const ADJECTIVES = [
  'swift', 'quiet', 'bold', 'lucid', 'amber', 'coral', 'brisk', 'calm',
  'eager', 'fuzzy', 'giant', 'happy', 'ivory', 'jolly', 'keen', 'lively',
  'misty', 'noble', 'olive', 'proud', 'quick', 'rapid', 'sunny', 'tidy',
  'vivid', 'witty', 'zesty', 'crisp', 'dusky', 'ember',
];

const NOUNS = [
  'otter', 'falcon', 'comet', 'harbor', 'meadow', 'canyon', 'ripple', 'ember',
  'willow', 'summit', 'lagoon', 'sparrow', 'boulder', 'cascade', 'thicket',
  'horizon', 'lantern', 'orchard', 'plateau', 'quartz', 'ridge', 'satchel',
  'tundra', 'valley', 'wren', 'yonder', 'zephyr', 'pebble', 'grove', 'delta',
];

function pick(list: string[]): string {
  return list[Math.floor(Math.random() * list.length)];
}

/** Must match the signaling server's limit on room names. */
export const MAX_ROOM_CODE_LENGTH = 64;

/**
 * Turns whatever someone typed or pasted into a room code: accepts a full invite link
 * (".../r/swift-otter-42"), and normalizes case, whitespace, and stray characters.
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

/** Generates a memorable, shareable room code like "swift-otter-42". */
export function generateRoomCode(): string {
  const number = Math.floor(Math.random() * 90) + 10;
  return `${pick(ADJECTIVES)}-${pick(NOUNS)}-${number}`;
}
