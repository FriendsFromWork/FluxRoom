import { cn } from '@/lib/utils';

interface LogoProps {
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
  width = 80,
  height = 40,
  className,
}: LogoProps) {
  return (
    <img
      src="/logo.png"
      alt="Fluxroom"
      width={width}
      height={height}
      draggable={false}
      className={cn('rounded-lg object-contain', className)}
      style={{
        width: `${width}px`,
        height: `${height}px`,
      }}
    />
  );
}