import type { Metadata } from 'next'
import './globals.css'
import { cookies } from 'next/headers'
import { LangProvider } from './components/LangProvider'
import Sidebar from './components/Sidebar'
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
  const role   = (cookieStore.get('pb_role')?.value ?? 'staff') as 'admin' | 'staff' | 'maid'

  let storeName = 'CafeCash'
  let logoEmoji = '☕'
  let logoUrl: string | null = null
  const apiUrl    = process.env.PB_SERVER_URL ?? process.env.NEXT_PUBLIC_API_URL!
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
    { href: '/',           icon: '📊', label: t('nav.dashboard', lang),  roles: ['admin', 'staff'] },
    { href: '/products',   icon: '🛍️', label: t('nav.products', lang),   roles: ['admin', 'staff'] },
    { href: '/orders',     icon: '📋', label: t('nav.orders', lang),      roles: ['admin', 'staff'] },
    { href: '/users',      icon: '👤', label: t('nav.users', lang),       roles: ['admin'] },
    { href: '/settings',   icon: '⚙️', label: t('nav.settings', lang),   roles: ['admin'] },
  ].filter(n => n.roles.includes(role))

  const stockNav = [
    { href: '/ingredients',       icon: '🧪', label: t('nav.ingredients', lang), roles: ['admin', 'staff'] },
    { href: '/recipes',           icon: '📋', label: t('nav.recipes', lang),      roles: ['admin', 'staff'] },
    { href: '/stock-in',          icon: '📦', label: t('nav.stock_in', lang),     roles: ['admin', 'staff'] },
    { href: '/stock-adjustments', icon: '⚡', label: t('nav.adjustments', lang),  roles: ['admin', 'staff'] },
  ].filter(n => n.roles.includes(role))

  return (
    <html lang={lang}>
      <body>
        <LangProvider initialLang={lang}>
          <div className="flex h-screen bg-slate-50">
            {email && (
              <Sidebar
                storeName={storeName}
                logoEmoji={logoEmoji}
                logoUrl={logoUrl}
                email={email}
                role={role}
                nav={nav}
                stockNav={stockNav}
                adminDashboardLabel={t('nav.admin_dashboard', lang)}
                stockLabel={t('nav.stock', lang)}
              />
            )}
            <main className="flex-1 overflow-auto pt-14 lg:pt-0">{children}</main>
          </div>
        </LangProvider>
      </body>
    </html>
  )
}
