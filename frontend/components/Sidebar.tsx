'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from './AuthProvider';
import { useAppData } from './AppData';
import ThemeToggle from './ThemeToggle';
import { ProgressBar } from './ui';
import { BoltIcon, FlameIcon, GlobeIcon, HomeIcon, PlusIcon, SignOutIcon } from './icons';

export function Brand() {
  return (
    <Link href="/dashboard" className="group flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-lg font-black text-white shadow-sm transition group-hover:rotate-6">
        C
      </span>
      <span className="text-lg font-extrabold tracking-tight">Contexto</span>
    </Link>
  );
}

export function useReviewHref(): string {
  const { due } = useAppData();
  return due.length > 0 ? `/quiz/${due[0]._id}` : '/dashboard';
}

function NavItem({ href, active, icon, children, badge }: { href: string; active: boolean; icon: React.ReactNode; children: React.ReactNode; badge?: number }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
        active ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-raised hover:text-ink'
      }`}
    >
      {icon}
      <span className="flex-1">{children}</span>
      {badge ? <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-ink">{badge}</span> : null}
    </Link>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { user, signOutUser } = useAuth();
  const { stats, due, languages, language, setLanguage } = useAppData();
  const reviewHref = useReviewHref();

  const goal = stats?.daily_goal ?? 10;
  const done = stats?.reviewed_today ?? 0;
  const streak = stats?.streak_days ?? 0;

  return (
    <aside className="sticky top-0 hidden h-screen flex-col gap-5 overflow-y-auto py-6 pr-2 lg:flex">
      <Brand />

      <nav className="flex flex-col gap-1" aria-label="Main">
        <NavItem href="/dashboard" active={pathname === '/dashboard' || pathname.startsWith('/content')} icon={<HomeIcon />}>
          Feed
        </NavItem>
        <NavItem href="/upload" active={pathname === '/upload'} icon={<PlusIcon />}>
          Add content
        </NavItem>
        <NavItem href={reviewHref} active={pathname.startsWith('/quiz')} icon={<BoltIcon />} badge={due.length || undefined}>
          Review
        </NavItem>
      </nav>

      <section className="card p-4" aria-label="Streak">
        <div className="flex items-center gap-3">
          <span className={`grid h-11 w-11 place-items-center rounded-xl ${streak > 0 ? 'bg-flame/15 text-flame' : 'bg-raised text-muted'}`}>
            <FlameIcon width={26} height={26} className={streak > 0 ? 'animate-flame-flicker' : ''} />
          </span>
          <div>
            <div className="text-2xl font-extrabold leading-none">{streak}</div>
            <div className="mt-1 text-xs font-semibold text-muted">day streak</div>
          </div>
        </div>
        <div className="mt-4">
          <div className="mb-1.5 flex justify-between text-xs font-semibold">
            <span className="text-muted">Daily goal</span>
            <span className={done >= goal ? 'text-mint-ink' : ''}>
              {Math.min(done, goal)}/{goal} reviews
            </span>
          </div>
          <ProgressBar value={done} max={goal} tone={done >= goal ? 'mint' : 'primary'} label="Daily goal progress" />
        </div>
      </section>

      <section aria-label="Language">
        <div className="mb-2 flex items-center gap-1.5 px-1 text-xs font-bold uppercase tracking-widest text-muted">
          <GlobeIcon width={14} height={14} /> Language
        </div>
        <div className="flex flex-wrap gap-1.5">
          {['all', ...languages].map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLanguage(l)}
              aria-pressed={language === l}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition active:scale-95 ${
                language === l ? 'bg-primary text-primary-ink shadow-sm' : 'bg-raised text-muted hover:text-ink'
              }`}
            >
              {l === 'all' ? 'All' : l}
            </button>
          ))}
        </div>
      </section>

      <div className="mt-auto flex items-center gap-2 border-t border-line pt-4">
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold">{user?.displayName || user?.email}</div>
          <div className="truncate text-xs text-muted">{user?.displayName ? user?.email : 'Signed in'}</div>
        </div>
        <ThemeToggle />
        <button
          type="button"
          onClick={() => void signOutUser()}
          aria-label="Sign out"
          className="grid h-9 w-9 place-items-center rounded-xl border border-line text-muted transition hover:border-danger/50 hover:text-danger active:scale-95"
        >
          <SignOutIcon />
        </button>
      </div>
    </aside>
  );
}
