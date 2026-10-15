'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ingestContent, type SourceType } from '@/lib/api';
import { useAppData } from '@/components/AppData';
import { ErrorNote, PageHeader, errorMessage } from '@/components/ui';
import { GlobeIcon, LinkIcon } from '@/components/icons';

const SOURCES: { id: SourceType; label: string; hint: string }[] = [
  { id: 'article', label: 'Article', hint: 'News, blog posts, Wikipedia…' },
  { id: 'youtube', label: 'YouTube', hint: 'Videos with captions' },
];
const SUGGESTED = ['Spanish', 'French', 'German', 'Japanese', 'Vietnamese', 'Italian'];

export default function UploadPage() {
  const router = useRouter();
  const { refresh, language } = useAppData();
  const [url, setUrl] = useState('');
  const [sourceType, setSourceType] = useState<SourceType>('article');
  const [targetLanguage, setTargetLanguage] = useState('Spanish');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start from the language picked in the sidebar, if any.
  useEffect(() => {
    if (language !== 'all') setTargetLanguage(language);
  }, [language]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await ingestContent({ url: url.trim(), source_type: sourceType, target_language: targetLanguage.trim() });
      await refresh(); // the new card appears in the feed already queued
      router.push('/dashboard');
    } catch (err) {
      setError(errorMessage(err, 'Upload failed'));
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader kicker="New post" title="Add something to learn from" />

      <form onSubmit={submit} className="card animate-pop-in space-y-6 p-6 sm:p-8">
        <fieldset>
          <legend className="mb-2 text-sm font-bold">Source</legend>
          <div className="grid grid-cols-2 gap-3">
            {SOURCES.map((s) => (
              <label
                key={s.id}
                className={`cursor-pointer rounded-xl border-2 p-4 transition active:scale-[.98] ${
                  sourceType === s.id ? 'border-primary bg-primary/5' : 'border-line hover:border-primary/40'
                }`}
              >
                <input type="radio" name="source_type" value={s.id} checked={sourceType === s.id} onChange={() => setSourceType(s.id)} className="sr-only" />
                <div className="font-bold">{s.label}</div>
                <div className="mt-0.5 text-xs text-muted">{s.hint}</div>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="url" className="mb-2 flex items-center gap-1.5 text-sm font-bold">
            <LinkIcon width={16} height={16} /> Link
          </label>
          <input id="url" type="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className="input" />
        </div>

        <div>
          <label htmlFor="lang" className="mb-2 flex items-center gap-1.5 text-sm font-bold">
            <GlobeIcon width={16} height={16} /> Language you&apos;re learning
          </label>
          <input id="lang" type="text" required value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value)} placeholder="Spanish, French, Japanese…" className="input" />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SUGGESTED.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setTargetLanguage(l)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition active:scale-95 ${
                  targetLanguage === l ? 'bg-primary text-primary-ink' : 'bg-raised text-muted hover:text-ink'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {error && <ErrorNote>{error}</ErrorNote>}

        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-muted">We read it in the background. Watch progress on your feed.</p>
          <button type="submit" disabled={submitting} className="btn btn-primary">
            {submitting ? 'Posting…' : 'Post'}
          </button>
        </div>
      </form>
    </>
  );
}
