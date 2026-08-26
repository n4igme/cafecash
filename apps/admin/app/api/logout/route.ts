import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  const origin = req.headers.get('x-forwarded-host')
    ? `${req.headers.get('x-forwarded-proto') ?? 'http'}://${req.headers.get('x-forwarded-host')}`
    : req.nextUrl.origin
  const cookieStore = await cookies()
  cookieStore.delete('pb_auth')
  return NextResponse.redirect(`${origin}/login`, { status: 303 })
}
