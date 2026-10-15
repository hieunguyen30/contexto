'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AppDataProvider, { useAppData } from './AppData';
import Sidebar, { Brand, useReviewHref } from './Sidebar';
import RightRail from './RightRail';
import ThemeToggle from './ThemeToggle';
import { BoltIcon, FlameIcon, HomeIcon, PlusIcon } from './icons';

function MobileTop() {
  const { stats } = useAppData();
  const streak = stats?.streak_days ?? 0;
  return (
    <header className="sticky top-0 z-30 -mx-4 mb-4 flex items-center justify-between border-b border-line bg-canvas/85 px-4 py-3 backdrop-blur lg:hidden">
      <Brand />
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold ${streak > 0 ? 'bg-flame/15 text-flame' : 'bg-raised text-muted'}`}>
          <FlameIcon width={16} height={16} /> {streak}
        </span>
        <ThemeToggle />
      </div>
    </header>
  );
}

function MobileNav() {
  const pathname = usePathname();
  const reviewHref = useReviewHref();
  const items = [
    { href: '/dashboard', label: 'Feed', icon: <HomeIcon />, active: pathname === '/dashboard' || pathname.startsWith('/content') },
    { href: '/upload', label: 'Add', icon: <PlusIcon />, active: pathname === '/upload' },
    { href: reviewHref, label: 'Review', icon: <BoltIcon />, active: pathname.startsWith('/quiz') },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Main">
      {items.map((i) => (
        <Link
          key={i.label}
          href={i.href}
          aria-current={i.active ? 'page' : undefined}
          className={`flex flex-col items-center gap-0.5 py-2.5 text-xs font-semibold transition ${i.active ? 'text-primary' : 'text-muted'}`}
        >
          {i.icon}
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AppDataProvider>
      <div className="mx-auto grid min-h-screen max-w-[1280px] grid-cols-1 gap-8 px-4 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)_20rem]">
        <Sidebar />
        <div className="min-w-0 pb-24 lg:py-6 lg:pb-10">
          <MobileTop />
          <main id="main">{children}</main>
        </div>
        <RightRail />
      </div>
      <MobileNav />
    </AppDataProvider>
  );
}
