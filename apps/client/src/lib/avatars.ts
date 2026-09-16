/**
 * 8 curated avatar presets — real PNGs downloaded once from DiceBear's public
 * hosted API (https://www.dicebear.com — MIT-licensed, free) using the
 * "notionists" illustrated style, bundled as static assets under
 * public/avatars/. Serving them locally means no runtime network dependency
 * and no hotlink flakiness.
 */

export interface AvatarPreset {
  id: number;
  label: string;
}

export const AVATAR_PRESETS: readonly AvatarPreset[] = [
  { id: 1, label: 'Aiden' },
  { id: 2, label: 'Maya' },
  { id: 3, label: 'Leo' },
  { id: 4, label: 'Zara' },
  { id: 5, label: 'Kai' },
  { id: 6, label: 'Nova' },
  { id: 7, label: 'Ravi' },
  { id: 8, label: 'Iris' },
];

export function getAvatarPreset(id: number): AvatarPreset {
  return AVATAR_PRESETS.find((p) => p.id === id) ?? AVATAR_PRESETS[0];
}

export function getAvatarUrl(id: number): string {
  const preset = getAvatarPreset(id);
  return `/avatars/avatar-${preset.id}.png`;
}
