'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getLibrary,
  getDueVocab,
  getContentStatus,
  type ContentItem,
  type IngestStatus,
  type VocabItem,
} from '@/lib/api';

const POLL_MS = 2000;
const IN_FLIGHT: IngestStatus[] = ['queued', 'processing'];

const STATUS_LABEL: Record<IngestStatus, string> = {
  queued: 'Queued…',
  processing: 'Processing: scrape → chunk → embed…',
  ready: 'Ready',
  failed: 'Failed',
};

export default function DashboardPage() {
  const [library, setLibrary] = useState<ContentItem[]>([]);
  const [due, setDue] = useState<VocabItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Poll status of in-flight ingestions and merge into the library cards.
  const pollInFlight = useCallback(async (items: ContentItem[]) => {
    const pending = items.filter((c) => IN_FLIGHT.includes(c.status ?? 'ready'));
    if (pending.length === 0) return;
    const results = await Promise.allSettled(pending.map((c) => getContentStatus(c._id)));
    setLibrary((prev) =>
      prev.map((c) => {
        const i = pending.findIndex((p) => p._id === c._id);
        const r = i >= 0 ? results[i] : undefined;
        if (r && r.status === 'fulfilled') {
          return { ...c, status: r.value.status, error: r.value.error, title: r.value.title };
        }
        return c;
      })
    );
  }, []);

  const anyInFlight = library.some((c) => IN_FLIGHT.includes(c.status ?? 'ready'));
  useEffect(() => {
    if (!anyInFlight) return;
    const t = setInterval(() => void pollInFlight(library), POLL_MS);
    return () => clearInterval(t);
  }, [anyInFlight, library, pollInFlight]);

  useEffect(() => {
    (async () => {
      try {
        const [lib, dueList] = await Promise.all([getLibrary(), getDueVocab()]);
        setLibrary(lib);
        setDue(dueList);
      } catch (e: unknown) {
        const err = e as { response?: { data?: { error?: string } }; message?: string };
        setError(err.response?.data?.error || err.message || 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>

      {error && (
        <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Streak" value="—" hint="Tracking coming soon" />
        <StatCard label="Due today" value={String(due.length)} hint="Vocab ready for review" />
        <StatCard label="Library" value={String(library.length)} hint="Pieces of content" />
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Due for review</h2>
          {due.length > 0 && (
            <Link
              href={`/quiz/${due[0]._id}`}
              className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800"
            >
              Start reviewing
            </Link>
          )}
        </div>
        {loading ? (
          <p className="mt-3 text-sm text-slate-500">Loading…</p>
        ) : due.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            Nothing due. Add content or come back later.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-200 rounded border border-slate-200 bg-white">
            {due.slice(0, 10).map((v) => (
              <li key={v._id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <div className="font-medium">{v.word}</div>
                  <div className="truncate text-xs text-slate-500">{v.definition}</div>
                </div>
                <Link
                  href={`/quiz/${v._id}`}
                  className="ml-4 shrink-0 rounded border border-slate-300 px-3 py-1 text-sm hover:border-slate-500"
                >
                  Quiz
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Library</h2>
          <Link href="/upload" className="text-sm text-slate-600 hover:text-slate-900">
            + Add content
          </Link>
        </div>
        {loading ? (
          <p className="mt-3 text-sm text-slate-500">Loading…</p>
        ) : library.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            Empty.{' '}
            <Link href="/upload" className="underline">
              Upload something
            </Link>
            .
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {library.map((c) => {
              const st: IngestStatus = c.status ?? 'ready';
              return (
              <Link
                key={c._id}
                href={st === 'ready' ? `/content/${c._id}` : '/dashboard'}
                className="rounded border border-slate-200 bg-white p-4 transition hover:border-slate-400"
              >
                <div className="text-xs uppercase tracking-wide text-slate-400">
                  {c.source_type} · {c.language}
                </div>
                <div className="mt-1 line-clamp-2 font-medium">{c.title}</div>
                <div className="mt-2 text-xs text-slate-500">
                  {new Date(c.created_at).toLocaleDateString()}
                </div>
                {st !== 'ready' && (
                  <div
                    className={`mt-2 text-xs ${st === 'failed' ? 'text-red-600' : 'text-amber-600'}`}
                  >
                    {STATUS_LABEL[st]}
                    {st === 'failed' && c.error ? ` — ${c.error}` : ''}
                    {IN_FLIGHT.includes(st) && (
                      <div className="mt-1 h-1 overflow-hidden rounded bg-slate-100">
                        <div
                          className={`h-full bg-amber-400 ${st === 'queued' ? 'w-1/4' : 'w-2/3'} animate-pulse`}
                        />
                      </div>
                    )}
                  </div>
                )}
              </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded border border-slate-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}
