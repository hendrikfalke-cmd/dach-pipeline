'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  {
    label: 'Pipeline',
    href: '/',
    icon: (active: boolean) => (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke={active ? '#10b981' : '#64748b'} strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    label: 'Update',
    href: '/upload',
    icon: (active: boolean) => (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke={active ? '#10b981' : '#64748b'} strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
      </svg>
    ),
  },
  {
    label: 'Notes',
    href: '/notes',
    icon: (active: boolean) => (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke={active ? '#10b981' : '#64748b'} strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
  {
    label: 'Archive',
    href: '/archive',
    icon: (active: boolean) => (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke={active ? '#10b981' : '#64748b'} strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
      </svg>
    ),
  },
  {
    label: 'More',
    href: '/stats',
    icon: (active: boolean) => (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke={active ? '#10b981' : '#64748b'} strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
      </svg>
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();

  if (pathname === '/login') return null;

  return (
    <>
      {/* Mobile: bottom bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-bg-surface/95 backdrop-blur-md border-t border-border z-50" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="max-w-lg mx-auto flex justify-around items-center h-16">
          {tabs.map((tab) => {
            const isActive = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href);
            return (
              <Link key={tab.href} href={tab.href} className="flex flex-col items-center gap-0.5 py-2 px-1 min-w-0 flex-1">
                {tab.icon(isActive)}
                <span className={`text-[10px] font-medium ${isActive ? 'text-accent' : 'text-text-muted'}`}>{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop: left sidebar */}
      <nav className="hidden lg:flex fixed left-0 top-0 bottom-0 w-[220px] bg-bg-surface border-r border-border z-50 flex-col py-6 px-3">
        {/* Logo/title */}
        <div className="px-3 mb-8">
          <h1 className="text-lg font-bold text-accent">DACH Pipeline</h1>
          <p className="text-[10px] text-text-muted font-mono mt-0.5">Private Credit Tracker</p>
        </div>

        {/* Nav items */}
        <div className="flex-1 space-y-1">
          {tabs.map((tab) => {
            const isActive = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                  isActive
                    ? 'bg-accent/10 text-accent'
                    : 'text-text-muted hover:bg-bg-elevated hover:text-text-primary'
                }`}
              >
                {tab.icon(isActive)}
                <span className={`text-sm font-medium ${isActive ? 'text-accent' : ''}`}>{tab.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Footer links */}
        <div className="space-y-1 pt-4 border-t border-border mt-4">
          <Link href="/digest" className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-text-muted hover:bg-bg-elevated hover:text-text-primary transition-colors ${pathname === '/digest' ? 'bg-accent/10 text-accent' : ''}`}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
            </svg>
            <span className="text-sm font-medium">Weekly Digest</span>
          </Link>
          <Link href="/sponsors" className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-text-muted hover:bg-bg-elevated hover:text-text-primary transition-colors ${pathname === '/sponsors' ? 'bg-accent/10 text-accent' : ''}`}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            <span className="text-sm font-medium">Sponsors</span>
          </Link>
          <Link href="/export" className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-text-muted hover:bg-bg-elevated hover:text-text-primary transition-colors ${pathname === '/export' ? 'bg-accent/10 text-accent' : ''}`}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            <span className="text-sm font-medium">Export</span>
          </Link>
        </div>
      </nav>
    </>
  );
}
