import { cookies } from 'next/headers'
import OrdersClient from './OrdersClient'

export const dynamic = 'force-dynamic'

export default async function OrdersPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('pb_auth')?.value ?? null
  return <OrdersClient token={token} />
}
