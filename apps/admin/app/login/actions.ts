'use server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import PocketBase from 'pocketbase'

export async function login(formData: FormData) {
  const email    = (formData.get('email')    as string)?.trim()
  const password = (formData.get('password') as string)

  if (!email || !password) {
    redirect('/login?error=Email+and+password+are+required')
  }

  const pb = new PocketBase(process.env.PB_SERVER_URL ?? process.env.NEXT_PUBLIC_API_URL!)
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
  } catch {
    redirect('/login?error=Invalid+email+or+password')
  }

  redirect('/')
}

export async function logout() {
  const cookieStore = await cookies()
  cookieStore.delete('pb_auth')
  redirect('/login')
}
