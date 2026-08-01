'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getUserId, setUserId } from '@/lib/userId';

export default function TopNav() {
  const [uid, setUid] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setUid(getUserId() || '');
  }, []);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setUserId(uid.trim());
    setEditing(false);
  };

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
            Contexto
          </Link>
          <nav className="flex gap-4 text-sm text-slate-600">
            <Link href="/dashboard" className="hover:text-slate-900">Dashboard</Link>
            <Link href="/upload" className="hover:text-slate-900">Upload</Link>
          </nav>
        </div>
        <div className="text-xs text-slate-500">
          {editing ? (
            <form onSubmit={save} className="flex items-center gap-2">
              <input
                value={uid}
                onChange={(e) => setUid(e.target.value)}
                placeholder="paste user ObjectId"
                className="w-64 rounded border border-slate-300 px-2 py-1 font-mono text-xs"
              />
              <button type="submit" className="rounded bg-slate-900 px-2 py-1 text-white">
                Save
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="font-mono hover:text-slate-900"
            >
              {uid ? `user: ${uid.slice(0, 8)}…` : 'set user_id'}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
