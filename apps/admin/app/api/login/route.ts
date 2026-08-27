import { NextRequest, NextResponse } from 'next/server'
import PocketBase from 'pocketbase'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const email    = (form.get('email')    as string)?.trim()
  const password = (form.get('password') as string)

  // Use the Host header so redirects work regardless of how the app is accessed
  // (localhost, Tailscale IP, or a domain name)
  const host  = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost:3001'
  const proto = req.headers.get('x-forwarded-proto') ?? 'http'
  const origin = `${proto}://${host}`

  if (!email || !password) {
    return NextResponse.redirect(`${origin}/login?error=Email+and+password+are+required`, { status: 303 })
  }

  const pb = new PocketBase(process.env.PB_SERVER_URL ?? process.env.NEXT_PUBLIC_API_URL!)
  try {
    const auth = await pb.collection('users').authWithPassword(email, password)
    const cookieStore = await cookies()
    cookieStore.set('pb_auth', auth.token, {
      httpOnly: true,
      secure:   false,
      sameSite: 'lax',
      path:     '/',
      maxAge:   60 * 60 * 24 * 7,
    })
    // Store email separately so layout can display it without JWT decode
    cookieStore.set('pb_email', auth.record.email ?? '', {
      httpOnly: false,
      secure:   false,
      sameSite: 'lax',
      path:     '/',
      maxAge:   60 * 60 * 24 * 7,
    })
    return NextResponse.redirect(`${origin}/`, { status: 303 })
  } catch {
    return NextResponse.redirect(`${origin}/login?error=Invalid+email+or+password`, { status: 303 })
  }
}
