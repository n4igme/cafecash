import { Redirect } from 'expo-router'
import { getCurrentUser } from '../lib/pocketbase'

export default function Index() {
  const user = getCurrentUser()
  return <Redirect href={user ? '/active-orders' : '/login'} />
}
