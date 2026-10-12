'use client';

import Link from 'next/link';
import { useAuth } from './AuthProvider';

export default function TopNav() {
  const { user, signOutUser } = useAuth();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
            Contexto
          </Link>
          {user && (
            <nav className="flex gap-4 text-sm text-slate-600">
              <Link href="/dashboard" className="hover:text-slate-900">Dashboard</Link>
              <Link href="/upload" className="hover:text-slate-900">Upload</Link>
            </nav>
          )}
        </div>
        {user && (
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="hidden sm:inline">{user.email}</span>
            <button
              type="button"
              onClick={() => void signOutUser()}
              className="rounded border border-slate-300 px-2 py-1 hover:border-slate-500"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
