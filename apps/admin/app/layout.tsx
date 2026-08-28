import type { Metadata } from 'next'
import './globals.css'
import { cookies } from 'next/headers'
import LogoutButton from './components/LogoutButton'
import PocketBase from 'pocketbase'

export const metadata: Metadata = {
  title: 'CafeCash Admin',
  description: 'Admin dashboard for CafeCash POS',
}

interface StoreSettings { store_name: string; logo_emoji: string; logo: string; id: string }

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const token = cookieStore.get('pb_auth')?.value
  const email = cookieStore.get('pb_email')?.value

  let storeName  = 'CafeCash'
  let logoEmoji  = '☕'
  let logoUrl: string | null = null
  const apiUrl = process.env.PB_SERVER_URL ?? process.env.NEXT_PUBLIC_API_URL!

  if (token) {
    try {
      const pb = new PocketBase(apiUrl)
      pb.autoCancellation(false)
      pb.authStore.save(token, null)
      const s = await pb.collection('settings').getFirstListItem<StoreSettings>('')
      if (s.store_name) storeName = s.store_name
      if (s.logo_emoji) logoEmoji = s.logo_emoji
      if (s.logo) {
        // Use public URL (NEXT_PUBLIC_API_URL) so browser can load the image
        const publicApi = process.env.NEXT_PUBLIC_API_URL!
        logoUrl = `${publicApi}/api/files/settings/${s.id}/${s.logo}`
      }
    } catch {}
  }

  return (
    <html lang="en">
      <body>
        <div className="flex h-screen bg-slate-50">
          {email && (
            <aside className="w-56 bg-white border-r border-slate-200 flex flex-col">
              <div className="px-6 py-5 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt={storeName}
                      className="w-7 h-7 object-contain rounded" />
                  ) : (
                    <span className="text-xl">{logoEmoji}</span>
                  )}
                  <h1 className="text-base font-bold text-slate-800 truncate">{storeName}</h1>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 ml-9">Admin Dashboard</p>
              </div>

              <nav className="flex-1 p-4 space-y-1">
                <a href="/" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors">
                  📊 Dashboard
                </a>
                <a href="/products" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors">
                  🛍️ Products
                </a>
                <a href="/orders" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors">
                  📋 Orders
                </a>
                <a href="/users" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors">
                  👤 Users
                </a>
                <a href="/settings" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors">
                  ⚙️ Settings
                </a>
                <div className="pt-2 border-t border-slate-100 mt-1">
                  <p className="px-3 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">Stock</p>
                  <a href="/ingredients" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors">
                    🧪 Ingredients
                  </a>
                  <a href="/recipes" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors">
                    📋 Recipes
                  </a>
                  <a href="/stock-in" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors">
                    📦 Stock In
                  </a>
                  <a href="/stock-adjustments" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors">
                    ⚡ Adjustments
                  </a>
                </div>
              </nav>

              <div className="p-4 border-t border-slate-100">
                <p className="text-xs text-slate-500 truncate mb-2">{email}</p>
                <LogoutButton />
              </div>
            </aside>
          )}
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </body>
    </html>
  )
}
