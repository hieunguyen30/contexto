import type { Metadata } from 'next';
import AuthProvider from '@/components/AuthProvider';
import AuthGate from '@/components/AuthGate';
import TopNav from '@/components/TopNav';
import './globals.css';

export const metadata: Metadata = {
  title: 'Contexto',
  description: 'Language learning in context',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <AuthProvider>
          <TopNav />
          <AuthGate>{children}</AuthGate>
        </AuthProvider>
      </body>
    </html>
  );
}
