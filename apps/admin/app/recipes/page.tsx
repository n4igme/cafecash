import { cookies } from 'next/headers'
import RecipesClient from './RecipesClient'
export default async function RecipesPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('pb_auth')?.value ?? null
  return <RecipesClient token={token} />
}
