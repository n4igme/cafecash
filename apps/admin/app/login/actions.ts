'use server'
import { cookies } from 'next/headers'
import PocketBase from 'pocketbase'

const API_URL = process.env.NEXT_PUBLIC_API_URL!

export async function login(
  _prev: { error: string } | { success: true } | null,
  formData: FormData
): Promise<{ error: string } | { success: true }> {
  const email    = (formData.get('email')    as string)?.trim()
  const password = (formData.get('password') as string)

  if (!email || !password) {
    return { error: 'Email and password are required.' }
  }

  const pb = new PocketBase(API_URL)
  try {
    const auth = await pb.collection('users').authWithPassword(email, password)
    const cookieStore = await cookies()
    cookieStore.set('pb_auth', auth.token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path:     '/',
      maxAge:   60 * 60 * 24 * 7,
    })
    return { success: true }
  } catch {
    return { error: 'Invalid email or password.' }
  }
}

export async function logout() {
  const cookieStore = await cookies()
  cookieStore.delete('pb_auth')
}
