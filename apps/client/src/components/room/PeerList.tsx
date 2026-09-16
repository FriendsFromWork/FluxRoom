import { AnimatePresence, motion } from 'motion/react';
import { PixelAvatar } from '@/components/PixelAvatar';
import { cn } from '@/lib/utils';
import type { RoomPeer } from '@/types/feed';

function StatusDot({ status }: { status: RoomPeer['status'] }) {
  const color =
    status === 'connected' ? 'bg-emerald-400' : status === 'connecting' ? 'bg-amber-400' : 'bg-red-400';
  return (
    <span className={cn('absolute -bottom-0.5 -right-0.5 size-3 rounded-full ring-2 ring-card', color)}>
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
  status: RoomPeer['status'];
  isSelf?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl px-2 py-2 transition-colors hover:bg-muted/40">
      <div className="relative shrink-0">
        <div className={cn('rounded-full p-0.5', status === 'connected' ? 'bg-gradient-brand' : 'bg-border')}>
          <div className="rounded-full bg-card p-0.5">
            <PixelAvatar avatarId={avatarId} size={30} />
          </div>
        </div>
        <StatusDot status={status} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        {isSelf && <p className="tagline text-[9px] text-muted-foreground">You</p>}
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
    </div>
  );
}
