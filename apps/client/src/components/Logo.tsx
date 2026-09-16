import { cn } from '@/lib/utils';

interface LogoProps {
  size?: number;
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Fluxroom logo:
 * People + chat/code/file icons with the FluxRoom wordmark
 * baked into the logo artwork.
 */
export function Logo({
  size,
  width,
  height,
  className,
}: LogoProps) {
  // If width/height are provided, use them.
  // Otherwise fall back to the old `size` behavior.
  const logoWidth = width ?? size ?? 32;
  const logoHeight = height ?? size ?? 32;

  return (
    <img
      src="/logo.png"
      alt="Fluxroom"
      width={logoWidth}
      height={logoHeight}
      draggable={false}
      className={cn('rounded-lg object-contain', className)}
      style={{
        width: `${logoWidth}px`,
        height: `${logoHeight}px`,
      }}
    />
  );
}