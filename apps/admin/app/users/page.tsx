import { cookies } from 'next/headers'
import UsersClient from './UsersClient'

export default async function UsersPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('pb_auth')?.value ?? null
  return <UsersClient token={token} />
}
