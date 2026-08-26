import React, { useState, useEffect } from 'react'
import {
  View, Text, Image, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { pb } from '../lib/pocketbase'
import { useCart } from '../store/cart'
import { formatRupiah } from '../lib/format'

const API_URL = process.env.EXPO_PUBLIC_API_URL!

export default function CheckoutScreen() {
  const router = useRouter()
  const { items, total, clear } = useCart()
  const [saving,   setSaving]   = useState(false)
  const [paid,     setPaid]     = useState(false)
  const [qrisUrl,  setQrisUrl]  = useState<string | null>(null)
  const [loadingQris, setLoadingQris] = useState(true)

  // Fetch QRIS URL from settings collection
  useEffect(() => {
    pb.collection('settings')
      .getFirstListItem<{ id: string; qris_image: string }>('')
      .then(record => {
        if (record.qris_image) {
          // PocketBase file URL format
          setQrisUrl(`${API_URL}/api/files/settings/${record.id}/${record.qris_image}`)
        }
      })
      .catch(() => {
        // Fall back to bundled asset if settings not configured yet
      })
      .finally(() => setLoadingQris(false))
  }, [])

  const handleConfirmPayment = async () => {
    setSaving(true)
    try {
      const order = await pb.collection('orders').create({
        total:  total(),
        status: 'paid',
      })

      await Promise.all(
        items.map(i =>
          pb.collection('order_items').create({
            order:        order.id,
            product:      i.product.id,
            product_name: i.product.name,
            price:        i.product.price,
            quantity:     i.quantity,
          })
        )
      )

      setPaid(true)
      clear()
      setTimeout(() => router.replace('/pos'), 3000)
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to save order')
    } finally {
      setSaving(false)
    }
  }

  if (paid) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.successContainer}>
          <Text style={styles.successIcon}>✅</Text>
          <Text style={styles.successTitle}>Payment Confirmed!</Text>
          <Text style={styles.successSub}>Returning to POS...</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.root}>
      {/* Left: Order Summary */}
      <View style={styles.left}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Order Summary</Text>

        <ScrollView style={styles.itemList}>
          {items.map(item => (
            <View key={item.product.id} style={styles.summaryItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.product.name}</Text>
                <Text style={styles.itemQty}>x{item.quantity}</Text>
              </View>
              <Text style={styles.itemTotal}>
                {formatRupiah(item.product.price * item.quantity)}
              </Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.divider} />
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalAmount}>{formatRupiah(total())}</Text>
        </View>
      </View>

      {/* Right: QRIS */}
      <View style={styles.right}>
        <Text style={styles.qrisTitle}>Scan to Pay</Text>
        <Text style={styles.qrisSubtitle}>QRIS · All e-wallets & mobile banking</Text>

        <View style={styles.qrContainer}>
          {loadingQris ? (
            <ActivityIndicator color="#6366f1" />
          ) : qrisUrl ? (
            <Image source={{ uri: qrisUrl }} style={styles.qrImage} resizeMode="contain" />
          ) : (
            // Fallback: bundled asset
            <Image source={require('../assets/qris.png')} style={styles.qrImage} resizeMode="contain" />
          )}
        </View>

        <View style={styles.amountBadge}>
          <Text style={styles.amountLabel}>Amount to pay</Text>
          <Text style={styles.amountValue}>{formatRupiah(total())}</Text>
        </View>

        <Text style={styles.qrisHint}>
          Open your banking app, scan the QR code,{'\n'}
          then tap "Payment Received" below.
        </Text>

        <TouchableOpacity
          style={[styles.confirmBtn, saving && styles.confirmBtnDisabled]}
          onPress={handleConfirmPayment}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.confirmBtnText}>✓ Payment Received</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: '#f8fafc' },
  left: { flex: 1, padding: 24, backgroundColor: '#fff', borderRightWidth: 1, borderRightColor: '#e2e8f0' },
  backBtn: { marginBottom: 20 },
  backBtnText: { color: '#6366f1', fontSize: 15, fontWeight: '600' },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#1e293b', marginBottom: 16 },
  itemList: { flex: 1 },
  summaryItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  itemName: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  itemQty: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  itemTotal: { fontSize: 14, fontWeight: '700', color: '#6366f1' },
  divider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 16 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 16, color: '#64748b', fontWeight: '500' },
  totalAmount: { fontSize: 24, fontWeight: '800', color: '#1e293b' },
  right: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#fafafa' },
  qrisTitle: { fontSize: 22, fontWeight: '800', color: '#1e293b', marginBottom: 4 },
  qrisSubtitle: { fontSize: 13, color: '#64748b', marginBottom: 24 },
  qrContainer: {
    width: 240, height: 240, backgroundColor: '#fff', borderRadius: 16, padding: 12,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 4, marginBottom: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  qrImage: { width: 200, height: 200 },
  amountBadge: { backgroundColor: '#eef2ff', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, alignItems: 'center', marginBottom: 16 },
  amountLabel: { fontSize: 11, color: '#6366f1', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  amountValue: { fontSize: 22, fontWeight: '800', color: '#4338ca', marginTop: 2 },
  qrisHint: { fontSize: 13, color: '#94a3b8', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  confirmBtn: { width: '100%', paddingVertical: 16, backgroundColor: '#22c55e', borderRadius: 14, alignItems: 'center', marginBottom: 10 },
  confirmBtnDisabled: { backgroundColor: '#86efac' },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  cancelBtn: { width: '100%', paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  cancelBtnText: { color: '#64748b', fontWeight: '600' },
  successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  successIcon: { fontSize: 64, marginBottom: 16 },
  successTitle: { fontSize: 28, fontWeight: '800', color: '#1e293b' },
  successSub: { fontSize: 14, color: '#94a3b8', marginTop: 8 },
})
