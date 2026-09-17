import { useState } from 'react';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Copy, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { copyToClipboard } from '@/lib/clipboard';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export function ShareRoomDialog({ roomName }: { roomName: string }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/r/${roomName}`;
  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  const handleCopy = async () => {
    const ok = await copyToClipboard(link);
    if (!ok) {
      toast.error('Could not copy — try selecting the link manually.');
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleNativeShare = async () => {
    try {
      await navigator.share({ title: `Join ${roomName} on FluxRoom`, url: link });
    } catch {
      // user cancelled the native share sheet, or it's unsupported — no-op
    }
  };

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" aria-label="Share room">
            <Share2 className="size-4" />
            <span className="hidden sm:inline">Share</span>
          </Button>
        }
      />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Invite to {roomName}</DialogTitle>
          <DialogDescription>Scan the code or share the link to join this room.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          <div className="rounded-lg border bg-white p-3">
            <QRCodeSVG value={link} size={180} />
          </div>

          <div className="flex w-full gap-2">
            <Input readOnly value={link} className="text-xs" />
            <Button size="icon" variant="secondary" onClick={handleCopy} aria-label="Copy link">
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
          </div>

          {canNativeShare && (
            <Button variant="secondary" className="w-full" onClick={handleNativeShare}>
              <Share2 className="size-4" />
              Share via…
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
