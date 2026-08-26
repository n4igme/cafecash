'use client'
import { useRouter } from 'next/navigation'
import { logout } from '../login/actions'

export default function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    await logout()
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      className="w-full py-1.5 text-xs font-medium text-slate-500 border border-slate-200
                 rounded-lg hover:bg-slate-50 hover:text-red-500 transition-colors"
    >
      Sign out
    </button>
  )
}
