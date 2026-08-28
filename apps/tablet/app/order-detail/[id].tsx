import React, { useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { pb } from '../../lib/pocketbase'
import { useCart } from '../../store/cart'
import { formatRupiah } from '../../lib/format'
import type { Order, OrderItem } from '../../../../packages/types'

export default function OrderDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { setCustomerName, setOrderId, clear } = useCart()

  const [order,    setOrder]    = useState<Order | null>(null)
  const [items,    setItems]    = useState<OrderItem[]>([])
  const [loading,  setLoading]  = useState(true)
  const [updating, setUpdating] = useState(false)

  const load = async () => {
    try {
      const o = await pb.collection('orders').getOne<Order>(id, {
        expand: 'order_items_via_order',
      })
      setOrder(o)
      setItems((o.expand as any)?.['order_items_via_order'] ?? [])
    } finally {
      setLoading(false)
    }
  }

  useFocusEffect(useCallback(() => { load() }, [id]))

  const addItems = () => {
    if (!order) return
    setCustomerName(order.customer_name ?? '')
    setOrderId(order.id)
    router.push('/pos')
  }

  const removeItem = async (itemId: string) => {
    setUpdating(true)
    try {
      await pb.collection('order_items').delete(itemId)
      const remaining = items.filter(i => i.id !== itemId)
      setItems(remaining)
      const newTotal = remaining.reduce((s, i) => s + i.price * i.quantity, 0)
      await pb.collection('orders').update(order!.id, { total: newTotal })
      setOrder(o => o ? { ...o, total: newTotal } : o)
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to remove item')
    } finally {
      setUpdating(false)
    }
  }

  const cancelOrder = async () => {
    Alert.alert('Cancel Order', `Cancel order for "${order?.customer_name}"?`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel', style: 'destructive',
        onPress: async () => {
          setUpdating(true)
          try {
            await pb.collection('orders').update(order!.id, { status: 'cancelled' })
            router.replace('/active-orders')
          } finally {
            setUpdating(false)
          }
        },
      },
    ])
  }

  const confirmAndPay = async () => {
    if (items.length === 0) {
      Alert.alert('Empty Order', 'Add at least one item before confirming.')
      return
    }
    setUpdating(true)
    try {
      await pb.collection('orders').update(order!.id, { status: 'confirmed' })
      // Load cart with this order's items for checkout
      clear()
      setCustomerName(order!.customer_name ?? '')
      setOrderId(order!.id)
      // Pass items to cart
      router.push({ pathname: '/checkout', params: { orderId: order!.id } })
    } finally {
      setUpdating(false)
    }
  }

  if (loading) return (
    <SafeAreaView style={styles.root}>
      <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 60 }} />
    </SafeAreaView>
  )

  if (!order) return (
    <SafeAreaView style={styles.root}>
      <Text style={styles.errorText}>Order not found</Text>
    </SafeAreaView>
  )

  const isPending   = order.status === 'pending'
  const isConfirmed = order.status === 'confirmed'
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0)

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.customerName}>{order.customer_name || 'Unknown'}</Text>
          <View style={[styles.statusBadge, { backgroundColor: isPending ? '#fef9c3' : '#dbeafe' }]}>
            <Text style={[styles.statusText, { color: isPending ? '#854d0e' : '#1d4ed8' }]}>
              {order.status}
            </Text>
          </View>
        </View>
        {isPending && (
          <TouchableOpacity style={styles.addBtn} onPress={addItems}>
            <Text style={styles.addBtnText}>+ Add Items</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Items list */}
      <ScrollView style={styles.list}>
        {items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No items yet</Text>
          </View>
        ) : (
          items.map(item => (
            <View key={item.id} style={styles.item}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.product_name}</Text>
                <Text style={styles.itemPrice}>{formatRupiah(item.price)} × {item.quantity}</Text>
              </View>
              <Text style={styles.itemTotal}>{formatRupiah(item.price * item.quantity)}</Text>
              {isPending && (
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => removeItem(item.id)}
                  disabled={updating}
                >
                  <Text style={styles.removeBtnText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalAmount}>{formatRupiah(total)}</Text>
        </View>

        {(isPending || isConfirmed) && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={cancelOrder}
              disabled={updating}
            >
              <Text style={styles.cancelBtnText}>Cancel Order</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.payBtn, (items.length === 0 || updating) && styles.payBtnDisabled]}
              onPress={confirmAndPay}
              disabled={items.length === 0 || updating}
            >
              {updating
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.payBtnText}>
                    {isPending ? 'Confirm & Pay →' : 'Proceed to Pay →'}
                  </Text>
              }
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  backText: { color: '#6366f1', fontSize: 14, fontWeight: '600', marginRight: 12 },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  customerName: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  addBtn: { backgroundColor: '#6366f1', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  list: { flex: 1, padding: 16 },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 15, color: '#94a3b8' },
  item: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 12, padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  itemName: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  itemPrice: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  itemTotal: { fontSize: 14, fontWeight: '700', color: '#6366f1', marginRight: 10 },
  removeBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center' },
  removeBtnText: { fontSize: 12, color: '#ef4444', fontWeight: '700' },
  footer: { backgroundColor: '#fff', padding: 20, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  totalLabel: { fontSize: 16, color: '#64748b', fontWeight: '500' },
  totalAmount: { fontSize: 22, fontWeight: '800', color: '#1e293b' },
  actions: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  cancelBtnText: { color: '#ef4444', fontWeight: '600', fontSize: 13 },
  payBtn: { flex: 2, paddingVertical: 14, backgroundColor: '#22c55e', borderRadius: 12, alignItems: 'center' },
  payBtnDisabled: { backgroundColor: '#86efac' },
  payBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  errorText: { textAlign: 'center', marginTop: 60, color: '#94a3b8' },
})
