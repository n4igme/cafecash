import PocketBase from 'pocketbase'

const API_URL = process.env.EXPO_PUBLIC_API_URL!

// Singleton
let _pb: PocketBase | null = null

export function getPB(): PocketBase {
  if (!_pb) {
    if (!API_URL) throw new Error('EXPO_PUBLIC_API_URL is not set')
    _pb = new PocketBase(API_URL)
    _pb.autoCancellation(false)
  }
  return _pb
}

export const pb = new Proxy({} as PocketBase, {
  get(_, prop) { return (getPB() as any)[prop] },
})

// authReady resolves immediately — maid must be logged in before reaching this screen
export const authReady: Promise<void> = Promise.resolve()

export type UserRole = 'admin' | 'staff' | 'maid'

export interface TabletUser {
  id:    string
  email: string
  name:  string
  role:  UserRole
}

/**
 * Login with email + password.
 * Returns the user if role is 'maid', throws if wrong role.
 */
export async function loginMaid(email: string, password: string): Promise<TabletUser> {
  const client = getPB()
  const auth = await client.collection('users').authWithPassword(email, password)
  const role = (auth.record as any).role as UserRole

  if (role !== 'maid') {
    client.authStore.clear()
    throw new Error('Akun ini tidak bisa digunakan di aplikasi kasir.')
  }

  return {
    id:    auth.record.id,
    email: auth.record.email,
    name:  auth.record.name ?? email,
    role,
  }
}

export function getCurrentUser(): TabletUser | null {
  const client = getPB()
  if (!client.authStore.isValid) return null
  const record = client.authStore.record as any
  if (!record) return null
  return {
    id:    record.id,
    email: record.email,
    name:  record.name ?? record.email,
    role:  record.role,
  }
}

export function logout(): void {
  getPB().authStore.clear()
}
