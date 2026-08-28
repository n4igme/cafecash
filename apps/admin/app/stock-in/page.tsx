import { cookies } from 'next/headers'
import StockInClient from './StockInClient'
export default async function StockInPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('pb_auth')?.value ?? null
  return <StockInClient token={token} />
}
