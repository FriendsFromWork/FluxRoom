import { useState } from 'react';
import { toast } from 'sonner';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import { oneDark } from '@codemirror/theme-one-dark';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getLanguageExtension } from '@/lib/codeLanguages';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import { copyToClipboard } from '@/lib/clipboard';

interface CodeBlockProps {
  lang: string;
  content: string;
}

export function CodeBlock({ lang, content }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const resolvedTheme = useResolvedTheme();

  const handleCopy = async () => {
    const ok = await copyToClipboard(content);
    if (!ok) {
      toast.error('Could not copy — try selecting the code manually.');
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <div className="flex items-center justify-between border-b bg-primary/10 px-3 py-1.5">
        <span className="tagline text-[10px] text-primary">{lang}</span>
        <Button variant="ghost" size="icon-xs" onClick={handleCopy} aria-label="Copy code">
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
        </Button>
      </div>
      <CodeMirror
        value={content}
        editable={false}
        theme={resolvedTheme === 'dark' ? oneDark : undefined}
        extensions={[...getLanguageExtension(lang), EditorView.lineWrapping]}
        basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: false }}
        maxHeight="300px"
      />
    </div>
  );
}
