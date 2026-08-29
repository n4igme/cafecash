// Polyfill EventSource for PocketBase realtime
import EventSource from 'react-native-sse'
if (typeof global.EventSource === 'undefined') {
  // @ts-ignore
  global.EventSource = EventSource
}

import { useEffect, useState } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { getCurrentUser } from '../lib/pocketbase'

export default function RootLayout() {
  const router   = useRouter()
  const segments = useSegments()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const user = getCurrentUser()
    const inAuth = segments[0] === 'login'

    if (!user && !inAuth) {
      router.replace('/login')
    } else if (user && inAuth) {
      router.replace('/active-orders')
    }
    setReady(true)
  }, [])

  if (!ready) return null

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  )
}
