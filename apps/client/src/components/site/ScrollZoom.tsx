import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';

/**
 * A pinned, scroll-linked zoom (the content scales up as you scroll through it, and
 * back down as it leaves) — distinct from Reveal's one-shot fade-in-on-view. The tall
 * wrapper gives scroll distance for the effect; the inner content stays pinned to the
 * viewport via `sticky` while it plays out.
 */
export function ScrollZoom({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.6, 1.15, 0.6]);
  const opacity = useTransform(scrollYProgress, [0, 0.15, 0.5, 0.85, 1], [0, 1, 1, 1, 0]);

  return (
    <div ref={ref} className="relative h-[160vh]">
      <div className="sticky top-0 flex h-svh items-center justify-center overflow-hidden px-6">
        <motion.div style={{ scale, opacity }}>{children}</motion.div>
      </div>
    </div>
  );
}
