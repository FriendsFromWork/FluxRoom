import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Copy, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

  const handleCopy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Share2 className="size-4" />
            Share
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
