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

/** Generates a memorable, shareable room code like "swift-otter-42". */
export function generateRoomCode(): string {
  const number = Math.floor(Math.random() * 90) + 10;
  return `${pick(ADJECTIVES)}-${pick(NOUNS)}-${number}`;
}
