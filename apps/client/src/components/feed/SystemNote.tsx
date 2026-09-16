export function SystemNote({ text }: { text: string }) {
  return (
    <div className="my-3 flex items-center gap-3">
      <span className="h-px flex-1 bg-border" />
      <span className="tagline text-[9px] text-muted-foreground">{text}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
