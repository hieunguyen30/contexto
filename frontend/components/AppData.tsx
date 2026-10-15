'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  getContentStatus,
  getDueVocab,
  getLibrary,
  getStats,
  type ContentItem,
  type IngestStatus,
  type Stats,
  type VocabItem,
} from '@/lib/api';
import { errorMessage } from './ui';

const POLL_MS = 2000;
const LANG_KEY = 'contexto:language';
export const IN_FLIGHT: IngestStatus[] = ['queued', 'processing'];

interface AppData {
  library: ContentItem[];
  due: VocabItem[];
  stats: Stats | null;
  loading: boolean;
  error: string | null;
  languages: string[];
  /** 'all' or a language name; filters the feed and scopes the prompt. */
  language: string;
  setLanguage: (l: string) => void;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AppData | null>(null);

export function useAppData(): AppData {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAppData must be used inside <AppDataProvider>');
  return v;
}

export default function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [library, setLibrary] = useState<ContentItem[]>([]);
  const [due, setDue] = useState<VocabItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguageState] = useState('all');
  const libraryRef = useRef<ContentItem[]>([]);
  libraryRef.current = library;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LANG_KEY);
      if (saved) setLanguageState(saved);
    } catch {
      /* storage unavailable: keep default */
    }
  }, []);

  const setLanguage = useCallback((l: string) => {
    setLanguageState(l);
    try {
      window.localStorage.setItem(LANG_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [lib, dueList, st] = await Promise.all([getLibrary(), getDueVocab(), getStats()]);
      setLibrary(lib);
      setDue(dueList);
      setStats(st);
      setError(null);
    } catch (e) {
      setError(errorMessage(e, 'Failed to load your data'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Poll in-flight ingestions; when one finishes, reload so word counts appear.
  const anyInFlight = library.some((c) => IN_FLIGHT.includes(c.status ?? 'ready'));
  useEffect(() => {
    if (!anyInFlight) return;
    const t = setInterval(async () => {
      const pending = libraryRef.current.filter((c) => IN_FLIGHT.includes(c.status ?? 'ready'));
      const results = await Promise.allSettled(pending.map((c) => getContentStatus(c._id)));
      let finished = false;
      const byId = new Map<string, { status: IngestStatus; error: string | null; title: string }>();
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          byId.set(pending[i]._id, r.value);
          if (r.value.status === 'ready' || r.value.status === 'failed') finished = true;
        }
      });
      setLibrary((prev) =>
        prev.map((c) => {
          const s = byId.get(c._id);
          return s ? { ...c, status: s.status, error: s.error, title: s.title } : c;
        })
      );
      if (finished) void refresh();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [anyInFlight, refresh]);

  const languages = useMemo(() => Array.from(new Set(library.map((c) => c.language))).sort(), [library]);

  const value = useMemo(
    () => ({ library, due, stats, loading, error, languages, language, setLanguage, refresh }),
    [library, due, stats, loading, error, languages, language, setLanguage, refresh]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
