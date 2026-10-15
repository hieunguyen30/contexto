// Small inline icon set (24px grid, 1.75 stroke) so there is no icon-library dependency.
type P = React.SVGProps<SVGSVGElement>;
const base = (p: P) => ({
  width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, ...p,
});

export const HomeIcon = (p: P) => (<svg {...base(p)}><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg>);
export const PlusIcon = (p: P) => (<svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>);
export const ChatIcon = (p: P) => (<svg {...base(p)}><path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12z" /></svg>);
export const BoltIcon = (p: P) => (<svg {...base(p)}><path d="M13 3L5 14h6l-1 7 8-11h-6z" /></svg>);
export const SunIcon = (p: P) => (<svg {...base(p)}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>);
export const MoonIcon = (p: P) => (<svg {...base(p)}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>);
export const PlayIcon = (p: P) => (<svg {...base(p)}><path d="M7 4.5v15l12-7.5z" fill="currentColor" /></svg>);
export const CheckIcon = (p: P) => (<svg {...base(p)}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>);
export const XIcon = (p: P) => (<svg {...base(p)}><path d="M6 6l12 12M18 6L6 18" /></svg>);
export const GlobeIcon = (p: P) => (<svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" /></svg>);
export const LinkIcon = (p: P) => (<svg {...base(p)}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1" /></svg>);
export const SparkIcon = (p: P) => (<svg {...base(p)}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" /></svg>);
export const FlameIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor" stroke="none"><path d="M12.4 2s.5 3-1.6 5.4C8.8 9.7 7 11.2 7 14a5 5 0 0 0 10 0c0-2-1-3.4-2-4.5 0 0 .3 2.3-1.3 3C12.3 12.9 13.5 8 12.4 2z" /></svg>
);
export const BookIcon = (p: P) => (<svg {...base(p)}><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5M8 7h7" /></svg>);
export const SignOutIcon = (p: P) => (<svg {...base(p)}><path d="M15 17l5-5-5-5M20 12H9M12 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h7" /></svg>);
