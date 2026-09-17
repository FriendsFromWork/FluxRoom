import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'motion/react';
import { Paperclip, SendHorizonal, Code2 } from 'lucide-react';
import { MAX_PASTE_LENGTH } from '@fluxroom/shared';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CODE_LANGUAGES } from '@/lib/codeLanguageList';
import { cn } from '@/lib/utils';
import { prefersTouchInput } from '@/lib/device';
import { canReachPeer, useRoomStore } from '@/store/useRoomStore';

/** Below this length, a plain send renders as an inline chat bubble; above it, as a "Text" card. */
const CHAT_INLINE_THRESHOLD = 300;

export function Composer() {
  const [content, setContent] = useState('');
  const [isCode, setIsCode] = useState(false);
  const [lang, setLang] = useState('javascript');
  const [focused, setFocused] = useState(false);
  // On touch keyboards Enter inserts a newline and the send button sends, as in native messaging apps.
  const [enterSends] = useState(() => !prefersTouchInput());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sendChat = useRoomStore((s) => s.sendChat);
  const sendText = useRoomStore((s) => s.sendText);
  const sendCode = useRoomStore((s) => s.sendCode);
  const sendFile = useRoomStore((s) => s.sendFile);
  const hasConnectedPeer = useRoomStore((s) => Object.values(s.peers).some((p) => canReachPeer(p, s.relay)));

  const handleSend = () => {
    const trimmed = content.trim();
    if (!trimmed) return;

    if (trimmed.length > MAX_PASTE_LENGTH) {
      toast.error(`Too long — keep it under ${MAX_PASTE_LENGTH.toLocaleString()} characters, or send it as a file.`);
      return;
    }

    if (isCode) {
      sendCode(lang, trimmed);
    } else if (trimmed.length <= CHAT_INLINE_THRESHOLD) {
      sendChat(trimmed);
    } else {
      sendText(trimmed);
    }
    setContent('');
  };

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!hasConnectedPeer) {
      toast.error("Nobody is connected yet — files are sent live, so wait until someone's in the room.");
      return;
    }
    sendFile(file);
  };

  const showCount = isCode || content.length > CHAT_INLINE_THRESHOLD;
  const nearLimit = content.length > MAX_PASTE_LENGTH * 0.9;
  const canSend = content.trim().length > 0;

  return (
    <div className="shrink-0 px-4 pb-4 pt-2 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div
          className={cn(
            'rounded-3xl border bg-card/70 p-2 backdrop-blur-xl transition-colors',
            focused && 'border-primary/50'
          )}
        >
          <AnimatePresence>
            {isCode && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <div className="flex items-center justify-between gap-2 px-2 pb-2 pt-1">
                  <Select value={lang} onValueChange={(value) => value && setLang(value)}>
                    <SelectTrigger size="sm" className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CODE_LANGUAGES.map((l) => (
                        <SelectItem key={l.value} value={l.value}>
                          {l.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="tagline text-[9px] text-primary">Code mode</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-end gap-1.5">
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFilePick} />

            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 rounded-2xl"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach file"
            >
              <Paperclip className="size-[18px]" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className={cn('shrink-0 rounded-2xl', isCode && 'bg-primary/15 text-primary')}
              onClick={() => setIsCode((v) => !v)}
              aria-label="Toggle code snippet mode"
              aria-pressed={isCode}
            >
              <Code2 className="size-[18px]" />
            </Button>

            <Textarea
              placeholder={isCode ? 'Paste your code…' : 'Message, or paste some text…'}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !isCode && enterSends && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              enterKeyHint={enterSends && !isCode ? 'send' : 'enter'}
              rows={1}
              className={cn(
                'max-h-40 min-h-10 resize-none overflow-y-auto border-0 bg-transparent py-2.5 shadow-none focus-visible:ring-0 dark:bg-transparent',
                isCode && 'font-mono text-sm'
              )}
            />

            <motion.div animate={{ scale: canSend ? 1 : 0.92, opacity: canSend ? 1 : 0.5 }}>
              <Button
                size="icon"
                className="shrink-0 rounded-2xl bg-gradient-brand"
                onClick={handleSend}
                disabled={!canSend}
                aria-label="Send"
              >
                <SendHorizonal className="size-[18px]" />
              </Button>
            </motion.div>
          </div>
        </div>

        <div className="mt-1.5 flex items-center justify-between px-3">
          <span className="text-[10px] text-muted-foreground">
            {!enterSends ? 'Tap send to share' : isCode ? 'Code mode · use the send button' : 'Enter to send · Shift+Enter for newline'}
          </span>
          {showCount && (
            <span className={cn('text-[10px] tabular-nums', nearLimit ? 'text-destructive' : 'text-muted-foreground')}>
              {content.length.toLocaleString()} / {MAX_PASTE_LENGTH.toLocaleString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
