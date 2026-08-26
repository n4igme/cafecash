import { cookies } from 'next/headers'
import ProductsClient from './ProductsClient'

// Server component — reads the auth token and passes it down to the client
export default async function ProductsPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('pb_auth')?.value ?? null
  return <ProductsClient token={token} />
}
