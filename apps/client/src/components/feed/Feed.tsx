import { useEffect, useRef } from 'react';
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

export function Feed({ items }: { items: FeedItem[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const wasNearBottomRef = useRef(true);

  useEffect(() => {
    // Skip the jump if the user has scrolled up to read earlier messages —
    // only follow the feed automatically while already parked near the bottom.
    if (!wasNearBottomRef.current) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
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
          <Logo size={40} />
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
  );
}
