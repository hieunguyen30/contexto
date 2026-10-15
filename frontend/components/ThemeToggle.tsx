'use client';

import { useEffect, useState } from 'react';
import { MoonIcon, SunIcon } from './icons';

const KEY = 'contexto:theme';

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const [dark, setDark] = useState(false);

  // The inline script in layout.tsx already set the class before paint; mirror it into state.
  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try {
      window.localStorage.setItem(KEY, next ? 'dark' : 'light');
    } catch {
      /* ignore */
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`grid h-9 w-9 place-items-center rounded-xl border border-line text-muted transition hover:border-primary/50 hover:text-primary active:scale-95 ${className}`}
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
