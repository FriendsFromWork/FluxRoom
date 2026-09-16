import { useState } from 'react';
import { getAvatarPreset, getAvatarUrl } from '@/lib/avatars';
import { cn } from '@/lib/utils';

interface PixelAvatarProps {
  avatarId: number;
  size?: number;
  className?: string;
}

export function PixelAvatar({ avatarId, size = 36, className }: PixelAvatarProps) {
  const [failed, setFailed] = useState(false);
  const preset = getAvatarPreset(avatarId);

  if (failed) {
    return (
      <div
        className={cn('flex items-center justify-center rounded-full bg-gradient-brand font-semibold text-white', className)}
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        {preset.label[0]}
      </div>
    );
  }

  return (
    <img
      src={getAvatarUrl(avatarId)}
      alt={preset.label}
      width={size}
      height={size}
      draggable={false}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn('rounded-full', className)}
      style={{ width: size, height: size }}
    />
  );
}
