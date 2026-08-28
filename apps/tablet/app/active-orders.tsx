import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, TextInput, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { pb } from '../lib/pocketbase'
import { useCart } from '../store/cart'
import { formatRupiah } from '../lib/format'

interface OpenOrder {
  id: string
  customer_name: string
  total: number
  created: string
  status: string
}

export default function ActiveOrdersScreen() {
  const router = useRouter()
  const { setOrder, clearOrder } = useCart()

  const [orders,       setOrders]       = useState<OpenOrder[]>([])
  const [loading,      setLoading]      = useState(true)
  const [newName,      setNewName]      = useState('')
  const [showInput,    setShowInput]    = useState(false)
  const [storeName,    setStoreName]    = useState('CafeCash')
  const [logoEmoji,    setLogoEmoji]    = useState('☕')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await pb.collection('orders').getFullList<OpenOrder>({
        filter: "status = 'open'",
        sort:   '-created',
      })
      setOrders(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Fetch store settings
    pb.collection('settings').getFirstListItem<{ store_name: string; logo_emoji: string }>('')
      .then(s => {
        if (s.store_name) setStoreName(s.store_name)
        if (s.logo_emoji) setLogoEmoji(s.logo_emoji)
      }).catch(() => {})

    load()

    // Realtime — refresh when orders change
    pb.collection('orders').subscribe('*', () => load())
    return () => { pb.collection('orders').unsubscribe('*') }
  }, [load])

  const startNewOrder = async () => {
    const name = newName.trim()
    if (!name) return Alert.alert('Name required', 'Please enter a customer name or table number.')

    try {
      const order = await pb.collection('orders').create({
        customer_name: name,
        total:  0,
        status: 'open',
      })
      clearOrder()
      setOrder(order.id, name)
      setNewName('')
      setShowInput(false)
      router.push('/pos')
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to create order')
    }
  }

  const openOrder = (order: OpenOrder) => {
    clearOrder()
    setOrder(order.id, order.customer_name)
    router.push('/pos')
  }

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>{logoEmoji} {storeName}</Text>
        <Text style={styles.headerSub}>Active Orders</Text>
      </View>

      {/* New order input */}
      {showInput ? (
        <View style={styles.newOrderForm}>
          <TextInput
            style={styles.nameInput}
            placeholder="Customer name or table (e.g. Meja 3, Bibib)"
            placeholderTextColor="#94a3b8"
            value={newName}
            onChangeText={setNewName}
            autoFocus
            onSubmitEditing={startNewOrder}
          />
          <View style={styles.formBtns}>
            <TouchableOpacity style={styles.cancelFormBtn} onPress={() => { setShowInput(false); setNewName('') }}>
              <Text style={styles.cancelFormBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.startBtn} onPress={startNewOrder}>
              <Text style={styles.startBtnText}>Start Order →</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.newOrderBtn} onPress={() => setShowInput(true)}>
          <Text style={styles.newOrderBtnText}>+ New Order</Text>
        </TouchableOpacity>
      )}

      {/* Active orders list */}
      {loading ? (
        <ActivityIndicator color="#6366f1" style={{ marginTop: 40 }} />
      ) : orders.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🛎️</Text>
          <Text style={styles.emptyText}>No active orders</Text>
          <Text style={styles.emptySub}>Tap "+ New Order" to start</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={o => o.id}
          contentContainerStyle={styles.list}
          numColumns={3}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.orderCard} onPress={() => openOrder(item)}>
              <Text style={styles.orderName} numberOfLines={2}>{item.customer_name || '—'}</Text>
              <Text style={styles.orderTotal}>{formatRupiah(item.total)}</Text>
              <View style={styles.orderBadge}>
                <Text style={styles.orderBadgeText}>OPEN</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    paddingHorizontal: 24, paddingVertical: 16,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  logo:      { fontSize: 20, fontWeight: '700', color: '#1e293b' },
  headerSub: { fontSize: 13, color: '#64748b', fontWeight: '500' },

  newOrderBtn: {
    margin: 16, paddingVertical: 14, backgroundColor: '#6366f1',
    borderRadius: 14, alignItems: 'center',
  },
  newOrderBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  newOrderForm: { margin: 16, backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  nameInput: {
    borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#1e293b', marginBottom: 12,
  },
  formBtns: { flexDirection: 'row', gap: 10 },
  cancelFormBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  cancelFormBtnText: { color: '#64748b', fontWeight: '600' },
  startBtn: { flex: 2, paddingVertical: 12, backgroundColor: '#6366f1', borderRadius: 10, alignItems: 'center' },
  startBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  emptySub:  { fontSize: 13, color: '#94a3b8', marginTop: 4 },

  list: { padding: 12 },
  orderCard: {
    flex: 1, margin: 8, padding: 16,
    backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1, borderColor: '#e2e8f0',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  orderName:  { fontSize: 15, fontWeight: '700', color: '#1e293b', marginBottom: 6 },
  orderTotal: { fontSize: 14, color: '#6366f1', fontWeight: '600', marginBottom: 8 },
  orderBadge: { backgroundColor: '#dcfce7', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  orderBadgeText: { fontSize: 10, fontWeight: '700', color: '#16a34a', letterSpacing: 0.5 },
})
