import { useEffect } from 'react';

/**
 * Keeps a `--app-height` CSS variable in sync with the *visual* viewport.
 *
 * `100dvh` alone isn't enough: when a mobile on-screen keyboard opens, some browsers
 * (notably iOS Safari, even with `interactive-widget=resizes-content` set) don't shrink
 * `dvh` to match, so a `h-dvh` container keeps its full pre-keyboard height and the
 * composer at its bottom ends up rendered underneath the keyboard — it looks like it
 * "went missing". `window.visualViewport` reliably reports the space actually visible
 * above the keyboard, so consumers can use `h-[var(--app-height,100dvh)]` instead of
 * `h-dvh` to stay correctly sized in every browser.
 */
export function useViewportHeight(): void {
  useEffect(() => {
    const viewport = window.visualViewport;
    const setHeight = () => {
      const height = viewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty('--app-height', `${height}px`);
    };

    setHeight();
    viewport?.addEventListener('resize', setHeight);
    window.addEventListener('resize', setHeight);
    return () => {
      viewport?.removeEventListener('resize', setHeight);
      window.removeEventListener('resize', setHeight);
    };
  }, []);
}
