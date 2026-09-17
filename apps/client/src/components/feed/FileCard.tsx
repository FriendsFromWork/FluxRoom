import { motion } from 'motion/react';
import { AlertTriangle, Download, FileIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatBytes } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { FileStatus } from '@/types/feed';

interface FileCardProps {
  name: string;
  size: number;
  status: FileStatus;
  progress: number;
  blobUrl?: string;
}

export function FileCard({ name, size, status, progress, blobUrl }: FileCardProps) {
  const failed = status === 'failed';
  const transferring = status === 'transferring';
  const pct = Math.round(progress * 100);

  return (
    <div
      className={cn(
        'w-full max-w-64 overflow-hidden rounded-2xl border bg-card sm:max-w-72',
        failed && 'border-destructive/40'
      )}
    >
      <div className="flex items-center gap-3 p-3">
        <div
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-xl',
            failed ? 'bg-destructive/15' : 'bg-gradient-brand'
          )}
        >
          {failed ? (
            <AlertTriangle className="size-[18px] text-destructive" />
          ) : (
            <FileIcon className="size-[18px] text-white" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="text-[11px] text-muted-foreground">
            {formatBytes(size)}
            {transferring && <span className="text-primary"> · {pct}%</span>}
            {failed && <span className="text-destructive"> · failed</span>}
          </p>
        </div>

        {status === 'done' && blobUrl && (
          <Button
            variant="secondary"
            size="icon"
            className="shrink-0"
            nativeButton={false}
            render={<a href={blobUrl} download={name} aria-label={`Download ${name}`} />}
          >
            <Download className="size-4" />
          </Button>
        )}
      </div>

      {transferring && (
        <div className="h-1 w-full bg-muted">
          <motion.div
            className="h-full bg-gradient-brand"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ ease: 'easeOut', duration: 0.25 }}
          />
        </div>
      )}

      {failed && (
        <p className="border-t border-destructive/20 bg-destructive/5 px-3 py-1.5 text-[11px] text-destructive">
          Transfer interrupted — the connection was lost.
        </p>
      )}
    </div>
  );
}
