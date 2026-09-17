import { motion } from 'motion/react';

interface RevealProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

/** Fades, lifts, and scales content into view the first time it's scrolled to. */
export function Reveal({ children, delay = 0, className }: RevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
