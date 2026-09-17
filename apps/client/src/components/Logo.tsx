import { cn } from '@/lib/utils';

interface LogoProps {
  /** Rendered height in px; width follows automatically from the image's real aspect ratio. */
  height?: number;
  className?: string;
}

/** FluxRoom mark: people + chat/code/file icons, orbiting. */
export function Logo({ height = 40, className }: LogoProps) {
  return (
    <img
      src="/logo.png"
      alt="FluxRoom"
      draggable={false}
      className={cn('w-auto object-contain', className)}
      style={{ height }}
    />
  );
}
