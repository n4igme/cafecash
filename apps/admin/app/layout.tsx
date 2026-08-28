import type { Metadata } from 'next'
import './globals.css'
import { cookies } from 'next/headers'
import LogoutButton from './components/LogoutButton'
import { LangProvider, LangToggle } from './components/LangProvider'
import { t } from '../lib/i18n'
import type { Lang } from '../lib/i18n'
import PocketBase from 'pocketbase'

export const metadata: Metadata = {
  title: 'CafeCash Admin',
  description: 'Admin dashboard for CafeCash POS',
}

interface StoreSettings { store_name: string; logo_emoji: string; logo: string; id: string }

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const token  = cookieStore.get('pb_auth')?.value
  const email  = cookieStore.get('pb_email')?.value
  const lang   = (cookieStore.get('lang')?.value ?? 'id') as Lang

  let storeName = 'CafeCash'
  let logoEmoji = '☕'
  let logoUrl: string | null = null
  const apiUrl = process.env.PB_SERVER_URL ?? process.env.NEXT_PUBLIC_API_URL!
  const publicApi = process.env.NEXT_PUBLIC_API_URL!

  if (token) {
    try {
      const pb = new PocketBase(apiUrl)
      pb.autoCancellation(false)
      pb.authStore.save(token, null)
      const s = await pb.collection('settings').getFirstListItem<StoreSettings>('')
      if (s.store_name) storeName = s.store_name
      if (s.logo_emoji) logoEmoji = s.logo_emoji
      if (s.logo) logoUrl = `${publicApi}/api/files/settings/${s.id}/${s.logo}`
    } catch {}
  }

  const nav = [
    { href: '/',            icon: '📊', label: t('nav.dashboard', lang) },
    { href: '/products',    icon: '🛍️', label: t('nav.products', lang) },
    { href: '/orders',      icon: '📋', label: t('nav.orders', lang) },
    { href: '/users',       icon: '👤', label: t('nav.users', lang) },
    { href: '/settings',    icon: '⚙️', label: t('nav.settings', lang) },
  ]

  const stockNav = [
    { href: '/ingredients',        icon: '🧪', label: t('nav.ingredients', lang) },
    { href: '/recipes',            icon: '📋', label: t('nav.recipes', lang) },
    { href: '/stock-in',           icon: '📦', label: t('nav.stock_in', lang) },
    { href: '/stock-adjustments',  icon: '⚡', label: t('nav.adjustments', lang) },
  ]

  return (
    <html lang={lang}>
      <body>
        <LangProvider initialLang={lang}>
          <div className="flex h-screen bg-slate-50">
            {email && (
              <aside className="w-56 bg-white border-r border-slate-200 flex flex-col">
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
                  <p className="text-xs text-slate-400 mt-0.5 ml-9">{t('nav.admin_dashboard', lang)}</p>
                </div>

                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                  {nav.map(n => (
                    <a key={n.href} href={n.href}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors">
                      {n.icon} {n.label}
                    </a>
                  ))}

                  <div className="pt-2 border-t border-slate-100 mt-1">
                    <p className="px-3 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      {t('nav.stock', lang)}
                    </p>
                    {stockNav.map(n => (
                      <a key={n.href} href={n.href}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors">
                        {n.icon} {n.label}
                      </a>
                    ))}
                  </div>
                </nav>

                <div className="p-4 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500 truncate">{email}</p>
                    <LangToggle />
                  </div>
                  <LogoutButton />
                </div>
              </aside>
            )}
            <main className="flex-1 overflow-auto">{children}</main>
          </div>
        </LangProvider>
      </body>
    </html>
  )
}
