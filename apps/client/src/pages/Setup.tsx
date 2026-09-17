import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Pencil, Plus, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { AvatarPicker } from '@/components/AvatarPicker';
import { PixelAvatar } from '@/components/PixelAvatar';
import { generateRoomCode, normalizeRoomCode } from '@/lib/roomCode';
import { prefersTouchInput } from '@/lib/device';

const NAME_STORAGE_KEY = 'fluxroom-name';
const AVATAR_STORAGE_KEY = 'fluxroom-avatar';

const slide = {
  initial: { opacity: 0, x: 28 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -28 },
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const },
};

export function Setup() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState(() => localStorage.getItem(NAME_STORAGE_KEY) ?? '');
  const [avatarId, setAvatarId] = useState(() => Number(localStorage.getItem(AVATAR_STORAGE_KEY)) || 1);
  const [joinCode, setJoinCode] = useState('');

  const canContinue = name.trim().length > 0;

  const persist = () => {
    localStorage.setItem(NAME_STORAGE_KEY, name.trim());
    localStorage.setItem(AVATAR_STORAGE_KEY, String(avatarId));
  };

  const handleContinue = () => {
    if (!canContinue) return;
    persist();
    setStep(2);
  };

  const handleCreate = () => {
    persist();
    navigate(`/r/${generateRoomCode()}`);
  };

  const normalizedJoinCode = normalizeRoomCode(joinCode);

  const handleJoin = () => {
    if (!normalizedJoinCode) return;
    persist();
    navigate(`/r/${normalizedJoinCode}`);
  };

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-background">
      <div className="pointer-events-none absolute left-1/2 top-0 size-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/25 glow-blob" />
      <div className="pointer-events-none absolute -left-32 bottom-0 size-80 rounded-full bg-[#858dff]/15 glow-blob" />

      <header className="relative flex items-center justify-between px-5 py-5 sm:px-8">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
        >
          <Logo height={36} />
          <span className="font-display text-base font-semibold tracking-tight">FluxRoom</span>
        </button>
        <ThemeToggle />
      </header>

      <main className="relative flex flex-1 items-center justify-center px-5 py-8">
        <div className="w-full max-w-md">
          {/* Step indicator */}
          <div className="mb-8 flex items-center justify-center gap-3">
            {[1, 2].map((n) => (
              <div key={n} className="flex items-center gap-3">
                <motion.span
                  animate={{
                    scale: step === n ? 1 : 0.85,
                    opacity: step >= n ? 1 : 0.4,
                  }}
                  className={`flex size-7 items-center justify-center rounded-full text-xs font-semibold ${
                    step >= n ? 'bg-gradient-brand text-white' : 'border bg-card text-muted-foreground'
                  }`}
                >
                  {n}
                </motion.span>
                {n === 1 && <span className={`h-px w-10 ${step > 1 ? 'bg-primary' : 'bg-border'}`} />}
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div key="step1" {...slide}>
                <div className="rounded-3xl border bg-card/60 p-6 backdrop-blur sm:p-8">
                  <span className="tagline text-[11px] text-primary">Step one</span>
                  <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                    Who's sharing?
                  </h1>
                  <p className="mt-2.5 text-sm text-muted-foreground">
                    Pick how you'll appear to others. This stays on your device.
                  </p>

                  <div className="mt-7 flex flex-col gap-6">
                    <div className="flex flex-col gap-2.5">
                      <label htmlFor="name" className="tagline text-[11px] text-muted-foreground">
                        Display name
                      </label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleContinue()}
                        maxLength={40}
                        autoFocus={!prefersTouchInput()}
                        className="h-12 rounded-xl text-base"
                      />
                    </div>

                    <div className="flex flex-col gap-3">
                      <label className="tagline text-[11px] text-muted-foreground">Choose an avatar</label>
                      <AvatarPicker value={avatarId} onChange={setAvatarId} />
                    </div>

                    <Button
                      size="lg"
                      onClick={handleContinue}
                      disabled={!canContinue}
                      className="w-full bg-gradient-brand glow-primary"
                    >
                      Continue
                      <ArrowRight className="size-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div key="step2" {...slide}>
                <div className="rounded-3xl border bg-card/60 p-6 backdrop-blur sm:p-8">
                  <span className="tagline text-[11px] text-primary">Step two</span>
                  <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                    Open a room
                  </h1>
                  <p className="mt-2.5 text-sm text-muted-foreground">
                    Create a fresh room, or enter a code you were given.
                  </p>

                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="mt-6 flex w-full items-center gap-3 rounded-2xl border bg-background/50 p-3 text-left transition-colors hover:border-primary/40"
                  >
                    <PixelAvatar avatarId={avatarId} size={38} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{name}</p>
                      <p className="tagline text-[10px] text-muted-foreground">Your identity</p>
                    </div>
                    <Pencil className="size-3.5 shrink-0 text-muted-foreground" />
                  </button>

                  <div className="mt-6 flex flex-col gap-5">
                    <Button size="lg" onClick={handleCreate} className="w-full bg-gradient-brand glow-primary">
                      <Plus className="size-4" />
                      Create a new room
                    </Button>

                    <div className="flex items-center gap-3">
                      <Separator className="flex-1" />
                      <span className="tagline text-[10px] text-muted-foreground">or join</span>
                      <Separator className="flex-1" />
                    </div>

                    <div className="flex flex-col gap-2.5 sm:flex-row">
                      <Input
                        placeholder="room code or invite link"
                        aria-label="Room code or invite link"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        enterKeyHint="go"
                        className="h-12 rounded-xl text-base"
                      />
                      <Button
                        size="lg"
                        variant="secondary"
                        onClick={handleJoin}
                        disabled={!normalizedJoinCode}
                        className="shrink-0"
                      >
                        <LogIn className="size-4" />
                        Join
                      </Button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="mt-7 flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <ArrowLeft className="size-3.5" />
                    Back
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
