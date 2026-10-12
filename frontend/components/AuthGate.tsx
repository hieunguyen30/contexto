'use client';

import { useAuth } from './AuthProvider';
import { firebaseConfigured } from '@/lib/firebase';

// Renders the app only for signed-in users; everyone else sees the Google sign-in screen.
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, signIn } = useAuth();

  if (!firebaseConfigured) {
    return (
      <main className="mx-auto max-w-md px-6 py-16 text-sm text-red-700">
        Firebase is not configured. Set the NEXT_PUBLIC_FIREBASE_* variables.
      </main>
    );
  }
  if (loading) {
    return <main className="mx-auto max-w-md px-6 py-16 text-sm text-slate-500">Loading…</main>;
  }
  if (!user) {
    return (
      <main className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Contexto</h1>
        <p className="mt-2 text-sm text-slate-600">Learn a language from the things you actually read and watch.</p>
        <button
          type="button"
          onClick={() => void signIn()}
          className="mt-6 rounded bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
        >
          Sign in with Google
        </button>
      </main>
    );
  }
  return <>{children}</>;
}
