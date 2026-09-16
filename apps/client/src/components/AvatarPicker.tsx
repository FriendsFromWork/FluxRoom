import { motion } from 'motion/react';
import { AVATAR_PRESETS } from '@/lib/avatars';
import { PixelAvatar } from '@/components/PixelAvatar';
import { cn } from '@/lib/utils';

interface AvatarPickerProps {
  value: number;
  onChange: (id: number) => void;
}

export function AvatarPicker({ value, onChange }: AvatarPickerProps) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {AVATAR_PRESETS.map((preset) => {
        const selected = preset.id === value;
        return (
          <motion.button
            key={preset.id}
            type="button"
            aria-label={preset.label}
            aria-pressed={selected}
            onClick={() => onChange(preset.id)}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            className="relative flex items-center justify-center rounded-full"
          >
            {selected && (
              <motion.span
                layoutId="avatar-selection-ring"
                className="absolute -inset-1 rounded-full bg-gradient-brand"
                transition={{ type: 'spring', stiffness: 500, damping: 32 }}
              />
            )}
            <span className={cn('relative rounded-full p-0.5', selected && 'bg-background')}>
              <PixelAvatar avatarId={preset.id} size={48} />
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
