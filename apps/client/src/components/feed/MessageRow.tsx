import { motion } from 'motion/react';
import { PixelAvatar } from '@/components/PixelAvatar';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';

interface MessageRowProps {
  avatarId: number;
  from: string;
  self: boolean;
  ts: number;
  showHeader: boolean;
  children: React.ReactNode;
}

export function MessageRow({ avatarId, from, self, ts, showHeader, children }: MessageRowProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className={cn('flex gap-3', showHeader ? 'mt-5' : 'mt-1', self && 'flex-row-reverse')}
    >
      <div className="w-8 shrink-0 sm:w-9">
        {showHeader && (
          <div className={cn('rounded-full p-0.5', self ? 'bg-gradient-brand' : 'bg-border')}>
            <div className="rounded-full bg-background p-0.5">
              <PixelAvatar avatarId={avatarId} size={28} />
            </div>
          </div>
        )}
      </div>

      <div className={cn('flex min-w-0 max-w-[85%] flex-col gap-1.5 sm:max-w-[75%]', self && 'items-end')}>
        {showHeader && (
          <div className={cn('flex items-baseline gap-2 px-1', self && 'flex-row-reverse')}>
            <span className="text-xs font-semibold">{self ? 'You' : from}</span>
            <span className="text-[10px] text-muted-foreground">{formatTime(ts)}</span>
          </div>
        )}
        {children}
      </div>
    </motion.div>
  );
}
