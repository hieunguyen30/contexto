'use client';

import { useAuth } from './AuthProvider';
import { firebaseConfigured } from '@/lib/firebase';
import ThemeToggle from './ThemeToggle';

function Center({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-4">
      <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-accent/15 blur-3xl" />
      <div className="absolute right-4 top-4"><ThemeToggle /></div>
      <div className="relative w-full max-w-sm">{children}</div>
    </main>
  );
}

// Renders the app only for signed-in users; everyone else sees the Google sign-in screen.
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, signIn } = useAuth();

  if (!firebaseConfigured) {
    return (
      <Center>
        <div className="card p-6 text-sm text-danger">Firebase is not configured. Set the NEXT_PUBLIC_FIREBASE_* variables.</div>
      </Center>
    );
  }
  if (loading) {
    return (
      <Center>
        <div className="card space-y-3 p-8">
          <div className="skeleton h-6 w-1/2" />
          <div className="skeleton h-4 w-3/4" />
        </div>
      </Center>
    );
  }
  if (!user) {
    return (
      <Center>
        <div className="card animate-pop-in p-8 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent text-2xl font-black text-white shadow-lift">
            C
          </span>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight">Contexto</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Learn a language from the articles and videos you already love. Paste a link, get your vocabulary, quiz and chat.
          </p>
          <button type="button" onClick={() => void signIn()} className="btn btn-primary mt-6 w-full">
            Continue with Google
          </button>
        </div>
      </Center>
    );
  }
  return <>{children}</>;
}
