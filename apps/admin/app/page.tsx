import { cookies } from 'next/headers'
import DashboardClient from './DashboardClient'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('pb_auth')?.value ?? null
  const role  = (cookieStore.get('pb_role')?.value ?? 'staff') as 'admin' | 'staff' | 'maid'
  return <DashboardClient token={token} role={role} />
}
