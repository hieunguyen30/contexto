import Link from 'next/link';

export function ProgressBar({
  value,
  max,
  tone = 'primary',
  label,
}: {
  value: number;
  max: number;
  tone?: 'primary' | 'mint' | 'flame';
  label?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const color = { primary: 'bg-primary', mint: 'bg-mint', flame: 'bg-flame' }[tone];
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
      className="h-2.5 w-full overflow-hidden rounded-full bg-raised"
    >
      <div className={`h-full rounded-full ${color} transition-[width] duration-700 ease-out`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Tag({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'primary' | 'mint' | 'flame' | 'danger' }) {
  const tones = {
    neutral: '',
    primary: '!bg-primary/10 !text-primary',
    mint: '!bg-mint/15 !text-mint-ink',
    flame: '!bg-flame/15 !text-flame-ink',
    danger: '!bg-danger/10 !text-danger',
  };
  return <span className={`tag ${tones[tone]}`}>{children}</span>;
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
      {children}
    </p>
  );
}

export function PageHeader({
  kicker,
  title,
  children,
}: {
  kicker?: React.ReactNode;
  title: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {kicker && <div className="text-xs font-bold uppercase tracking-widest text-primary">{kicker}</div>}
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
      </div>
      {children}
    </header>
  );
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted transition hover:text-primary">
      ← {children}
    </Link>
  );
}

export function LoadingCard() {
  return (
    <div className="card space-y-3 p-6">
      <div className="skeleton h-4 w-24" />
      <div className="skeleton h-6 w-3/4" />
      <div className="skeleton h-4 w-1/2" />
    </div>
  );
}

export function errorMessage(e: unknown, fallback: string): string {
  const err = e as { response?: { data?: { error?: string } }; message?: string };
  return err.response?.data?.error || err.message || fallback;
}
