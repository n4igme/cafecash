import { cookies } from 'next/headers'
import ReportsClient from './ReportsClient'

export default async function ReportsPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('pb_auth')?.value ?? null
  return <ReportsClient token={token} />
}
