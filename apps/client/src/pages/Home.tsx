import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowRight,
  FileUp,
  MessagesSquare,
  Code2,
  ShieldCheck,
  Zap,
  Users,
  Link2,
  MonitorSmartphone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { Navbar } from '@/components/site/Navbar';
import { Reveal } from '@/components/site/Reveal';

const FEATURES = [
  {
    icon: FileUp,
    title: 'File transfer',
    description: 'Send any file straight to another device with a live progress bar. No upload limits, no waiting room.',
  },
  {
    icon: MessagesSquare,
    title: 'Live messaging',
    description: 'Chat in real time with everyone in the room — messages appear the instant they are sent.',
  },
  {
    icon: Code2,
    title: 'Code snippets',
    description: 'Paste code with syntax highlighting in 9 languages, and copy it on the other side with one click.',
  },
  {
    icon: ShieldCheck,
    title: 'Truly private',
    description: 'Everything moves peer-to-peer over WebRTC. The server only introduces peers — it never sees your data.',
  },
];

const STEPS = [
  {
    icon: Users,
    title: 'Pick a name',
    description: 'Choose a display name and an avatar. Nothing is stored — it lives only in your browser.',
  },
  {
    icon: Link2,
    title: 'Share the room',
    description: 'Create a room and send the code, link, or QR to anyone you want in it.',
  },
  {
    icon: Zap,
    title: 'Start sharing',
    description: 'Drop files, messages, and snippets into one live feed that everyone sees instantly.',
  },
];

export function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-svh bg-background">
      <Navbar />

      {/* Hero */}
      <section className="gutter-lines relative overflow-hidden pb-24 pt-40 xl:pt-48">
        <div className="pointer-events-none absolute left-1/2 top-0 size-[40rem] -translate-x-1/2 -translate-y-1/3 rounded-full bg-primary/25 glow-blob" />
        <div className="pointer-events-none absolute -left-32 top-1/3 size-96 rounded-full bg-[#858dff]/20 glow-blob" />
        <div className="pointer-events-none absolute -right-32 top-1/2 size-96 rounded-full bg-[#ff98e2]/15 glow-blob" />

        {/* Concentric rings, echoing the reference design's hero framing */}
        <div className="pointer-events-none absolute left-1/2 top-0 -z-0 -translate-x-1/2 -translate-y-1/2">
          {[52, 40, 28].map((rem) => (
            <div
              key={rem}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border/50"
              style={{ width: `${rem}rem`, height: `${rem}rem` }}
            />
          ))}
        </div>

        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center gap-7"
          >
            <span className="tagline inline-flex items-center gap-2 rounded-full border bg-card/60 px-4 py-1.5 text-[11px] text-muted-foreground backdrop-blur">
              <Zap className="size-3.5 text-primary" />
              Peer-to-peer · No sign-up
            </span>

            <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl xl:text-7xl">
              Share files and text
              <br />
              <span className="text-gradient-brand">without the middleman</span>
            </h1>

            <p className="max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
              Drop a file, paste a snippet, send a message — straight from your device to theirs.
              Nothing is uploaded, nothing is stored, nothing to install.
            </p>

            <div className="flex flex-col items-center gap-3 sm:flex-row">
              <Button size="lg" className="bg-gradient-brand glow-primary" onClick={() => navigate('/setup')}>
                Get Started
                <ArrowRight className="size-4" />
              </Button>
              <Button size="lg" variant="ghost" nativeButton={false} render={<a href="#how-it-works" />}>
                See how it works
              </Button>
            </div>
          </motion.div>

          {/* App preview mock, framed like a device window */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="relative mx-auto mt-20 max-w-3xl"
          >
            <div className="rounded-3xl bg-gradient-brand p-px glow-primary">
              <div className="overflow-hidden rounded-[calc(1.5rem-1px)] bg-card">
                <div className="flex items-center gap-1.5 border-b bg-background/40 px-4 py-3">
                  <span className="size-2.5 rounded-full bg-[#ff776f]" />
                  <span className="size-2.5 rounded-full bg-[#ffc876]" />
                  <span className="size-2.5 rounded-full bg-[#7adb78]" />
                  <span className="tagline ml-3 text-[10px] text-muted-foreground">fluxroom</span>
                </div>

                <div className="space-y-3 p-5 text-left">
                  <div className="flex items-center gap-3 rounded-2xl border bg-background/50 p-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-brand">
                      <FileUp className="size-4 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">index.html</p>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <motion.div
                          className="h-full rounded-full bg-gradient-brand"
                          initial={{ width: '0%' }}
                          animate={{ width: '78%' }}
                          transition={{ duration: 1.6, delay: 0.8, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                    <span className="tagline shrink-0 text-[10px] text-muted-foreground">78%</span>
                  </div>

                  <div className="flex gap-3">
                    <div className="size-8 shrink-0 rounded-full bg-gradient-brand" />
                    <div className="rounded-2xl rounded-tl-sm border bg-background/50 px-4 py-2.5 text-sm">
                      got it — pushing the fix now
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-2xl border">
                    <div className="border-b bg-primary/10 px-3 py-1.5">
                      <span className="tagline text-[10px] text-primary">typescript</span>
                    </div>
                    <pre className="bg-background/50 p-3 font-mono text-xs text-muted-foreground">
                      <span className="text-primary">const</span> peer = <span className="text-primary">new</span>{' '}
                      RTCPeerConnection()
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="gutter-lines relative border-t py-24">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal className="mb-14 text-center">
            <span className="tagline text-[11px] text-primary">Features</span>
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Everything in one live room
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
              Four kinds of sharing, one feed, zero setup.
            </p>
          </Reveal>

          <div className="grid gap-4 sm:grid-cols-2">
            {FEATURES.map((feature, i) => (
              <Reveal key={feature.title} delay={i * 0.08}>
                <div className="group h-full rounded-3xl border bg-card/50 p-7 transition-colors hover:border-primary/40 hover:bg-card">
                  <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-gradient-brand transition-transform group-hover:scale-105">
                    <feature.icon className="size-5 text-white" />
                  </div>
                  <h3 className="mb-2 font-display text-lg font-semibold">{feature.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="gutter-lines relative border-t py-24">
        <div className="pointer-events-none absolute left-1/2 top-1/2 size-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 glow-blob" />

        <div className="relative mx-auto max-w-6xl px-6">
          <Reveal className="mb-14 text-center">
            <span className="tagline text-[11px] text-primary">How it works</span>
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Three steps, about ten seconds
            </h2>
          </Reveal>

          <div className="grid gap-6 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <Reveal key={step.title} delay={i * 0.1}>
                <div className="relative h-full rounded-3xl border bg-card/50 p-7">
                  <span className="tagline absolute right-6 top-6 text-4xl font-semibold text-muted/60">
                    0{i + 1}
                  </span>
                  <div className="mb-5 flex size-12 items-center justify-center rounded-2xl border bg-background">
                    <step.icon className="size-5 text-primary" />
                  </div>
                  <h3 className="mb-2 font-display text-lg font-semibold">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{step.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section id="privacy" className="gutter-lines relative border-t py-24">
        <div className="mx-auto max-w-4xl px-6">
          <Reveal>
            <div className="rounded-3xl border bg-card/50 p-10 text-center sm:p-14">
              <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl bg-gradient-brand">
                <ShieldCheck className="size-6 text-white" />
              </div>
              <span className="tagline text-[11px] text-primary">Privacy</span>
              <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                Your data never touches a server
              </h2>
              <p className="mx-auto mt-5 max-w-xl leading-relaxed text-muted-foreground">
                FluxRoom's server exists only to introduce two browsers to each other. Once connected,
                every file, message, and snippet travels directly between devices — encrypted in transit
                by WebRTC. There is no database, no account, and nothing left behind when you close the tab.
              </p>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                {[
                  { icon: ShieldCheck, label: 'No database' },
                  { icon: Users, label: 'No accounts' },
                  { icon: MonitorSmartphone, label: 'Any device' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-center gap-2.5 rounded-2xl border bg-background/50 px-4 py-3.5">
                    <item.icon className="size-4 text-primary" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="gutter-lines relative overflow-hidden border-t py-28">
        <div className="pointer-events-none absolute left-1/2 top-1/2 size-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/25 glow-blob" />
        <Reveal className="relative mx-auto max-w-2xl px-6 text-center">
          <h2 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            Ready when you are
          </h2>
          <p className="mx-auto mt-5 max-w-md text-muted-foreground">
            No install, no sign-up. Open a room and start sharing in seconds.
          </p>
          <Button size="lg" className="mt-9 bg-gradient-brand glow-primary" onClick={() => navigate('/setup')}>
            Get Started
            <ArrowRight className="size-4" />
          </Button>
        </Reveal>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <Logo size={24} />
            <span className="font-display text-sm font-semibold">FluxRoom</span>
          </div>
          <p className="text-xs text-muted-foreground">No sign-up · No database · 100% free</p>
        </div>
      </footer>
    </div>
  );
}
