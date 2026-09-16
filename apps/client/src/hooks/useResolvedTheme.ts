import { useEffect, useState } from 'react';

/** Tracks whether the `dark` class is currently applied to <html>, for components (like CodeMirror) that need a resolved light/dark value rather than the raw 'system' preference. */
export function useResolvedTheme(): 'light' | 'dark' {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => setIsDark(root.classList.contains('dark')));
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return isDark ? 'dark' : 'light';
}
