import { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FeedItemView } from './FeedItemView';
import type { FeedItem } from '@/types/feed';
import { Logo } from '@/components/Logo';

const GROUP_WINDOW_MS = 5 * 60 * 1000;
/** How close to the bottom (in px) counts as "still at the bottom" for auto-scroll purposes. */
const AUTO_SCROLL_THRESHOLD_PX = 120;

function hasSender(item: FeedItem): item is Extract<FeedItem, { from: string }> {
  return item.kind !== 'system';
}

function shouldGroupWithPrevious(prev: FeedItem | undefined, curr: FeedItem): boolean {
  if (!prev || !hasSender(prev) || !hasSender(curr)) return false;
  if (prev.from !== curr.from) return false;
  return curr.ts - prev.ts <= GROUP_WINDOW_MS;
}

/** Short text for screen readers — the visual feed itself isn't announced, only new arrivals. */
function describeForScreenReader(item: FeedItem): string {
  switch (item.kind) {
    case 'system':
      return item.text;
    case 'chat':
      return item.self ? '' : `${item.from}: ${item.text}`;
    case 'text':
      return item.self ? '' : `${item.from} sent a block of text`;
    case 'code':
      return item.self ? '' : `${item.from} sent a ${item.lang} code snippet`;
    case 'file':
      if (item.self) return '';
      if (item.status === 'done') return `File received from ${item.from}: ${item.name}`;
      if (item.status === 'failed') return `File from ${item.from} failed to arrive: ${item.name}`;
      return `Receiving file from ${item.from}: ${item.name}`;
  }
}

export function Feed({ items }: { items: FeedItem[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const wasNearBottomRef = useRef(true);
  const prevItemsRef = useRef<FeedItem[]>([]);
  const [announcement, setAnnouncement] = useState('');

  // Screen readers aren't told about the feed's visual content — announce new arrivals
  // and file-transfer outcomes explicitly instead (WCAG 4.1.3 Status Messages).
  useEffect(() => {
    const prev = prevItemsRef.current;
    prevItemsRef.current = items;

    if (items.length > prev.length) {
      const text = describeForScreenReader(items[items.length - 1]);
      if (text) setAnnouncement(text);
      return;
    }
    for (let i = 0; i < items.length; i++) {
      const curr = items[i];
      const old = prev[i];
      if (curr.kind === 'file' && old?.kind === 'file' && curr.status !== old.status) {
        const text = describeForScreenReader(curr);
        if (text) setAnnouncement(text);
      }
    }
  }, [items]);

  useEffect(() => {
    // Follow the feed while parked near the bottom, and always after sending something
    // yourself — but don't yank someone away from older messages they scrolled up to read.
    const last = items[items.length - 1];
    const sentBySelf = last !== undefined && last.kind !== 'system' && last.self;
    if (!wasNearBottomRef.current && !sentBySelf) return;
    const viewport = viewportRef.current;
    if (viewport) {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
    } else {
      bottomRef.current?.scrollIntoView({ block: 'end' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const onScroll = () => {
      const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      wasNearBottomRef.current = distanceFromBottom <= AUTO_SCROLL_THRESHOLD_PX;
    };
    viewport.addEventListener('scroll', onScroll, { passive: true });
    return () => viewport.removeEventListener('scroll', onScroll);
  }, []);

  if (items.length === 0) {
    return (
      <div className="relative flex flex-1 flex-col items-center justify-center gap-4 overflow-hidden px-6 text-center">
        <div className="pointer-events-none absolute left-1/2 top-1/2 size-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 glow-blob" />
        <div className="relative rounded-3xl border bg-card/50 p-4 backdrop-blur">
          <Logo height={48} />
        </div>
        <div className="relative">
          <p className="font-display text-base font-semibold">This room is empty</p>
          <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
            Send a message, drop a file, or paste a snippet to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div aria-live="polite" role="log" className="sr-only">
        {announcement}
      </div>
      <ScrollArea className="flex-1" viewportRef={viewportRef}>
        <div className="mx-auto flex max-w-3xl flex-col px-4 py-5 sm:px-6">
          <AnimatePresence initial={false}>
            {items.map((item, index) => (
              <FeedItemView key={item.id} item={item} showHeader={!shouldGroupWithPrevious(items[index - 1], item)} />
            ))}
          </AnimatePresence>
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
    </>
  );
}
