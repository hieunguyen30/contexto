import type { Config } from 'tailwindcss';

// Colours are CSS variables (see globals.css) holding space-separated RGB channels, so one set of
// utility classes works in light and dark mode and still supports opacity (bg-primary/10).
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: token('canvas'),
        surface: token('surface'),
        raised: token('raised'),
        line: token('line'),
        ink: token('ink'),
        muted: token('muted'),
        primary: { DEFAULT: token('primary'), strong: token('primary-strong'), ink: token('primary-ink') },
        accent: token('accent'),
        flame: token('flame'),
        'flame-ink': token('flame-ink'),
        'mint-ink': token('mint-ink'),
        mint: token('mint'),
        danger: token('danger'),
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Target-language sentences: a readable serif so example text feels like "the text you're learning".
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
      },
      borderRadius: { xl: '0.875rem', '2xl': '1.125rem' },
      // Plus Jakarta Sans has tight word spaces; the default 'tight' (-0.025em) made headings cramped.
      letterSpacing: { tight: '-0.005em', tighter: '-0.015em' },
      boxShadow: {
        card: '0 1px 2px rgb(15 23 42 / 0.04), 0 4px 16px -6px rgb(15 23 42 / 0.08)',
        lift: '0 2px 4px rgb(15 23 42 / 0.05), 0 12px 28px -10px rgb(37 99 235 / 0.28)',
        glow: '0 0 0 1px rgb(var(--primary) / 0.55), 0 0 24px -4px rgb(var(--primary) / 0.45)',
      },
      keyframes: {
        'pop-in': { '0%': { opacity: '0', transform: 'translateY(6px) scale(.98)' }, '100%': { opacity: '1', transform: 'none' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        'flame-flicker': { '0%,100%': { transform: 'scale(1) rotate(-2deg)' }, '50%': { transform: 'scale(1.08) rotate(2deg)' } },
      },
      animation: {
        'pop-in': 'pop-in .28s cubic-bezier(.2,.8,.2,1) both',
        shimmer: 'shimmer 1.6s linear infinite',
        'flame-flicker': 'flame-flicker 1.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
