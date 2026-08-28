import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useCart } from '../store/cart'

export default function NewOrderScreen() {
  const router = useRouter()
  const { setCustomerName, setOrderId } = useCart()
  const [name, setName] = useState('')

  const proceed = () => {
    if (!name.trim()) return
    setCustomerName(name.trim())
    setOrderId(null)
    router.push('/pos')
  }

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.card}>
          <Text style={styles.title}>New Order</Text>
          <Text style={styles.subtitle}>Enter customer name or table number</Text>

          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Meja 3 / Bibib / Takeaway"
            placeholderTextColor="#94a3b8"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={proceed}
          />

          <TouchableOpacity
            style={[styles.btn, !name.trim() && styles.btnDisabled]}
            onPress={proceed}
            disabled={!name.trim()}
          >
            <Text style={styles.btnText}>Start Order →</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  inner: { flex: 1, justifyContent: 'center', padding: 32 },
  backBtn: { position: 'absolute', top: 20, left: 24 },
  backText: { color: '#6366f1', fontSize: 15, fontWeight: '600' },
  card: {
    backgroundColor: '#fff', borderRadius: 20, padding: 28,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  title: { fontSize: 24, fontWeight: '800', color: '#1e293b', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#64748b', marginBottom: 24 },
  input: {
    borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 16,
    color: '#1e293b', marginBottom: 20,
  },
  btn: { backgroundColor: '#6366f1', paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  btnDisabled: { backgroundColor: '#c7d2fe' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
})
