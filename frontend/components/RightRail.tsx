'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { practiceFeedback } from '@/lib/api';
import { useAppData } from './AppData';
import { ErrorNote, errorMessage } from './ui';
import { SparkIcon } from './icons';

const MAX = 300;

// "Today's prompt": write a sentence with one of your due words and get tutor feedback.
// (Feedback is from the AI tutor, not other learners: the app has no shared content.)
function PracticePrompt() {
  const { due, library, language } = useAppData();
  const candidates = useMemo(() => {
    const langOf = new Map(library.map((c) => [c._id, c.language]));
    return due.filter((v) => language === 'all' || langOf.get(v.content_id) === language);
  }, [due, library, language]);

  const [index, setIndex] = useState(0);
  const [sentence, setSentence] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const word = candidates.length ? candidates[index % candidates.length] : null;

  useEffect(() => {
    setSentence('');
    setFeedback(null);
    setError(null);
  }, [word?._id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!word || busy || sentence.trim().length < 3) return;
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      setFeedback((await practiceFeedback(word._id, sentence.trim())).feedback);
    } catch (err) {
      setError(errorMessage(err, 'Could not get feedback'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card relative overflow-hidden p-5" aria-label="Today's prompt">
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-accent/15 blur-2xl" />
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-accent">
            <SparkIcon width={14} height={14} /> Today&apos;s prompt
          </span>
          {candidates.length > 1 && (
            <button type="button" onClick={() => setIndex((i) => i + 1)} className="text-xs font-semibold text-muted transition hover:text-primary">
              Shuffle
            </button>
          )}
        </div>

        {!word ? (
          <p className="mt-3 text-sm text-muted">
            No words due{language !== 'all' ? ` in ${language}` : ''}. Add an article and extract vocabulary to unlock daily prompts.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-3">
            <p className="text-sm text-muted">Write one sentence using</p>
            <p className="mt-1 font-serif text-2xl font-bold tracking-tight">{word.word}</p>
            <p className="mt-0.5 text-xs text-muted">{word.definition}</p>

            <textarea
              value={sentence}
              onChange={(e) => setSentence(e.target.value.slice(0, MAX))}
              rows={3}
              placeholder="Your sentence…"
              className="input mt-3 resize-none font-serif text-base"
              aria-label="Your sentence"
            />
            <div className="mt-1 flex items-center justify-between text-xs text-muted">
              <span>{sentence.length}/{MAX}</span>
              <button type="submit" disabled={busy || sentence.trim().length < 3} className="btn btn-primary !px-3 !py-1.5">
                {busy ? 'Checking…' : 'Get feedback'}
              </button>
            </div>
          </form>
        )}

        {error && <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>}
        {feedback && (
          <div className="mt-3 animate-pop-in whitespace-pre-wrap rounded-xl border border-accent/30 bg-accent/5 p-3 text-sm leading-relaxed">
            <div className="mb-1 text-xs font-bold uppercase tracking-widest text-accent">Tutor feedback</div>
            {feedback}
          </div>
        )}
      </div>
    </section>
  );
}

function DueNow() {
  const { due } = useAppData();
  if (due.length === 0) return null;
  return (
    <section className="card p-5" aria-label="Due now">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold">Due now</h2>
        <span className="tag !bg-primary/10 !text-primary">{due.length}</span>
      </div>
      <ul className="mt-3 space-y-1">
        {due.slice(0, 4).map((v) => (
          <li key={v._id}>
            <Link href={`/quiz/${v._id}`} className="group flex items-center justify-between rounded-lg px-2 py-1.5 transition hover:bg-raised">
              <span className="font-serif text-base font-semibold">{v.word}</span>
              <span className="text-xs font-semibold text-primary opacity-0 transition group-hover:opacity-100">Quiz →</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function RightRail() {
  return (
    <aside className="sticky top-0 hidden h-screen flex-col gap-4 overflow-y-auto py-6 xl:flex" aria-label="Practice">
      <PracticePrompt />
      <DueNow />
    </aside>
  );
}
