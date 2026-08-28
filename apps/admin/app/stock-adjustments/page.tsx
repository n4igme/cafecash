import { cookies } from 'next/headers'
import StockAdjustmentsClient from './StockAdjustmentsClient'
export default async function StockAdjustmentsPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('pb_auth')?.value ?? null
  return <StockAdjustmentsClient token={token} />
}
