import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { loginMaid } from '../lib/pocketbase'

export default function LoginScreen() {
  const router = useRouter()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Email dan password wajib diisi.'); return
    }
    setLoading(true); setError('')
    try {
      await loginMaid(email.trim(), password)
      router.replace('/active-orders')
    } catch (e: any) {
      setError(e?.message ?? 'Login gagal. Periksa email dan password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Logo */}
          <View style={styles.logoWrap}>
            <Text style={styles.logoEmoji}>☕</Text>
            <Text style={styles.appName}>CafeCash</Text>
            <Text style={styles.appSub}>Aplikasi Kasir</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Masuk</Text>

            {/* Email */}
            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="kasir@cafecash.pos"
                placeholderTextColor="#94a3b8"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />
            </View>

            {/* Password */}
            <View style={styles.field}>
              <Text style={styles.label}>Kata Sandi</Text>
              <View style={styles.passWrap}>
                <TextInput
                  style={[styles.input, { flex: 1, borderWidth: 0 }]}
                  placeholder="••••••••"
                  placeholderTextColor="#94a3b8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPass}
                  autoCorrect={false}
                />
                <TouchableOpacity onPress={() => setShowPass(s => !s)} style={styles.eyeBtn}>
                  <Text style={styles.eyeIcon}>{showPass ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Error */}
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Submit */}
            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={loading}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Masuk →</Text>
              }
            </TouchableOpacity>
          </View>

          <Text style={styles.footer}>CafeCash · Kasir</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#f8fafc' },
  kav:     { flex: 1 },
  scroll:  { flexGrow: 1, justifyContent: 'center', padding: 24 },

  logoWrap: { alignItems: 'center', marginBottom: 32 },
  logoEmoji:{ fontSize: 48, marginBottom: 8 },
  appName:  { fontSize: 28, fontWeight: '800', color: '#1e293b' },
  appSub:   { fontSize: 14, color: '#64748b', marginTop: 4 },

  card: {
    backgroundColor: '#fff', borderRadius: 20, padding: 24,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  cardTitle: { fontSize: 20, fontWeight: '700', color: '#1e293b', marginBottom: 20 },

  field:    { marginBottom: 16 },
  label:    { fontSize: 13, fontWeight: '600', color: '#64748b', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#1e293b',
  },
  passWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10,
  },
  eyeBtn:  { paddingHorizontal: 12 },
  eyeIcon: { fontSize: 18 },

  errorBox: {
    backgroundColor: '#fef2f2', borderRadius: 10, borderWidth: 1,
    borderColor: '#fecaca', padding: 12, marginBottom: 16,
  },
  errorText: { color: '#dc2626', fontSize: 13 },

  btn: {
    backgroundColor: '#6366f1', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 4,
  },
  btnDisabled: { opacity: 0.6 },
  btnText:  { color: '#fff', fontSize: 16, fontWeight: '700' },

  footer: { textAlign: 'center', color: '#94a3b8', fontSize: 12, marginTop: 24 },
})
