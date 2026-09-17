import { useState } from 'react';
import { toast } from 'sonner';
import { Check, Copy, AlignLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { copyToClipboard } from '@/lib/clipboard';

export function TextBlock({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyToClipboard(content);
    if (!ok) {
      toast.error('Could not copy — try selecting the text manually.');
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="w-full overflow-hidden rounded-2xl border bg-card">
      <div className="flex items-center justify-between border-b bg-primary/10 px-3 py-1.5">
        <span className="tagline flex items-center gap-1.5 text-[10px] text-primary">
          <AlignLeft className="size-3" />
          Text
        </span>
        <Button variant="ghost" size="icon-xs" onClick={handleCopy} aria-label="Copy text">
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
        </Button>
      </div>
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words p-3 text-sm leading-relaxed">
        {content}
      </pre>
    </div>
  );
}
