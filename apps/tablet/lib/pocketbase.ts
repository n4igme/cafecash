import PocketBase from 'pocketbase'

const API_URL      = process.env.EXPO_PUBLIC_API_URL!
const TABLET_EMAIL = process.env.EXPO_PUBLIC_TABLET_EMAIL!
const TABLET_PASS  = process.env.EXPO_PUBLIC_TABLET_PASSWORD!

// Singleton — reuse the same instance across the app
let _pb: PocketBase | null = null

export function getPB(): PocketBase {
  if (!_pb) {
    if (!API_URL) throw new Error('EXPO_PUBLIC_API_URL is not set — copy .env.example to .env')
    _pb = new PocketBase(API_URL)
    _pb.autoCancellation(false)
  }
  return _pb
}

export const pb = new Proxy({} as PocketBase, {
  get(_, prop) {
    return (getPB() as any)[prop]
  },
})

let _authReadyResolve: () => void
export const authReady: Promise<void> = new Promise(resolve => { _authReadyResolve = resolve })

/**
 * Authenticate the tablet service account.
 * Called once on app startup (_layout.tsx).
 * Token is kept in memory — re-authenticates if expired.
 */
export async function initTabletAuth(): Promise<void> {
  const client = getPB()
  // Already authenticated and token still valid
  if (client.authStore.isValid) { _authReadyResolve(); return }

  if (!TABLET_EMAIL || !TABLET_PASS) {
    console.warn('[CafeCash] Tablet credentials not set — running as anonymous')
    _authReadyResolve(); return
  }

  try {
    await client.collection('users').authWithPassword(TABLET_EMAIL, TABLET_PASS)
    console.log('[CafeCash] Tablet auth OK')
  } catch (e) {
    console.error('[CafeCash] Tablet auth failed:', e)
  } finally {
    _authReadyResolve()
  }
}
