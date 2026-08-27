import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  const host  = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost:3001'
  const proto = req.headers.get('x-forwarded-proto') ?? 'http'
  const origin = `${proto}://${host}`
  const cookieStore = await cookies()
  cookieStore.delete('pb_auth')
  cookieStore.delete('pb_email')
  return NextResponse.redirect(`${origin}/login`, { status: 303 })
}
