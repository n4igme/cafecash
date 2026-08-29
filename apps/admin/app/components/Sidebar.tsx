'use client'
import { useState } from 'react'
import LogoutButton from './LogoutButton'
import { LangToggle } from './LangProvider'

interface NavItem { href: string; icon: string; label: string }

interface SidebarProps {
  storeName: string
  logoEmoji: string
  logoUrl:   string | null
  email:     string
  role:      string
  nav:       NavItem[]
  stockNav:  NavItem[]
  adminDashboardLabel: string
  stockLabel: string
}

const ROLE_BADGE: Record<string, { label: string; color: string }> = {
  admin: { label: 'Admin',  color: 'bg-indigo-100 text-indigo-700' },
  staff: { label: 'Staff',  color: 'bg-green-100 text-green-700' },
  maid:  { label: 'Kasir',  color: 'bg-amber-100 text-amber-700' },
}

export default function Sidebar({
  storeName, logoEmoji, logoUrl, email, role,
  nav, stockNav, adminDashboardLabel, stockLabel,
}: SidebarProps) {
  const [open, setOpen] = useState(false)
  const badge = ROLE_BADGE[role] ?? ROLE_BADGE['staff']

  const SidebarContent = () => (
    <>
      {/* Logo + store name */}
      <div className="px-6 py-5 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={storeName} className="w-7 h-7 object-contain rounded" />
          ) : (
            <span className="text-xl">{logoEmoji}</span>
          )}
          <h1 className="text-base font-bold text-slate-800 truncate">{storeName}</h1>
        </div>
        <p className="text-xs text-slate-400 mt-0.5 ml-9">{adminDashboardLabel}</p>
      </div>

      {/* Nav links */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {nav.map(n => (
          <a key={n.href} href={n.href} onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors">
            {n.icon} {n.label}
          </a>
        ))}
        {stockNav.length > 0 && (
          <div className="pt-2 border-t border-slate-100 mt-1">
            <p className="px-3 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {stockLabel}
            </p>
            {stockNav.map(n => (
              <a key={n.href} href={n.href} onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors">
                {n.icon} {n.label}
              </a>
            ))}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-100 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-slate-500 truncate">{email}</p>
            <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
              {badge.label}
            </span>
          </div>
          <LangToggle />
        </div>
        <LogoutButton />
      </div>
    </>
  )

  return (
    <>
      {/* ── Mobile top bar ── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b border-slate-200 flex items-center px-4 h-14">
        <button onClick={() => setOpen(o => !o)}
          className="p-2 rounded-lg hover:bg-slate-100 transition-colors mr-3">
          <div className="w-5 h-0.5 bg-slate-600 mb-1"></div>
          <div className="w-5 h-0.5 bg-slate-600 mb-1"></div>
          <div className="w-5 h-0.5 bg-slate-600"></div>
        </button>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={storeName} className="w-6 h-6 object-contain rounded mr-2" />
        ) : (
          <span className="text-lg mr-2">{logoEmoji}</span>
        )}
        <span className="font-bold text-slate-800 text-sm">{storeName}</span>
      </div>

      {/* ── Mobile overlay ── */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="relative z-50 w-64 bg-white flex flex-col h-full shadow-xl">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:flex w-56 bg-white border-r border-slate-200 flex-col">
        <SidebarContent />
      </aside>
    </>
  )
}
