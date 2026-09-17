import { useEffect, useState } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { Check, ImageIcon, Laptop, Lock, Server, Smartphone } from 'lucide-react';
import { PixelAvatar } from '@/components/PixelAvatar';

/** A file card whose progress bar and percentage count up, then land on a delivered check. */
export function FilesVignette() {
  const reduceMotion = useReducedMotion();
  const progress = useMotionValue(reduceMotion ? 100 : 0);
  const width = useTransform(progress, (v) => `${v}%`);
  const [percent, setPercent] = useState(reduceMotion ? 100 : 0);

  useEffect(() => {
    if (reduceMotion) return;
    const controls = animate(progress, 100, {
      duration: 2.4,
      ease: [0.4, 0, 0.2, 1],
      onUpdate: (v) => setPercent(Math.round(v)),
    });
    return () => controls.stop();
  }, [progress, reduceMotion]);

  const done = percent >= 100;

  return (
    <div className="w-full max-w-xs rounded-2xl border bg-background/80 p-4 shadow-sm backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-brand">
          <ImageIcon className="size-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">holiday-photos.zip</p>
          <p className="text-xs text-muted-foreground">248 MB</p>
        </div>
        {done ? (
          <motion.span
            initial={{ scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 18 }}
            className="flex size-8 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            aria-label="Delivered"
          >
            <Check className="size-4" strokeWidth={3} />
          </motion.span>
        ) : (
          <span className="text-sm font-semibold tabular-nums text-primary">{percent}%</span>
        )}
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
        <motion.div className="h-full rounded-full bg-gradient-brand" style={{ width }} />
      </div>
    </div>
  );
}

const MESSAGES = [
  { self: false, avatarId: 4, text: 'Sending the slides now' },
  { self: true, avatarId: 1, text: 'Got them, thanks!' },
];

/** Two chat bubbles arriving in turn, then a typing indicator — the actual feed style of a room. */
export function ChatVignette() {
  return (
    <div className="flex w-full max-w-xs flex-col gap-3">
      {MESSAGES.map((message, i) => (
        <motion.div
          key={message.text}
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.15 + i * 0.7, type: 'spring', stiffness: 380, damping: 26 }}
          className={message.self ? 'flex flex-row-reverse items-end gap-2' : 'flex items-end gap-2'}
        >
          <PixelAvatar avatarId={message.avatarId} size={30} />
          <div
            className={
              message.self
                ? 'rounded-2xl rounded-br-md bg-gradient-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm'
                : 'rounded-2xl rounded-bl-md border bg-background px-4 py-2.5 text-sm shadow-sm'
            }
          >
            {message.text}
          </div>
        </motion.div>
      ))}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.7 }}
        className="flex items-center gap-2"
      >
        <PixelAvatar avatarId={4} size={30} />
        <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border bg-background px-4 py-3.5 shadow-sm">
          {[0, 1, 2].map((dot) => (
            <motion.span
              key={dot}
              className="size-1.5 rounded-full bg-primary"
              animate={{ y: [0, -4, 0], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 0.9, repeat: Infinity, delay: dot * 0.15 }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}

const CODE_LINES = [
  [
    { t: 'function ', c: 'text-violet-600 dark:text-violet-400' },
    { t: 'greet', c: 'text-sky-600 dark:text-sky-400' },
    { t: '(name) {', c: 'text-foreground' },
  ],
  [
    { t: '  return ', c: 'text-violet-600 dark:text-violet-400' },
    { t: '`Hi, ${name}`', c: 'text-emerald-600 dark:text-emerald-400' },
  ],
  [{ t: '}', c: 'text-foreground' }],
];

/** A snippet whose lines type in, followed by a "Copied" confirmation. */
export function CodeVignette() {
  return (
    <div className="w-full max-w-xs overflow-hidden rounded-2xl border bg-background/80 shadow-sm backdrop-blur">
      <div className="flex items-center justify-between border-b bg-muted/60 px-4 py-2">
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-rose-400" />
          <span className="size-2.5 rounded-full bg-amber-400" />
          <span className="size-2.5 rounded-full bg-emerald-400" />
        </div>
        <span className="text-xs font-medium text-muted-foreground">JavaScript</span>
      </div>

      <pre className="px-4 py-3.5 font-mono text-[13px] leading-6">
        {CODE_LINES.map((line, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.35, duration: 0.3 }}
          >
            {line.map((token, j) => (
              <span key={j} className={token.c}>
                {token.t}
              </span>
            ))}
          </motion.div>
        ))}
      </pre>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5, type: 'spring', stiffness: 400, damping: 24 }}
        className="flex items-center justify-end gap-1.5 border-t px-4 py-2 text-xs font-semibold text-primary"
      >
        <Check className="size-3.5" strokeWidth={3} />
        Copied
      </motion.div>
    </div>
  );
}

/** Two devices linked directly, with the server beside them doing nothing — not on the path. */
export function PrivateVignette() {
  return (
    <div className="flex w-full max-w-xs flex-col items-center gap-5">
      <div className="flex w-full items-center">
        <DeviceTile icon={Laptop} />
        <div className="relative mx-2 flex h-1 flex-1 items-center rounded-full bg-gradient-brand">
          <motion.span
            className="absolute left-1/2 flex size-9 -translate-x-1/2 items-center justify-center rounded-full border bg-background shadow-md"
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Lock className="size-4 text-primary" />
          </motion.span>
        </div>
        <DeviceTile icon={Smartphone} />
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex size-11 items-center justify-center rounded-xl border border-dashed text-muted-foreground">
          <Server className="size-5 opacity-50" />
          <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-rose-500 text-[11px] font-bold text-white">
            ×
          </span>
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="rounded-full border bg-background px-3.5 py-1.5 text-sm font-semibold shadow-sm"
        >
          0 bytes stored
        </motion.div>
      </div>
    </div>
  );
}

function DeviceTile({ icon: Icon }: { icon: typeof Laptop }) {
  return (
    <div className="relative flex size-14 shrink-0 items-center justify-center rounded-2xl border bg-background shadow-sm">
      <motion.span
        className="absolute inset-0 rounded-2xl ring-2 ring-primary/40"
        animate={{ opacity: [0.2, 0.8, 0.2] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <Icon className="size-6 text-primary" />
    </div>
  );
}
