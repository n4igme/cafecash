import PocketBase from 'pocketbase'

const API_URL = process.env.EXPO_PUBLIC_API_URL!

// Singleton — reuse the same instance across the app
let _pb: PocketBase | null = null

export function getPB(): PocketBase {
  if (!_pb) {
    if (!API_URL) throw new Error('EXPO_PUBLIC_API_URL is not set — copy .env.example to .env')
    _pb = new PocketBase(API_URL)
    // Tablet always uses anonymous access (no auth)
    _pb.autoCancellation(false)
  }
  return _pb
}

export const pb = new Proxy({} as PocketBase, {
  get(_, prop) {
    return (getPB() as any)[prop]
  },
})
