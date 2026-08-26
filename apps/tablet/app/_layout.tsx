// Polyfill EventSource for PocketBase realtime (not available in Hermes)
import EventSource from 'react-native-sse'
if (typeof global.EventSource === 'undefined') {
  // @ts-ignore
  global.EventSource = EventSource
}

import { Stack } from 'expo-router'
import { SafeAreaProvider } from 'react-native-safe-area-context'

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  )
}
