import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileUp, MessagesSquare, Code2, ShieldCheck } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const TABS = [
  { value: 'files', label: 'Files', icon: FileUp, color: '#ac6aff', tagline: 'Any file, sent whole and direct.' },
  { value: 'chat', label: 'Chat', icon: MessagesSquare, color: '#858dff', tagline: 'Real time, no delay.' },
  { value: 'code', label: 'Code', icon: Code2, color: '#ff98e2', tagline: 'Highlighted, copied in one tap.' },
  { value: 'private', label: 'Private', icon: ShieldCheck, color: '#7adb78', tagline: 'Never touches a server.' },
] as const;

function FilesDemo() {
  return (
    <div className="h-1.5 w-40 overflow-hidden rounded-full bg-muted">
      <motion.div
        className="h-full rounded-full bg-gradient-brand"
        animate={{ width: ['0%', '100%'] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

function ChatDemo() {
  return (
    <div className="flex items-center gap-1.5 rounded-full border bg-card px-4 py-2.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-2 rounded-full bg-muted-foreground"
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </div>
  );
}

function CodeDemo() {
  return (
    <div className="rounded-lg border bg-card px-4 py-2.5 font-mono text-sm text-muted-foreground">
      const room ={' '}
      <motion.span
        className="inline-block h-4 w-1.5 translate-y-0.5 bg-primary"
        animate={{ opacity: [1, 0, 1] }}
        transition={{ duration: 0.9, repeat: Infinity }}
      />
    </div>
  );
}

function PrivateDemo() {
  return (
    <div className="relative flex size-12 items-center justify-center">
      <motion.span
        className="absolute inset-0 rounded-full bg-[#7adb78]/25"
        animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <ShieldCheck className="relative size-6 text-[#7adb78]" />
    </div>
  );
}

const DEMOS: Record<string, React.ComponentType> = {
  files: FilesDemo,
  chat: ChatDemo,
  code: CodeDemo,
  private: PrivateDemo,
};

/** A shadcn Tabs-driven feature showcase — click a tab, the panel (icon, line, live demo) changes. */
export function FeatureTabs() {
  const [active, setActive] = useState<string>('files');
  const activeTab = TABS.find((t) => t.value === active) ?? TABS[0];
  const Demo = DEMOS[active];

  return (
    <Tabs value={active} onValueChange={(v) => setActive(String(v))} className="mx-auto w-full max-w-lg">
      <TabsList className="w-full">
        {TABS.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5">
            <tab.icon className="size-3.5" />
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <div className="mt-4 flex h-40 items-center justify-center rounded-3xl border bg-card/50 p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab.value}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center gap-4 text-center"
          >
            <Demo />
            <p className="text-sm text-muted-foreground">{activeTab.tagline}</p>
          </motion.div>
        </AnimatePresence>
      </div>
    </Tabs>
  );
}
