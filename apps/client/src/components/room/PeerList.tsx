import { AnimatePresence, motion } from 'motion/react';
import { PixelAvatar } from '@/components/PixelAvatar';
import { cn } from '@/lib/utils';
import type { PeerStatus, RoomPeer } from '@/types/feed';

const STATUS_DOT: Record<PeerStatus, string> = {
  connected: 'bg-emerald-400',
  relayed: 'bg-sky-400',
  connecting: 'bg-amber-400',
  disconnected: 'bg-muted-foreground',
  failed: 'bg-red-400',
};

const STATUS_HINT: Partial<Record<PeerStatus, string>> = {
  connected: 'Direct',
  relayed: 'Relayed via server',
  connecting: 'Connecting…',
  disconnected: 'Disconnected',
  failed: "Can't connect — their network blocks direct connections",
};

function StatusDot({ status }: { status: PeerStatus }) {
  return (
    <span className={cn('absolute -bottom-0.5 -right-0.5 size-3 rounded-full ring-2 ring-card', STATUS_DOT[status])}>
      {status === 'connecting' && (
        <span className="absolute inset-0 animate-ping rounded-full bg-amber-400 opacity-75" />
      )}
    </span>
  );
}

function PeerRow({
  avatarId,
  name,
  status,
  isSelf,
}: {
  avatarId: number;
  name: string;
  status: PeerStatus;
  isSelf?: boolean;
}) {
  const hint = isSelf ? 'You' : STATUS_HINT[status];
  return (
    <div className="flex items-center gap-3 rounded-2xl px-2 py-2 transition-colors hover:bg-muted/40">
      <div className="relative shrink-0">
        <div
          className={cn(
            'rounded-full p-0.5',
            status === 'connected' || status === 'relayed' ? 'bg-gradient-brand' : 'bg-border'
          )}
        >
          <div className="rounded-full bg-card p-0.5">
            <PixelAvatar avatarId={avatarId} size={30} />
          </div>
        </div>
        <StatusDot status={status} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        {hint && (
          <p
            className={cn(
              'text-[10px] leading-snug',
              isSelf ? 'tagline text-[9px] text-muted-foreground' : status === 'failed' ? 'text-destructive' : 'text-muted-foreground'
            )}
          >
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}

interface PeerListProps {
  selfName: string;
  selfAvatarId: number;
  peers: RoomPeer[];
}

export function PeerList({ selfName, selfAvatarId, peers }: PeerListProps) {
  const anyFailed = peers.some((peer) => peer.status === 'failed');
  const anyRelayed = peers.some((peer) => peer.status === 'relayed');

  return (
    <div className="flex flex-col gap-0.5">
      <PeerRow avatarId={selfAvatarId} name={selfName} status="connected" isSelf />

      <AnimatePresence initial={false}>
        {peers.map((peer) => (
          <motion.div
            key={peer.id}
            layout
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            <PeerRow avatarId={peer.avatarId} name={peer.name} status={peer.status} />
          </motion.div>
        ))}
      </AnimatePresence>

      {peers.length === 0 && (
        <div className="mt-3 rounded-2xl border border-dashed p-4 text-center">
          <p className="text-xs text-muted-foreground">
            Nobody else yet — share the room code to invite someone.
          </p>
        </div>
      )}

      {anyRelayed && (
        <p className="mt-3 rounded-2xl border bg-muted/30 p-3 text-[11px] leading-relaxed text-muted-foreground">
          Relayed connections (often between different mobile networks) pass through the FluxRoom
          server in transit. Nothing is stored, but they aren't peer-to-peer.
        </p>
      )}

      {anyFailed && (
        <p className="mt-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-[11px] leading-relaxed text-muted-foreground">
          Some people couldn't be reached directly. This usually happens between different mobile
          networks — try switching one device to Wi-Fi.
        </p>
      )}
    </div>
  );
}
