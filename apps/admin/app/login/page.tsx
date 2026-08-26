export default function LoginPage({
  searchParams,
}: {
  searchParams?: { error?: string }
}) {
  const error = searchParams?.error

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <div className="text-4xl mb-3">☕</div>
          <h1 className="text-2xl font-bold text-slate-800">CafeCash</h1>
          <p className="text-sm text-slate-400 mt-1">Admin Dashboard</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
          <h2 className="text-lg font-semibold text-slate-700 mb-6">Sign in</h2>

          <form method="POST" action="/api/login" className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-600 mb-1">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="admin@cafecash.pos"
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm
                           focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-600 mb-1">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm
                           focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg px-4 py-3">
                {decodeURIComponent(error)}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold
                         hover:bg-indigo-700 transition-colors mt-2"
            >
              Sign in
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          CafeCash · Self-hosted · Tailscale
        </p>
      </div>
    </div>
  )
}
