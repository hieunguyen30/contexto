'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  getContent,
  getVocabForContent,
  extractVocab,
  type ContentItem,
  type VocabItem,
} from '@/lib/api';

type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export default function ContentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [content, setContent] = useState<ContentItem | null>(null);
  const [vocab, setVocab] = useState<VocabItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('intermediate');
  const [extracting, setExtracting] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [c, v] = await Promise.all([getContent(id), getVocabForContent(id)]);
        setContent(c);
        setVocab(v);
      } catch (e: unknown) {
        const err = e as { response?: { data?: { error?: string } }; message?: string };
        setError(err.response?.data?.error || err.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const onExtract = async () => {
    if (!id) return;
    setExtracting(true);
    setError(null);
    try {
      const { vocab: created } = await extractVocab(id, difficulty);
      setVocab((prev) => [...created, ...prev]);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || err.message || 'Extraction failed');
    } finally {
      setExtracting(false);
    }
  };

  if (loading) return <main className="mx-auto max-w-3xl px-6 py-8 text-sm text-slate-500">Loading…</main>;
  if (error && !content) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-8">
        <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
      </main>
    );
  }
  if (!content) return null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <div className="text-xs uppercase tracking-wide text-slate-400">
        {content.source_type} · {content.language}
      </div>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{content.title}</h1>
      {content.source_url && (
        <a
          href={content.source_url}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-block text-sm text-slate-500 underline"
        >
          {content.source_url}
        </a>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        {vocab.length > 0 && (
          <Link
            href={`/quiz/${vocab[0]._id}`}
            className="rounded bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
          >
            Start quiz
          </Link>
        )}
        <Link
          href={`/chat/${content._id}`}
          className="rounded border border-slate-300 px-4 py-2 text-sm hover:border-slate-500"
        >
          Chat with content
        </Link>
      </div>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Vocabulary</h2>
          <div className="flex items-center gap-2">
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as Difficulty)}
              className="rounded border border-slate-300 px-2 py-1 text-sm"
            >
              <option value="beginner">beginner</option>
              <option value="intermediate">intermediate</option>
              <option value="advanced">advanced</option>
            </select>
            <button
              type="button"
              onClick={onExtract}
              disabled={extracting}
              className="rounded border border-slate-300 px-3 py-1 text-sm hover:border-slate-500 disabled:opacity-60"
            >
              {extracting ? 'Extracting…' : 'Extract vocab'}
            </button>
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {vocab.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            No vocab yet. Pick a difficulty and click <em>Extract vocab</em>.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-200 rounded border border-slate-200 bg-white">
            {vocab.map((v) => (
              <li key={v._id} className="flex items-start justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <div className="font-medium">{v.word}</div>
                  <div className="text-sm text-slate-600">{v.definition}</div>
                  {v.translation && (
                    <div className="text-xs text-slate-400">→ {v.translation}</div>
                  )}
                  {v.example_sentence && (
                    <div className="mt-1 text-xs italic text-slate-500">
                      &ldquo;{v.example_sentence}&rdquo;
                    </div>
                  )}
                </div>
                <Link
                  href={`/quiz/${v._id}`}
                  className="shrink-0 rounded border border-slate-300 px-3 py-1 text-sm hover:border-slate-500"
                >
                  Quiz
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
