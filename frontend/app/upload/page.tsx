'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ingestContent, type SourceType } from '@/lib/api';

export default function UploadPage() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [sourceType, setSourceType] = useState<SourceType>('article');
  const [targetLanguage, setTargetLanguage] = useState('Spanish');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatus('Queuing…');
    setSubmitting(true);
    try {
      const res = await ingestContent({
        url: url.trim(),
        source_type: sourceType,
        target_language: targetLanguage.trim(),
      });
      router.push('/dashboard'); // card shows live ingestion progress
      void res;
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || err.message || 'Upload failed');
      setStatus(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Add content</h1>
      <p className="mt-1 text-sm text-slate-600">
        Paste a YouTube video URL or an article URL. We&apos;ll process it in the background; progress shows on your dashboard.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4 rounded border border-slate-200 bg-white p-6">
        <div>
          <label className="block text-sm font-medium">Source</label>
          <div className="mt-2 flex gap-3">
            {(['article', 'youtube'] as const).map((opt) => (
              <label key={opt} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="source_type"
                  value={opt}
                  checked={sourceType === opt}
                  onChange={() => setSourceType(opt)}
                />
                <span className="capitalize">{opt}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="url" className="block text-sm font-medium">
            URL
          </label>
          <input
            id="url"
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </div>

        <div>
          <label htmlFor="lang" className="block text-sm font-medium">
            Target language
          </label>
          <input
            id="lang"
            type="text"
            required
            value={targetLanguage}
            onChange={(e) => setTargetLanguage(e.target.value)}
            placeholder="Spanish, French, Japanese…"
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </div>

        {error && (
          <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
        )}
        {!error && status && <p className="text-sm text-slate-500">{status}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {submitting ? 'Ingesting…' : 'Ingest'}
        </button>
      </form>
    </main>
  );
}
