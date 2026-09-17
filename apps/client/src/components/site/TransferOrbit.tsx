import { motion } from 'motion/react';
import { FileUp, MessageSquare, Code2 } from 'lucide-react';
import { PixelAvatar } from '@/components/PixelAvatar';

/**
 * An original hero visual for FluxRoom: two devices with packets (file, message,
 * code) animating back and forth along the direct connection between them —
 * a literal picture of what peer-to-peer sharing actually does, rather than a
 * generic app-screenshot mockup.
 */
const PACKETS = [
  { Icon: FileUp, color: '#ac6aff', delay: 0 },
  { Icon: MessageSquare, color: '#858dff', delay: 1.1 },
  { Icon: Code2, color: '#ff98e2', delay: 2.2 },
];

function Node({ avatarId, label }: { avatarId: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="rounded-full bg-gradient-brand p-1 glow-primary">
        <div className="rounded-full bg-background p-1">
          <PixelAvatar avatarId={avatarId} size={64} className="sm:size-20" />
        </div>
      </div>
      <span className="tagline text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

export function TransferOrbit() {
  return (
    <div className="relative mx-auto flex w-full max-w-md items-center justify-between px-4 py-8 sm:max-w-lg">
      <Node avatarId={2} label="You" />

      {/* Connection line + traveling packets */}
      <div className="relative mx-3 h-px flex-1 sm:mx-6">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-border to-transparent" />
        <motion.div
          className="absolute inset-y-0 left-0 right-0 origin-left bg-gradient-brand"
          style={{ height: 1 }}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: [0, 1, 1, 0], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 3.3, repeat: Infinity, ease: 'easeInOut' }}
        />

        {PACKETS.map(({ Icon, color, delay }, i) => (
          <motion.div
            key={i}
            className="absolute top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full shadow-lg sm:size-9"
            style={{ backgroundColor: color }}
            initial={{ left: '0%', opacity: 0 }}
            animate={{ left: ['0%', '46%', '54%', '100%'], opacity: [0, 1, 1, 0] }}
            transition={{ duration: 3.3, repeat: Infinity, ease: 'easeInOut', delay, times: [0, 0.45, 0.55, 1] }}
          >
            <Icon className="size-4 text-white" />
          </motion.div>
        ))}
      </div>

      <Node avatarId={6} label="Them" />
    </div>
  );
}
