'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getContent, getVocabForContent, extractVocab, type ContentItem, type VocabItem } from '@/lib/api';
import { useAppData } from '@/components/AppData';
import { BackLink, ErrorNote, LoadingCard, Tag, errorMessage } from '@/components/ui';
import { BoltIcon, ChatIcon, LinkIcon, SparkIcon } from '@/components/icons';

type Difficulty = 'beginner' | 'intermediate' | 'advanced';
const LEVELS: Difficulty[] = ['beginner', 'intermediate', 'advanced'];

export default function ContentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { refresh } = useAppData();
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
      } catch (e) {
        setError(errorMessage(e, 'Failed to load'));
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
      void refresh(); // word counts + due list in the sidebar/feed
    } catch (e) {
      setError(errorMessage(e, 'Extraction failed'));
    } finally {
      setExtracting(false);
    }
  };

  if (loading) return <LoadingCard />;
  if (error && !content) return <ErrorNote>{error}</ErrorNote>;
  if (!content) return null;

  return (
    <>
      <BackLink href="/dashboard">Feed</BackLink>

      <article className="card animate-pop-in p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-1.5">
          <Tag tone="primary">{content.source_type === 'youtube' ? 'Video' : 'Article'}</Tag>
          <Tag>{content.language}</Tag>
          {content.chunk_count ? <Tag>{content.chunk_count} passages</Tag> : null}
        </div>
        <h1 className="mt-3 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">{content.title}</h1>
        {content.source_url && (
          <a href={content.source_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 break-all text-sm text-muted transition hover:text-primary">
            <LinkIcon width={14} height={14} /> {content.source_url}
          </a>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          {vocab.length > 0 && (
            <Link href={`/quiz/${vocab[0]._id}`} className="btn btn-primary">
              <BoltIcon width={16} height={16} /> Start quiz
            </Link>
          )}
          <Link href={`/chat/${content._id}`} className="btn btn-ghost">
            <ChatIcon width={16} height={16} /> Chat about this
          </Link>
        </div>
      </article>

      <section className="mt-8" aria-labelledby="vocab-h">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="vocab-h" className="text-lg font-extrabold">
            Vocabulary <span className="ml-1 text-sm font-semibold text-muted">{vocab.length}</span>
          </h2>
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl bg-raised p-1" role="radiogroup" aria-label="Difficulty">
              {LEVELS.map((l) => (
                <button
                  key={l}
                  type="button"
                  role="radio"
                  aria-checked={difficulty === l}
                  onClick={() => setDifficulty(l)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${
                    difficulty === l ? 'bg-surface text-primary shadow-sm' : 'text-muted hover:text-ink'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            <button type="button" onClick={onExtract} disabled={extracting} className="btn btn-soft">
              <SparkIcon width={16} height={16} /> {extracting ? 'Extracting…' : 'Extract vocab'}
            </button>
          </div>
        </div>

        {error && <div className="mb-4"><ErrorNote>{error}</ErrorNote></div>}

        {extracting && vocab.length === 0 && (
          <div className="space-y-3"><LoadingCard /><LoadingCard /></div>
        )}

        {vocab.length === 0 && !extracting ? (
          <div className="card p-8 text-center text-sm text-muted">
            No vocabulary yet. Pick a level and press <strong className="text-ink">Extract vocab</strong>. The tutor picks the 10 most useful words.
          </div>
        ) : (
          <ol className="space-y-3">
            {vocab.map((v, i) => (
              <li key={v._id} className="animate-pop-in" style={{ animationDelay: `${Math.min(i, 10) * 35}ms` }}>
                {/* Thread-style entry: accent rail on the left like a nested comment. */}
                <div className="card card-hover flex gap-4 border-l-4 !border-l-primary/60 p-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-3">
                      <span className="font-serif text-2xl font-bold tracking-tight">{v.word}</span>
                      {v.translation && <span className="text-sm font-semibold text-accent">→ {v.translation}</span>}
                    </div>
                    <p className="mt-1 text-sm text-muted">{v.definition}</p>
                    {v.example_sentence && (
                      <p className="mt-3 border-l-2 border-line pl-3 font-serif text-[15px] italic leading-relaxed">
                        &ldquo;{v.example_sentence}&rdquo;
                      </p>
                    )}
                  </div>
                  <Link href={`/quiz/${v._id}`} className="btn btn-ghost h-fit shrink-0 !px-3 !py-1.5">
                    Quiz
                  </Link>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
