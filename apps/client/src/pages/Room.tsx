import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { LogOut, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/theme-toggle';
import { Logo } from '@/components/Logo';
import { AvatarPicker } from '@/components/AvatarPicker';
import { PeerList } from '@/components/room/PeerList';
import { ShareRoomDialog } from '@/components/room/ShareRoomDialog';
import { JoiningLoader } from '@/components/room/JoiningLoader';
import { Feed } from '@/components/feed/Feed';
import { Composer } from '@/components/composer/Composer';
import { useRoomStore } from '@/store/useRoomStore';
import { cn } from '@/lib/utils';

const NAME_STORAGE_KEY = 'fluxroom-name';
const AVATAR_STORAGE_KEY = 'fluxroom-avatar';

function JoinPrompt({
  roomId,
  onJoin,
}: {
  roomId: string;
  onJoin: (name: string, avatarId: number) => void;
}) {
  const [name, setName] = useState('');
  const [avatarId, setAvatarId] = useState(1);

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-background px-5 py-8">
      <div className="pointer-events-none absolute left-1/2 top-0 size-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/25 glow-blob" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-md rounded-3xl border bg-card/60 p-6 backdrop-blur sm:p-8"
      >
        <Logo size={32} />
        <span className="tagline mt-5 block text-[11px] text-primary">You've been invited</span>
        <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Join <span className="text-gradient-brand">{roomId}</span>
        </h1>
        <p className="mt-2.5 text-sm text-muted-foreground">
          Pick how you'll appear to everyone else in this room.
        </p>

        <div className="mt-7 flex flex-col gap-6">
          <div className="flex flex-col gap-2.5">
            <label htmlFor="join-name" className="tagline text-[11px] text-muted-foreground">
              Display name
            </label>
            <Input
              id="join-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && name.trim() && onJoin(name.trim(), avatarId)}
              maxLength={40}
              autoFocus
              className="h-12 rounded-xl text-base"
            />
          </div>

          <div className="flex flex-col gap-3">
            <label className="tagline text-[11px] text-muted-foreground">Choose an avatar</label>
            <AvatarPicker value={avatarId} onChange={setAvatarId} />
          </div>

          <Button
            size="lg"
            disabled={!name.trim()}
            onClick={() => onJoin(name.trim(), avatarId)}
            className="w-full bg-gradient-brand glow-primary"
          >
            Join room
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

export function Room() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const joinedRef = useRef(false);
  const [peersOpen, setPeersOpen] = useState(false);

  const [name, setName] = useState(() => localStorage.getItem(NAME_STORAGE_KEY));
  const [avatarId, setAvatarId] = useState(() => Number(localStorage.getItem(AVATAR_STORAGE_KEY)) || 1);

  const status = useRoomStore((s) => s.status);
  const errorMessage = useRoomStore((s) => s.errorMessage);
  const selfName = useRoomStore((s) => s.selfName);
  const selfAvatarId = useRoomStore((s) => s.selfAvatarId);
  const peers = useRoomStore((s) => s.peers);
  const feed = useRoomStore((s) => s.feed);
  const joinRoom = useRoomStore((s) => s.joinRoom);
  const leaveRoom = useRoomStore((s) => s.leaveRoom);

  useEffect(() => {
    if (!roomId || !name || joinedRef.current) return;
    joinedRef.current = true;
    joinRoom(name, roomId, avatarId);
    return () => {
      leaveRoom();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, name]);

  if (!roomId) return null;

  if (!name) {
    return (
      <JoinPrompt
        roomId={roomId}
        onJoin={(chosenName, chosenAvatarId) => {
          localStorage.setItem(NAME_STORAGE_KEY, chosenName);
          localStorage.setItem(AVATAR_STORAGE_KEY, String(chosenAvatarId));
          setAvatarId(chosenAvatarId);
          setName(chosenName);
        }}
      />
    );
  }

  if (status === 'connecting' || status === 'idle') {
    return <JoiningLoader roomId={roomId} avatarId={avatarId} />;
  }

  const handleLeave = () => {
    leaveRoom();
    navigate('/');
  };

  const peerList = Object.values(peers);
  const connectedCount = peerList.filter((p) => p.status === 'connected').length + 1;

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-background">
      <header className="z-20 flex shrink-0 items-center gap-3 border-b bg-card/50 px-4 py-3 backdrop-blur-xl sm:px-5">
        <Logo size={30} />

        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-semibold leading-tight">{roomId}</p>
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'size-1.5 rounded-full',
                status === 'connected' ? 'bg-emerald-400' : status === 'error' ? 'bg-red-400' : 'bg-amber-400'
              )}
            />
            <span className="text-[11px] text-muted-foreground">
              {status === 'connected' ? `${connectedCount} connected` : status}
            </span>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Show people"
          onClick={() => setPeersOpen(true)}
        >
          <Users className="size-[18px]" />
        </Button>
        <ShareRoomDialog roomName={roomId} />
        <div className="hidden sm:block">
          <ThemeToggle />
        </div>
        <Button variant="ghost" size="icon" onClick={handleLeave} aria-label="Leave room">
          <LogOut className="size-[18px]" />
        </Button>
      </header>

      {status === 'error' && (
        <div className="shrink-0 border-b border-destructive/30 bg-destructive/10 px-5 py-2.5 text-sm text-destructive">
          {errorMessage ?? 'Connection lost.'}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 shrink-0 flex-col border-r bg-card/20 p-4 lg:flex">
          <span className="tagline mb-4 px-1 text-[10px] text-muted-foreground">
            In this room · {connectedCount}
          </span>
          <PeerList selfName={selfName} selfAvatarId={selfAvatarId} peers={peerList} />
        </aside>

        <main className="flex min-h-0 flex-1 flex-col">
          <Feed items={feed} />
          <Composer />
        </main>
      </div>

      {/* Mobile peers drawer */}
      <AnimatePresence>
        {peersOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPeersOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 38 }}
              className="fixed inset-y-0 right-0 z-50 flex w-72 max-w-[85vw] flex-col border-l bg-card p-4 lg:hidden"
            >
              <div className="mb-5 flex items-center justify-between">
                <span className="tagline text-[10px] text-muted-foreground">
                  In this room · {connectedCount}
                </span>
                <Button variant="ghost" size="icon" aria-label="Close" onClick={() => setPeersOpen(false)}>
                  <X className="size-[18px]" />
                </Button>
              </div>
              <PeerList selfName={selfName} selfAvatarId={selfAvatarId} peers={peerList} />
              <div className="mt-auto pt-4">
                <ThemeToggle />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
