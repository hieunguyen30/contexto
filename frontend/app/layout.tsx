import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, Source_Serif_4 } from 'next/font/google';
import AuthProvider from '@/components/AuthProvider';
import AuthGate from '@/components/AuthGate';
import AppShell from '@/components/AppShell';
import './globals.css';

// UI font + a readable serif for target-language sentences. Vietnamese subset included.
const sans = Plus_Jakarta_Sans({ subsets: ['latin', 'latin-ext', 'vietnamese'], variable: '--font-sans', display: 'swap' });
const serif = Source_Serif_4({ subsets: ['latin', 'latin-ext', 'vietnamese'], variable: '--font-serif', display: 'swap' });

export const metadata: Metadata = {
  title: 'Contexto',
  description: 'Language learning in context',
};

// Runs before paint so dark mode never flashes: saved choice first, then the OS preference.
const themeScript = `try{var t=localStorage.getItem('contexto:theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen font-sans">
        <AuthProvider>
          <AuthGate>
            <AppShell>{children}</AppShell>
          </AuthGate>
        </AuthProvider>
      </body>
    </html>
  );
}
