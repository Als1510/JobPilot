import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'JobPilot — Career Intelligence',
  description: 'Decide which opportunities deserve your time.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#view">
          Skip to content
        </a>
        <header className="topbar">
          <div className="topbar-inner">
            <Link href="/" className="brand">
              <span className="brand-mark" aria-hidden="true">
                jp
              </span>
              <span className="brand-name">JobPilot</span>
              <span className="brand-tag">career intelligence</span>
            </Link>
            <nav className="nav" aria-label="Primary">
              <Link href="/">Overview</Link>
              <Link href="/discover">Discover</Link>
              <Link href="/profile">Profile</Link>
            </nav>
          </div>
        </header>
        <main id="view" className="view">
          {children}
        </main>
        <footer className="foot">
          <p>JobPilot M1 — deterministic, explainable job intelligence. Scores never guess; they show their work.</p>
        </footer>
      </body>
    </html>
  );
}