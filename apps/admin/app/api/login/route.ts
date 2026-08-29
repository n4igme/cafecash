import { NextRequest, NextResponse } from 'next/server'
import PocketBase from 'pocketbase'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const email    = (form.get('email')    as string)?.trim()
  const password = (form.get('password') as string)

  const host   = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost:3001'
  const proto  = req.headers.get('x-forwarded-proto') ?? 'http'
  const origin = `${proto}://${host}`

  if (!email || !password) {
    return NextResponse.redirect(`${origin}/login?error=Email+and+password+are+required`, { status: 303 })
  }

  const pb = new PocketBase(process.env.PB_SERVER_URL ?? process.env.NEXT_PUBLIC_API_URL!)
  try {
    const auth = await pb.collection('users').authWithPassword(email, password)
    const role = (auth.record as any).role as string

    // Block maid role from dashboard — POS only
    if (role === 'maid') {
      return NextResponse.redirect(`${origin}/login?error=Akun+kasir+tidak+bisa+login+ke+dashboard`, { status: 303 })
    }

    const cookieStore = await cookies()
    cookieStore.set('pb_auth', auth.token, {
      httpOnly: true, secure: false, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7,
    })
    cookieStore.set('pb_email', auth.record.email ?? '', {
      httpOnly: false, secure: false, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7,
    })
    // Store role for sidebar/middleware use
    cookieStore.set('pb_role', role ?? 'staff', {
      httpOnly: false, secure: false, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7,
    })
    return NextResponse.redirect(`${origin}/`, { status: 303 })
  } catch {
    return NextResponse.redirect(`${origin}/login?error=Invalid+email+or+password`, { status: 303 })
  }
}
