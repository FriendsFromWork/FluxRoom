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
import { TransferOrbit } from '@/components/site/TransferOrbit';

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
    description: 'Peer-to-peer over WebRTC whenever possible, with a store-nothing relay for networks that block it. No accounts, no database.',
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
    <div className="min-h-svh overflow-x-hidden bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden pb-20 pt-32 sm:pb-24 sm:pt-40">
        <div className="pointer-events-none absolute left-1/2 top-0 size-[36rem] -translate-x-1/2 -translate-y-1/3 rounded-full bg-primary/20 glow-blob" />
        <div className="pointer-events-none absolute -right-32 top-1/4 size-72 rounded-full bg-[#ff98e2]/15 glow-blob sm:size-96" />

        <div className="relative mx-auto max-w-4xl px-5 text-center sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center gap-6 sm:gap-7"
          >
            <span className="tagline inline-flex items-center gap-2 rounded-full border bg-card/60 px-4 py-1.5 text-[10px] text-muted-foreground backdrop-blur sm:text-[11px]">
              <Zap className="size-3.5 text-primary" />
              Peer-to-peer · No sign-up
            </span>

            <h1 className="font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl xl:text-7xl">
              Share files and text
              <br />
              <span className="text-gradient-brand">without the middleman</span>
            </h1>

            <p className="max-w-xl text-pretty text-sm text-muted-foreground sm:text-lg">
              Drop a file, paste a snippet, send a message — straight from your device to theirs.
              Nothing is uploaded, nothing is stored, nothing to install.
            </p>

            <div className="flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
              <Button
                size="lg"
                className="w-full bg-gradient-brand glow-primary sm:w-auto"
                onClick={() => navigate('/setup')}
              >
                Get Started
                <ArrowRight className="size-4" />
              </Button>
              <Button
                size="lg"
                variant="ghost"
                nativeButton={false}
                className="w-full sm:w-auto"
                render={<a href="#how-it-works" />}
              >
                See how it works
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="mt-16 sm:mt-20"
          >
            <TransferOrbit />
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative border-t py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-5 sm:px-6">
          <Reveal className="mb-10 text-center sm:mb-14">
            <span className="tagline text-[11px] text-primary">Features</span>
            <h2 className="mt-4 font-display text-2xl font-semibold tracking-tight sm:text-4xl">
              Everything in one live room
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-sm text-muted-foreground sm:text-base">
              Four kinds of sharing, one feed, zero setup.
            </p>
          </Reveal>

          <div className="grid gap-4 sm:grid-cols-2">
            {FEATURES.map((feature, i) => (
              <Reveal key={feature.title} delay={i * 0.08}>
                <div className="group h-full rounded-3xl border bg-card/50 p-6 transition-colors hover:border-primary/40 hover:bg-card sm:p-7">
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
      <section id="how-it-works" className="relative overflow-hidden border-t py-16 sm:py-24">
        <div className="pointer-events-none absolute left-1/2 top-1/2 size-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 glow-blob sm:size-[36rem]" />

        <div className="relative mx-auto max-w-5xl px-5 sm:px-6">
          <Reveal className="mb-10 text-center sm:mb-16">
            <span className="tagline text-[11px] text-primary">How it works</span>
            <h2 className="mt-4 font-display text-2xl font-semibold tracking-tight sm:text-4xl">
              Three steps, about ten seconds
            </h2>
          </Reveal>

          <div className="relative flex flex-col gap-8 sm:flex-row sm:gap-6">
            {/* Connecting line behind the steps, desktop only */}
            <div className="absolute left-0 right-0 top-6 hidden h-px bg-border sm:block" />

            {STEPS.map((step, i) => (
              <Reveal key={step.title} delay={i * 0.1} className="relative flex-1">
                <div className="relative flex flex-col items-center gap-4 text-center sm:items-start sm:text-left">
                  <div className="relative z-10 flex size-12 shrink-0 items-center justify-center rounded-2xl border bg-background">
                    <step.icon className="size-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="mb-1.5 font-display text-lg font-semibold">{step.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{step.description}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section id="privacy" className="relative border-t py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-5 sm:px-6">
          <Reveal>
            <div className="rounded-3xl border bg-card/50 p-7 text-center sm:p-14">
              <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl bg-gradient-brand">
                <ShieldCheck className="size-6 text-white" />
              </div>
              <span className="tagline text-[11px] text-primary">Privacy</span>
              <h2 className="mt-4 font-display text-2xl font-semibold tracking-tight sm:text-4xl">
                Nothing is ever stored
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                Whenever your networks allow it, every file, message, and snippet travels directly between
                devices, encrypted in transit by WebRTC. When they don't (common between different mobile
                networks), FluxRoom's server relays it in memory so it still arrives, and you'll see
                "Relayed via server". Either way there is no database, no account, and nothing left behind when
                you close the tab.
              </p>

              <div className="mt-8 grid gap-3 sm:mt-10 sm:grid-cols-3 sm:gap-4">
                {[
                  { icon: ShieldCheck, label: 'No database' },
                  { icon: Users, label: 'No accounts' },
                  { icon: MonitorSmartphone, label: 'Any device' },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-center gap-2.5 rounded-2xl border bg-background/50 px-4 py-3.5"
                  >
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
      <section className="relative overflow-hidden border-t py-20 sm:py-28">
        <div className="pointer-events-none absolute left-1/2 top-1/2 size-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 glow-blob sm:size-[32rem]" />
        <Reveal className="relative mx-auto max-w-2xl px-5 text-center sm:px-6">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-5xl">Ready when you are</h2>
          <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground sm:mt-5 sm:text-base">
            No install, no sign-up. Open a room and start sharing in seconds.
          </p>
          <Button
            size="lg"
            className="mt-8 w-full bg-gradient-brand glow-primary sm:mt-9 sm:w-auto"
            onClick={() => navigate('/setup')}
          >
            Get Started
            <ArrowRight className="size-4" />
          </Button>
        </Reveal>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <Logo height={30} />
            <span className="font-display text-sm font-semibold">FluxRoom</span>
          </div>
          <p className="text-xs text-muted-foreground">No sign-up · No database · 100% free</p>
        </div>
      </footer>
    </div>
  );
}
