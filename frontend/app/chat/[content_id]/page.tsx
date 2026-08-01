'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { chat, getContent, type ContentItem } from '@/lib/api';

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

export default function ChatPage() {
  const { content_id } = useParams<{ content_id: string }>();
  const [content, setContent] = useState<ContentItem | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!content_id) return;
    getContent(content_id)
      .then(setContent)
      .catch((e: unknown) => {
        const err = e as { response?: { data?: { error?: string } }; message?: string };
        setError(err.response?.data?.error || err.message || 'Could not load content');
      });
  }, [content_id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, sending]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content || !input.trim() || sending) return;
    const userText = input.trim();
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: userText }]);
    setSending(true);
    setError(null);
    try {
      const { answer } = await chat(content._id, userText, content.language);
      setMessages((m) => [...m, { role: 'assistant', text: answer }]);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || err.message || 'Chat failed');
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="mx-auto flex h-[calc(100vh-4rem)] max-w-3xl flex-col px-6 py-6">
      <div>
        <div className="text-xs uppercase tracking-wide text-slate-400">
          Chat · {content?.language ?? '…'}
        </div>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">
          {content?.title ?? 'Loading…'}
        </h1>
      </div>

      <div
        ref={scrollRef}
        className="mt-4 flex-1 space-y-3 overflow-y-auto rounded border border-slate-200 bg-white p-4"
      >
        {messages.length === 0 && (
          <p className="text-sm text-slate-500">
            Ask anything about this content — questions are answered using its text only.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] whitespace-pre-wrap rounded px-3 py-2 text-sm ${
                m.role === 'user'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-900'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {sending && <p className="text-xs text-slate-400">Thinking…</p>}
      </div>

      {error && (
        <p className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <form onSubmit={send} className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question…"
          className="flex-1 rounded border border-slate-300 px-3 py-2"
          disabled={!content || sending}
        />
        <button
          type="submit"
          disabled={!content || sending || !input.trim()}
          className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </main>
  );
}
