'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { IN_FLIGHT, useAppData } from '@/components/AppData';
import PostCard from '@/components/PostCard';
import { ErrorNote, LoadingCard, PageHeader, ProgressBar } from '@/components/ui';
import { BoltIcon, CheckIcon, PlusIcon } from '@/components/icons';

type Filter = 'all' | 'ready' | 'progress';

function DailyChallenge() {
  const { stats, due } = useAppData();
  if (!stats) return <div className="skeleton mb-6 h-36 rounded-2xl" />;
  const done = stats.reviewed_today;
  const goal = stats.daily_goal;
  const complete = done >= goal;

  return (
    <section
      className="relative mb-6 overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-surface to-accent/10 p-6 shadow-card dark:shadow-glow"
      aria-label="Daily challenge"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-primary">
            <BoltIcon width={14} height={14} /> Daily challenge
          </div>
          <h2 className="mt-1.5 text-xl font-extrabold tracking-tight">
            {complete ? 'Goal complete. Nice work!' : `Review ${Math.max(goal - done, 0)} more word${goal - done === 1 ? '' : 's'} today`}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {stats.due_count > 0 ? `${stats.due_count} word${stats.due_count === 1 ? ' is' : 's are'} waiting for you.` : 'Nothing due right now.'}
          </p>
        </div>
        {due.length > 0 ? (
          <Link href={`/quiz/${due[0]._id}`} className="btn btn-primary">
            {complete ? 'Keep going' : 'Start reviewing'} →
          </Link>
        ) : (
          <Link href="/upload" className="btn btn-ghost">
            <PlusIcon width={16} height={16} /> Add content
          </Link>
        )}
      </div>
      <div className="mt-5 flex items-center gap-3">
        <div className="flex-1">
          <ProgressBar value={done} max={goal} tone={complete ? 'mint' : 'primary'} label="Daily goal" />
        </div>
        <span className={`inline-flex items-center gap-1 text-sm font-bold ${complete ? 'text-mint-ink' : 'text-muted'}`}>
          {complete && <CheckIcon width={16} height={16} />}
          {Math.min(done, goal)}/{goal}
        </span>
      </div>
    </section>
  );
}

export default function DashboardPage() {
  const { library, loading, error, language } = useAppData();
  const [filter, setFilter] = useState<Filter>('all');

  const items = useMemo(
    () =>
      library
        .filter((c) => language === 'all' || c.language === language)
        .filter((c) => {
          const inFlight = IN_FLIGHT.includes(c.status ?? 'ready');
          if (filter === 'ready') return (c.status ?? 'ready') === 'ready';
          if (filter === 'progress') return inFlight || c.status === 'failed';
          return true;
        }),
    [library, language, filter]
  );

  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'ready', label: 'Ready' },
    { id: 'progress', label: 'In progress' },
  ];

  return (
    <>
      <PageHeader kicker={language === 'all' ? 'Your feed' : `${language} feed`} title="What are we learning today?">
        <Link href="/upload" className="btn btn-primary hidden sm:inline-flex">
          <PlusIcon width={16} height={16} /> Add content
        </Link>
      </PageHeader>

      {error && <div className="mb-4"><ErrorNote>{error}</ErrorNote></div>}

      <DailyChallenge />

      <div className="mb-4 flex items-center gap-2" role="tablist" aria-label="Filter feed">
        {filters.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={filter === f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition active:scale-95 ${
              filter === f.id ? 'bg-ink text-canvas' : 'bg-raised text-muted hover:text-ink'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4"><LoadingCard /><LoadingCard /></div>
      ) : items.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-10 text-center">
          <div className="text-4xl">📚</div>
          <h2 className="text-lg font-bold">{library.length === 0 ? 'Your feed is empty' : 'Nothing matches this filter'}</h2>
          <p className="max-w-sm text-sm text-muted">
            {library.length === 0
              ? 'Paste an article or YouTube link and Contexto turns it into vocabulary, quizzes and a chat you can ask questions.'
              : 'Try another filter or language.'}
          </p>
          {library.length === 0 && (
            <Link href="/upload" className="btn btn-primary mt-1">
              Add your first link
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((c, i) => (
            <PostCard key={c._id} item={c} index={i} />
          ))}
        </div>
      )}
    </>
  );
}
