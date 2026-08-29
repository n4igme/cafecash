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

  let storeName = 'CafeCash'
  let logoEmoji = '☕'
  let logoUrl: string | null = null
  const apiUrl   = process.env.PB_SERVER_URL ?? process.env.NEXT_PUBLIC_API_URL!
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
    { href: '/',           icon: '📊', label: t('nav.dashboard', lang) },
    { href: '/products',   icon: '🛍️', label: t('nav.products', lang) },
    { href: '/orders',     icon: '📋', label: t('nav.orders', lang) },
    { href: '/users',      icon: '👤', label: t('nav.users', lang) },
    { href: '/settings',   icon: '⚙️', label: t('nav.settings', lang) },
  ]

  const stockNav = [
    { href: '/ingredients',       icon: '🧪', label: t('nav.ingredients', lang) },
    { href: '/recipes',           icon: '📋', label: t('nav.recipes', lang) },
    { href: '/stock-in',          icon: '📦', label: t('nav.stock_in', lang) },
    { href: '/stock-adjustments', icon: '⚡', label: t('nav.adjustments', lang) },
  ]

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
                nav={nav}
                stockNav={stockNav}
                adminDashboardLabel={t('nav.admin_dashboard', lang)}
                stockLabel={t('nav.stock', lang)}
              />
            )}
            {/* pt-14 on mobile to account for fixed top bar */}
            <main className="flex-1 overflow-auto pt-14 lg:pt-0">{children}</main>
          </div>
        </LangProvider>
      </body>
    </html>
  )
}
