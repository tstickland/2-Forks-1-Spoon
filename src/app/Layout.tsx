import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/', label: 'Plan', icon: 'M4 5h16v15H4zM4 9h16M9 3v4M15 3v4' },
  { to: '/batches', label: 'Batches', icon: 'M5 10h14l-1.5 9h-11zM3 10h18M9 6h6' },
  { to: '/groceries', label: 'Groceries', icon: 'M3 4h2l2.5 11h11L21 7H6.2M9 20h.01M18 20h.01' },
  { to: '/recipes', label: 'Recipes', icon: 'M6 3h10l3 3v15H6zM9 9h7M9 13h7M9 17h4' },
  { to: '/settings', label: 'Settings', icon: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 12h2M18 12h2M12 4v2M12 18v2' },
]

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <main className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-6">
        {children}
      </main>
      <nav className="border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <ul className="mx-auto flex max-w-3xl">
          {TABS.map((tab) => (
            <li key={tab.to} className="flex-1">
              <NavLink
                to={tab.to}
                end={tab.to === '/'}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 py-2 text-xs ${isActive ? 'text-brand-700' : 'text-stone-500'}`
                }
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8}>
                  <path d={tab.icon} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {tab.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
