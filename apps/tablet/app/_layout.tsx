// Polyfill EventSource for PocketBase realtime (not available in Hermes)
import EventSource from 'react-native-sse'
if (typeof global.EventSource === 'undefined') {
  // @ts-ignore
  global.EventSource = EventSource
}

import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { initTabletAuth } from '../lib/pocketbase'

export default function RootLayout() {
  useEffect(() => {
    // Authenticate tablet service account on startup
    initTabletAuth()
  }, [])

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  )
}
