import PocketBase from 'pocketbase'
import { cookies } from 'next/headers'

const API_URL = process.env.NEXT_PUBLIC_API_URL!

// ── Client singleton (browser / client components) ──────────────────────────
let _pb: PocketBase | null = null

export function getPB(): PocketBase {
  if (!_pb) {
    if (!API_URL) throw new Error('NEXT_PUBLIC_API_URL is not set')
    _pb = new PocketBase(API_URL)
    _pb.autoCancellation(false)
  }
  return _pb
}

export const pb = new Proxy({} as PocketBase, {
  get(_, prop) { return (getPB() as any)[prop] },
})

// ── Server instance (server components / server actions) ─────────────────────
// In Docker: PB_SERVER_URL=http://pocketbase:8090 (internal network)
// In dev:    falls back to NEXT_PUBLIC_API_URL
export async function getServerPB(): Promise<PocketBase> {
  const serverUrl = process.env.PB_SERVER_URL ?? API_URL
  const client = new PocketBase(serverUrl)
  client.autoCancellation(false)
  const cookieStore = await cookies()
  const token = cookieStore.get('pb_auth')?.value
  if (token) client.authStore.save(token, null)
  return client
}

// ── Token helper for client component hydration ──────────────────────────────
export async function getAuthToken(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get('pb_auth')?.value ?? null
}

// ── JWT decode (no verify — we trust our own PB instance) ────────────────────
export function decodeToken(token: string): Record<string, any> | null {
  try {
    return JSON.parse(atob(token.split('.')[1]))
  } catch {
    return null
  }
}
