'use client';

import Link from 'next/link';
import type { ContentItem, IngestStatus } from '@/lib/api';
import { IN_FLIGHT } from './AppData';
import { Tag } from './ui';
import { ChatIcon, LinkIcon } from './icons';

const STATUS_LABEL: Record<IngestStatus, string> = {
  queued: 'Waiting in line…',
  processing: 'Reading, chunking and embedding…',
  ready: 'Ready',
  failed: 'Failed',
};

function host(url?: string): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

// A feed "post": counters on the left (words + due, where a forum would show votes), tags, title, actions.
export default function PostCard({ item, index }: { item: ContentItem; index: number }) {
  const status: IngestStatus = item.status ?? 'ready';
  const ready = status === 'ready';
  const inFlight = IN_FLIGHT.includes(status);
  const source = host(item.source_url);

  return (
    <article
      className={`card ${ready ? 'card-hover' : ''} animate-pop-in flex gap-4 p-5`}
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <div className="flex w-14 shrink-0 flex-col self-start items-center gap-1 rounded-xl bg-raised py-2.5 text-center" aria-label="Counters">
        <span className="text-xl font-extrabold leading-none">{ready ? item.vocab_count ?? 0 : '–'}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted">words</span>
        {ready && (item.due_count ?? 0) > 0 && (
          <span className="mt-1 rounded-full bg-flame/15 px-1.5 py-0.5 text-[10px] font-bold text-flame-ink">{item.due_count} due</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Tag tone="primary">{item.source_type === 'youtube' ? 'Video' : 'Article'}</Tag>
          <Tag>{item.language}</Tag>
          {inFlight && <Tag tone="flame">Processing</Tag>}
          {status === 'failed' && <Tag tone="danger">Failed</Tag>}
          <span className="text-xs text-muted">· {timeAgo(item.created_at)}</span>
        </div>

        <h2 className="mt-2 line-clamp-2 text-lg font-bold leading-snug tracking-tight">
          {ready ? (
            <Link href={`/content/${item._id}`} className="transition hover:text-primary">
              {item.title}
            </Link>
          ) : (
            item.title
          )}
        </h2>

        {source && (
          <div className="mt-1 inline-flex items-center gap-1 text-xs text-muted">
            <LinkIcon width={13} height={13} /> {source}
          </div>
        )}

        {inFlight && (
          <div className="mt-3" role="status">
            <div className="mb-1.5 text-xs font-semibold text-flame-ink">{STATUS_LABEL[status]}</div>
            <div className="h-1.5 overflow-hidden rounded-full bg-raised">
              <div className={`skeleton h-full ${status === 'queued' ? 'w-1/4' : 'w-2/3'} !rounded-full !bg-flame/70`} />
            </div>
          </div>
        )}
        {status === 'failed' && <p className="mt-2 text-sm text-danger">{item.error || 'Something went wrong while processing this link.'}</p>}

        {ready && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link href={`/content/${item._id}`} className="btn btn-soft !px-3 !py-1.5">
              Open
            </Link>
            <Link href={`/chat/${item._id}`} className="btn btn-ghost !px-3 !py-1.5">
              <ChatIcon width={16} height={16} /> Chat
            </Link>
          </div>
        )}
      </div>
    </article>
  );
}
