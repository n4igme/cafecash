'use client'

export default function LogoutButton() {
  return (
    <form method="POST" action="/api/logout">
      <button
        type="submit"
        className="w-full py-1.5 text-xs font-medium text-slate-500 border border-slate-200
                   rounded-lg hover:bg-slate-50 hover:text-red-500 transition-colors"
      >
        Sign out
      </button>
    </form>
  )
}
