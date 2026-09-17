import { lazy, memo, Suspense } from 'react';
import { MessageRow } from './MessageRow';
import { TextBlock } from './TextBlock';
import { FileCard } from './FileCard';
import { SystemNote } from './SystemNote';
import { cn } from '@/lib/utils';
import type { FeedItem } from '@/types/feed';

const CodeBlock = lazy(() => import('./CodeBlock').then((m) => ({ default: m.CodeBlock })));

// Memoized: a file's progress updates replace only that item, so the rest of the feed skips re-rendering.
export const FeedItemView = memo(function FeedItemView({ item, showHeader }: { item: FeedItem; showHeader: boolean }) {
  switch (item.kind) {
    case 'chat':
      return (
        <MessageRow avatarId={item.avatarId} from={item.from} self={item.self} ts={item.ts} showHeader={showHeader}>
          <div
            className={cn(
              'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
              item.self
                ? 'rounded-tr-sm bg-gradient-brand text-white'
                : 'rounded-tl-sm border bg-card'
            )}
          >
            <p className="whitespace-pre-wrap break-words">{item.text}</p>
          </div>
        </MessageRow>
      );
    case 'text':
      return (
        <MessageRow avatarId={item.avatarId} from={item.from} self={item.self} ts={item.ts} showHeader={showHeader}>
          <TextBlock content={item.content} />
        </MessageRow>
      );
    case 'code':
      return (
        <MessageRow avatarId={item.avatarId} from={item.from} self={item.self} ts={item.ts} showHeader={showHeader}>
          <div className="w-full">
            <Suspense fallback={<div className="h-28 w-72 animate-pulse rounded-2xl border bg-muted/40" />}>
              <CodeBlock lang={item.lang} content={item.content} />
            </Suspense>
          </div>
        </MessageRow>
      );
    case 'file':
      return (
        <MessageRow avatarId={item.avatarId} from={item.from} self={item.self} ts={item.ts} showHeader={showHeader}>
          <FileCard name={item.name} size={item.size} status={item.status} progress={item.progress} blobUrl={item.blobUrl} />
        </MessageRow>
      );
    case 'system':
      return <SystemNote text={item.text} />;
  }
});
