import { cookies } from 'next/headers'
import IngredientsClient from './IngredientsClient'
export default async function IngredientsPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('pb_auth')?.value ?? null
  return <IngredientsClient token={token} />
}
