import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { cn } from '@/lib/utils';
import { GITHUB_URL } from '@/lib/links';

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 .5C5.73.5.5 5.73.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.54-3.88-1.54-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.12 3.05.74.81 1.18 1.84 1.18 3.1 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
    </svg>
  );
}

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
];

export function Navbar() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300',
        scrolled || menuOpen
          ? 'border-border bg-background/85 backdrop-blur-xl'
          : 'border-transparent bg-transparent'
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-5 xl:px-10">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex shrink-0 items-center transition-opacity hover:opacity-80"
          aria-label="FluxRoom home"
        >
          <Logo height={52} className="mr-1" />
          <span className="font-display text-lg font-semibold tracking-tight">FluxRoom</span>
        </button>

        <nav className="mx-auto hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="tagline rounded-full px-5 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <Button
            variant="ghost"
            size="icon"
            aria-label="View source on GitHub"
            nativeButton={false}
            render={<a href={GITHUB_URL} target="_blank" rel="noreferrer noopener" />}
          >
            <GithubIcon className="size-[18px]" />
          </Button>

          <ThemeToggle />

          <Button className="hidden bg-gradient-brand glow-primary sm:flex" onClick={() => navigate('/setup')}>
            Get Started
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Toggle menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <X className="size-[18px]" /> : <Menu className="size-[18px]" />}
          </Button>
        </div>
      </div>

      {menuOpen && (
        <nav className="flex flex-col border-t bg-background/95 px-5 py-2 backdrop-blur-xl lg:hidden">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="tagline py-3 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
          <Button className="my-3 bg-gradient-brand sm:hidden" onClick={() => navigate('/setup')}>
            Get Started
          </Button>
        </nav>
      )}
    </header>
  );
}
