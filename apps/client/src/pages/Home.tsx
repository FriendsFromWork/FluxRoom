import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { Navbar } from '@/components/site/Navbar';
import { Reveal } from '@/components/site/Reveal';
import { TransferOrbit } from '@/components/site/TransferOrbit';
import { FeatureTabs } from '@/components/site/FeatureTabs';
import { ScrollZoom } from '@/components/site/ScrollZoom';

export function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-svh overflow-x-hidden bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden pb-16 pt-32 sm:pb-20 sm:pt-40">
        <div className="pointer-events-none absolute left-1/2 top-0 size-[36rem] -translate-x-1/2 -translate-y-1/3 rounded-full bg-primary/20 glow-blob" />
        <div className="pointer-events-none absolute -right-32 top-1/4 size-72 rounded-full bg-[#ff98e2]/15 glow-blob sm:size-96" />

        <div className="relative mx-auto max-w-4xl px-5 text-center sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center gap-6"
          >
            <span className="tagline inline-flex items-center gap-2 rounded-full border bg-card/60 px-4 py-1.5 text-[10px] text-muted-foreground backdrop-blur sm:text-[11px]">
              <Zap className="size-3.5 text-primary" />
              Peer-to-peer · No sign-up
            </span>

            <h1 className="font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl xl:text-7xl">
              Send it, <span className="text-gradient-brand">directly</span>
            </h1>

            <Button size="lg" className="mt-2 bg-gradient-brand glow-primary" onClick={() => navigate('/setup')}>
              Get Started
              <ArrowRight className="size-4" />
            </Button>
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

      {/* Features — a shadcn Tabs showcase, click a tab to see it */}
      <section id="features" className="relative border-t py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-5 sm:px-6">
          <Reveal className="mb-10 text-center">
            <span className="tagline text-[11px] text-primary">Features</span>
          </Reveal>
          <Reveal delay={0.1}>
            <FeatureTabs />
          </Reveal>
        </div>
      </section>


      {/* Scroll zoom */}
      <ScrollZoom>
        <p className="max-w-3xl text-balance text-center font-display text-4xl font-semibold tracking-tight text-gradient-brand sm:text-6xl xl:text-7xl">
          Nothing in between
        </p>
      </ScrollZoom>


      {/* CTA */}
      <section className="relative overflow-hidden border-t py-20 sm:py-24">
        <div className="pointer-events-none absolute left-1/2 top-1/2 size-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 glow-blob sm:size-[32rem]" />
        <Reveal className="relative mx-auto max-w-2xl px-5 text-center sm:px-6">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-5xl">Share files and text
without the middleman</h2> <br />

          <p className="text-xs text-muted-foreground">Drop a file, paste a snippet, send a message — straight from your device to theirs. Nothing is uploaded, nothing is stored, nothing to install.

</p>


          <Button size="lg" className="mt-8 bg-gradient-brand glow-primary" onClick={() => navigate('/setup')}>
            Get Started
            <ArrowRight className="size-4" />
          </Button>
        </Reveal>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
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
