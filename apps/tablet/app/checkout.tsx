import React, { useState, useEffect } from 'react'
import {
  View, Text, Image, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, Alert, TextInput,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import { pb } from '../lib/pocketbase'
import { useCart } from '../store/cart'
import { formatRupiah } from '../lib/format'

const API_URL = process.env.EXPO_PUBLIC_API_URL!

interface SettingsRecord { id: string; collectionId: string; qris_image: string }

type PaymentStep = 'method' | 'qris' | 'cash' | 'split'

export default function CheckoutScreen() {
  const router = useRouter()
  const { orderId, customerName, items, total, clearOrder } = useCart()

  const [step,        setStep]        = useState<PaymentStep>('method')
  const [saving,      setSaving]      = useState(false)
  const [paid,        setPaid]        = useState(false)
  const [qrisUrl,     setQrisUrl]     = useState<string | null>(null)
  const [loadingQris, setLoadingQris] = useState(true)
  const [slipUri,     setSlipUri]     = useState<string | null>(null)
  const [note,        setNote]        = useState('')

  useEffect(() => {
    pb.collection('settings')
      .getFirstListItem<SettingsRecord>('')
      .then(r => {
        if (r.qris_image)
          setQrisUrl(`${API_URL}/api/files/${r.collectionId}/${r.id}/${r.qris_image}`)
      })
      .catch(() => {})
      .finally(() => setLoadingQris(false))
  }, [])

  // Each picker is a standalone async function — no nested Alert callbacks
  const pickFromGallery = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!perm.granted) { Alert.alert('Permission needed', 'Allow gallery in Settings.'); return }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      })
      if (!result.canceled && result.assets?.[0]?.uri) {
        setSlipUri(result.assets[0].uri)
      }
    } catch (e: any) {
      Alert.alert('Gallery error', e?.message ?? 'Failed to open gallery')
    }
  }

  const pickFromCamera = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync()
      if (!perm.granted) { Alert.alert('Permission needed', 'Allow camera in Settings.'); return }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      })
      if (!result.canceled && result.assets?.[0]?.uri) {
        setSlipUri(result.assets[0].uri)
      }
    } catch (e: any) {
      Alert.alert('Camera error', e?.message ?? 'Failed to open camera')
    }
  }

  const confirmPayment = async (method: 'qris' | 'cash' | 'split') => {
    if (!orderId) {
      Alert.alert('Error', 'No active order found.')
      return
    }
    setSaving(true)
    try {
      // Delete existing items then recreate
      const existing = await pb.collection('order_items').getFullList({ filter: `order = '${orderId}'`, fields: 'id' })
      await Promise.all(existing.map(i => pb.collection('order_items').delete(i.id)))
      await Promise.all(items.map(i => pb.collection('order_items').create({
        order: orderId, product: i.product.id,
        product_name: i.product.name, price: i.product.price, quantity: i.quantity,
      })))

      const formData = new FormData()
      formData.append('total',          String(total()))
      formData.append('status',         'paid')
      formData.append('payment_method', method)
      if (note.trim()) formData.append('note', note.trim())
      if (slipUri) {
        formData.append('payment_slip', { uri: slipUri, name: `slip_${Date.now()}.jpg`, type: 'image/jpeg' } as any)
      }
      await pb.collection('orders').update(orderId, formData)

      setPaid(true)
      clearOrder()
      setTimeout(() => router.replace('/active-orders'), 3000)
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
          <Text style={styles.successSub}>Order for {customerName} complete</Text>
          <Text style={styles.successSub}>Returning to orders...</Text>
        </View>
      </SafeAreaView>
    )
  }

  // Reusable photo picker UI
  const PhotoPicker = ({ label }: { label: string }) => (
    slipUri ? (
      <View style={styles.slipPreview}>
        <Image source={{ uri: slipUri }} style={styles.slipImage} resizeMode="cover" />
        <Text style={styles.slipLabel}>✓ Receipt attached</Text>
        <View style={styles.retakeBtns}>
          <TouchableOpacity style={styles.retakeBtn} onPress={pickFromCamera}>
            <Text style={styles.retakeBtnText}>📷 Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.retakeBtn} onPress={pickFromGallery}>
            <Text style={styles.retakeBtnText}>🖼️ Gallery</Text>
          </TouchableOpacity>
        </View>
      </View>
    ) : (
      <View style={styles.photoBtnRow}>
        <TouchableOpacity style={[styles.photoBtn, { flex: 1, marginRight: 6 }]} onPress={pickFromCamera}>
          <Text style={styles.photoBtnIcon}>📷</Text>
          <Text style={styles.photoBtnText}>Camera</Text>
          <Text style={styles.photoBtnSub}>{label}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.photoBtn, { flex: 1, marginLeft: 6 }]} onPress={pickFromGallery}>
          <Text style={styles.photoBtnIcon}>🖼️</Text>
          <Text style={styles.photoBtnText}>Gallery</Text>
          <Text style={styles.photoBtnSub}>Select photo</Text>
        </TouchableOpacity>
      </View>
    )
  )

  return (
    <SafeAreaView style={styles.root}>

      {/* Left: Order Summary */}
      <View style={styles.left}>
        <TouchableOpacity style={styles.backBtn}
          onPress={() => step === 'method' ? router.back() : setStep('method')}>
          <Text style={styles.backBtnText}>← {step === 'method' ? 'Back to Order' : 'Change Method'}</Text>
        </TouchableOpacity>

        <Text style={styles.customerName}>{customerName}</Text>
        <Text style={styles.sectionTitle}>Order Summary</Text>

        <ScrollView style={styles.itemList} showsVerticalScrollIndicator={false}>
          {items.map(item => (
            <View key={item.product.id} style={styles.summaryItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.product.name}</Text>
                <Text style={styles.itemQty}>x{item.quantity}</Text>
              </View>
              <Text style={styles.itemTotal}>{formatRupiah(item.product.price * item.quantity)}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.divider} />
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalAmount}>{formatRupiah(total())}</Text>
        </View>
      </View>

      {/* Right: Payment flow */}
      <ScrollView style={styles.right} contentContainerStyle={styles.rightContent}
        showsVerticalScrollIndicator={false} bounces={false}>

        {/* Method selection */}
        {step === 'method' && (
          <>
            <Text style={styles.stepTitle}>Select Payment Method</Text>
            <Text style={styles.stepSub}>How will the customer pay?</Text>
            {[
              { icon: '📱', label: 'QRIS', desc: 'e-wallet or mobile banking — photo required', value: 'qris' },
              { icon: '💵', label: 'Cash', desc: 'Physical money — no photo needed', value: 'cash' },
              { icon: '🔀', label: 'Split Payment', desc: 'Cash + QRIS — photo + note required', value: 'split' },
            ].map(m => (
              <TouchableOpacity key={m.value} style={styles.methodBtn}
                onPress={() => { setSlipUri(null); setNote(''); setStep(m.value as PaymentStep) }}>
                <Text style={styles.methodIcon}>{m.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.methodLabel}>{m.label}</Text>
                  <Text style={styles.methodDesc}>{m.desc}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* QRIS */}
        {step === 'qris' && (
          <>
            <Text style={styles.stepTitle}>QRIS Payment</Text>
            <View style={styles.qrContainer}>
              {loadingQris ? <ActivityIndicator color="#6366f1" size="large" />
                : qrisUrl ? <Image source={{ uri: qrisUrl }} style={styles.qrImage} resizeMode="contain" />
                : <View style={styles.qrPlaceholder}>
                    <Text style={styles.qrPlaceholderText}>QRIS not configured</Text>
                    <Text style={styles.qrPlaceholderSub}>Upload in Settings</Text>
                  </View>
              }
            </View>
            <View style={styles.amountBadge}>
              <Text style={styles.amountLabel}>Amount to pay</Text>
              <Text style={styles.amountValue}>{formatRupiah(total())}</Text>
            </View>
            <PhotoPicker label="Take receipt photo" />
            <TouchableOpacity
              style={[styles.confirmBtn, (!slipUri || saving) && styles.confirmBtnDisabled]}
              onPress={() => confirmPayment('qris')} disabled={!slipUri || saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmBtnText}>✓ Confirm Payment</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setStep('method')}>
              <Text style={styles.cancelBtnText}>← Change Method</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Cash */}
        {step === 'cash' && (
          <>
            <Text style={styles.stepTitle}>Cash Payment</Text>
            <View style={styles.amountBadge}>
              <Text style={styles.amountLabel}>Amount to collect</Text>
              <Text style={styles.amountValue}>{formatRupiah(total())}</Text>
            </View>
            <View style={styles.noteContainer}>
              <Text style={styles.noteLabel}>Note (optional)</Text>
              <TextInput style={styles.noteInput}
                placeholder="e.g. Paid with 50rb, change 22rb"
                placeholderTextColor="#94a3b8"
                value={note} onChangeText={setNote} multiline />
            </View>
            <TouchableOpacity
              style={[styles.confirmBtn, saving && styles.confirmBtnDisabled]}
              onPress={() => confirmPayment('cash')} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmBtnText}>✓ Confirm Cash Payment</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setStep('method')}>
              <Text style={styles.cancelBtnText}>← Change Method</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Split */}
        {step === 'split' && (
          <>
            <Text style={styles.stepTitle}>Split Payment</Text>
            <View style={styles.amountBadge}>
              <Text style={styles.amountLabel}>Total to collect</Text>
              <Text style={styles.amountValue}>{formatRupiah(total())}</Text>
            </View>
            <View style={styles.noteContainer}>
              <Text style={styles.noteLabel}>Split breakdown (required)</Text>
              <TextInput style={styles.noteInput}
                placeholder="e.g. Cash 5rb + QRIS 40rb"
                placeholderTextColor="#94a3b8"
                value={note} onChangeText={setNote} multiline />
            </View>
            <PhotoPicker label="QRIS receipt photo" />
            <TouchableOpacity
              style={[styles.confirmBtn, (!slipUri || !note.trim() || saving) && styles.confirmBtnDisabled]}
              onPress={() => confirmPayment('split')} disabled={!slipUri || !note.trim() || saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmBtnText}>✓ Confirm Split Payment</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setStep('method')}>
              <Text style={styles.cancelBtnText}>← Change Method</Text>
            </TouchableOpacity>
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: '#f8fafc' },
  left: { flex: 1, padding: 24, backgroundColor: '#fff', borderRightWidth: 1, borderRightColor: '#e2e8f0' },
  backBtn: { marginBottom: 12 },
  backBtnText: { color: '#6366f1', fontSize: 14, fontWeight: '600' },
  customerName: { fontSize: 18, fontWeight: '800', color: '#6366f1', marginBottom: 4 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#94a3b8', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  itemList: { flex: 1 },
  summaryItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  itemName: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  itemQty:  { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  itemTotal: { fontSize: 14, fontWeight: '700', color: '#6366f1' },
  divider:  { height: 1, backgroundColor: '#e2e8f0', marginVertical: 14 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel:  { fontSize: 16, color: '#64748b', fontWeight: '500' },
  totalAmount: { fontSize: 24, fontWeight: '800', color: '#1e293b' },

  right:        { flex: 1, backgroundColor: '#fafafa' },
  rightContent: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 20 },

  stepTitle: { fontSize: 20, fontWeight: '800', color: '#1e293b', marginBottom: 4, alignSelf: 'flex-start' },
  stepSub:   { fontSize: 13, color: '#64748b', marginBottom: 20, alignSelf: 'flex-start' },

  methodBtn: {
    width: '100%', flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  methodIcon:  { fontSize: 28, marginRight: 12 },
  methodLabel: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  methodDesc:  { fontSize: 11, color: '#94a3b8', marginTop: 2 },

  qrContainer: {
    width: 200, height: 200, backgroundColor: '#fff', borderRadius: 16, padding: 10,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
    marginBottom: 14, alignItems: 'center', justifyContent: 'center',
  },
  qrImage: { width: 180, height: 180 },
  qrPlaceholder:     { alignItems: 'center' },
  qrPlaceholderText: { fontSize: 12, fontWeight: '600', color: '#94a3b8', textAlign: 'center' },
  qrPlaceholderSub:  { fontSize: 10, color: '#cbd5e1', marginTop: 4, textAlign: 'center' },

  amountBadge:  { backgroundColor: '#eef2ff', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, alignItems: 'center', marginBottom: 14, width: '100%' },
  amountLabel:  { fontSize: 10, color: '#6366f1', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  amountValue:  { fontSize: 20, fontWeight: '800', color: '#4338ca', marginTop: 2 },

  // Photo picker
  photoBtnRow:  { flexDirection: 'row', width: '100%', marginBottom: 14 },
  photoBtn: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    alignItems: 'center', borderWidth: 2, borderColor: '#6366f1', borderStyle: 'dashed',
  },
  photoBtnIcon: { fontSize: 24, marginBottom: 4 },
  photoBtnText: { fontSize: 13, fontWeight: '700', color: '#6366f1' },
  photoBtnSub:  { fontSize: 10, color: '#94a3b8', marginTop: 2, textAlign: 'center' },

  slipPreview: { width: '100%', marginBottom: 14, alignItems: 'center' },
  slipImage:   { width: '100%', height: 140, borderRadius: 12, marginBottom: 6 },
  slipLabel:   { fontSize: 12, color: '#16a34a', fontWeight: '600', marginBottom: 6 },
  retakeBtns:  { flexDirection: 'row', gap: 8 },
  retakeBtn:   { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  retakeBtnText: { fontSize: 12, color: '#64748b', fontWeight: '600' },

  noteContainer: { width: '100%', marginBottom: 14 },
  noteLabel: { fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 6 },
  noteInput: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: 10, padding: 12, fontSize: 13, color: '#1e293b',
    minHeight: 60, textAlignVertical: 'top',
  },

  confirmBtn:         { width: '100%', paddingVertical: 15, backgroundColor: '#22c55e', borderRadius: 14, alignItems: 'center', marginBottom: 10 },
  confirmBtnDisabled: { backgroundColor: '#86efac' },
  confirmBtnText:     { color: '#fff', fontWeight: '700', fontSize: 15 },
  cancelBtn:          { width: '100%', paddingVertical: 13, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  cancelBtnText:      { color: '#64748b', fontWeight: '600', fontSize: 13 },

  successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  successIcon:  { fontSize: 64, marginBottom: 16 },
  successTitle: { fontSize: 28, fontWeight: '800', color: '#1e293b' },
  successSub:   { fontSize: 14, color: '#94a3b8', marginTop: 6 },
})
