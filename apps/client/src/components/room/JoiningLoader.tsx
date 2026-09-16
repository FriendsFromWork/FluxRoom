import { motion } from 'motion/react';
import { Logo } from '@/components/Logo';
import { PixelAvatar } from '@/components/PixelAvatar';

export function JoiningLoader({ roomId, avatarId }: { roomId: string; avatarId: number }) {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center gap-6 overflow-hidden bg-background px-4">
      <div className="pointer-events-none absolute -left-40 -top-40 size-96 rounded-full bg-primary/25 glow-blob" />
      <div className="pointer-events-none absolute -right-40 bottom-0 size-96 rounded-full bg-[oklch(0.62_0.24_300)]/20 glow-blob" />
      <div className="relative flex items-center justify-center">
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.15, 0.5] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute size-20 rounded-full bg-primary/30"
        />
        <motion.div
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Logo size={64} />
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="flex flex-col items-center gap-3"
      >
        <PixelAvatar avatarId={avatarId} size={44} />
        <p className="text-sm text-muted-foreground">
          Joining <span className="font-medium text-foreground">{roomId}</span>
          <motion.span
            aria-hidden
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          >
            …
          </motion.span>
        </p>
      </motion.div>
    </div>
  );
}
