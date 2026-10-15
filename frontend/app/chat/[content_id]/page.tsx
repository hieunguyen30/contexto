'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { chat, getContent, type ContentItem } from '@/lib/api';
import { BackLink, ErrorNote, errorMessage } from '@/components/ui';

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
      .catch((e) => setError(errorMessage(e, 'Could not load content')));
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
    } catch (e) {
      setError(errorMessage(e, 'Chat failed'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-[calc(100dvh-10rem)] flex-col lg:h-[calc(100dvh-3rem)]">
      <BackLink href={content ? `/content/${content._id}` : '/dashboard'}>Back</BackLink>
      <div className="mb-4">
        <div className="text-xs font-bold uppercase tracking-widest text-primary">Chat · {content?.language ?? '…'}</div>
        <h1 className="mt-1 line-clamp-2 text-xl font-extrabold leading-snug tracking-tight">{content?.title ?? 'Loading…'}</h1>
      </div>

      <div ref={scrollRef} className="card flex-1 space-y-4 overflow-y-auto p-5" aria-live="polite">
        {messages.length === 0 && (
          <div className="grid h-full place-items-center text-center">
            <div className="max-w-xs">
              <div className="text-3xl">💬</div>
              <p className="mt-2 text-sm text-muted">
                Ask anything about this text. Answers come from the content itself, in {content?.language ?? 'your language'}.
              </p>
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex animate-pop-in ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 leading-relaxed ${
                m.role === 'user'
                  ? 'rounded-br-md bg-primary text-sm text-primary-ink'
                  : 'rounded-bl-md bg-raised font-serif text-base'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start" role="status" aria-label="Thinking">
            <div className="flex gap-1.5 rounded-2xl rounded-bl-md bg-raised px-4 py-3.5">
              {[0, 1, 2].map((d) => (
                <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${d * 120}ms` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {error && <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>}

      <form onSubmit={send} className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question…"
          className="input flex-1"
          disabled={!content || sending}
          aria-label="Your question"
        />
        <button type="submit" disabled={!content || sending || !input.trim()} className="btn btn-primary">
          Send
        </button>
      </form>
    </div>
  );
}
