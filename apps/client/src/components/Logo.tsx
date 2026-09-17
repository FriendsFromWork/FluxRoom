import { cn } from '@/lib/utils';

interface LogoProps {
  /** Rendered height in px; width follows automatically from the image's real aspect ratio. */
  height?: number;
  className?: string;
}

/**
 * FluxRoom mark, with a variant per theme: the dark one keeps the original glow on a
 * transparent background, the light one recolors the white document icon to ink so it
 * stays visible on light backgrounds. Switched with CSS, not JS, so the right one shows
 * on first paint. Hidden (display: none) variants are skipped by screen readers.
 */
export function Logo({ height = 40, className }: LogoProps) {
  const shared = 'w-auto object-contain';
  return (
    <>
      <img
        src="/logo-light.png"
        alt="FluxRoom"
        draggable={false}
        className={cn(shared, 'block dark:hidden', className)}
        style={{ height }}
      />
      <img
        src="/logo-dark.png"
        alt="FluxRoom"
        draggable={false}
        className={cn(shared, 'hidden dark:block', className)}
        style={{ height }}
      />
    </>
  );
}
