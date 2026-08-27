import type { Metadata } from 'next'
import './globals.css'
import { cookies } from 'next/headers'
import LogoutButton from './components/LogoutButton'

export const metadata: Metadata = {
  title: 'CafeCash Admin',
  description: 'Admin dashboard for CafeCash POS',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const token = cookieStore.get('pb_auth')?.value
  const email = cookieStore.get('pb_email')?.value

  return (
    <html lang="en">
      <body>
        <div className="flex h-screen bg-slate-50">
          {/* Sidebar — only shown when authenticated */}
          {email && (
            <aside className="w-56 bg-white border-r border-slate-200 flex flex-col">
              <div className="px-6 py-5 border-b border-slate-100">
                <h1 className="text-lg font-bold text-slate-800">☕ CafeCash</h1>
                <p className="text-xs text-slate-400 mt-0.5">Admin Dashboard</p>
              </div>

              <nav className="flex-1 p-4 space-y-1">
                <a href="/"
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors">
                  📊 Dashboard
                </a>
                <a href="/products"
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors">
                  🛍️ Products
                </a>
                <a href="/orders"
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors">
                  📋 Orders
                </a>
                <a href="/reports"
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors">
                  📊 Reports
                </a>
                <a href="/settings"
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors">
                  ⚙️ Settings
                </a>
              </nav>

              {/* User footer */}
              <div className="p-4 border-t border-slate-100">
                <p className="text-xs text-slate-500 truncate mb-2">{email}</p>
                <LogoutButton />
              </div>
            </aside>
          )}

          {/* Main */}
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </body>
    </html>
  )
}
