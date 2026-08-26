import React, { useEffect, useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { pb } from '../lib/pocketbase'
import { useCart } from '../store/cart'
import { formatRupiah } from '../lib/format'
import type { Product } from '../../../packages/types'

const CATEGORIES = ['All', 'Coffee', 'Non-Coffee', 'Drinks', 'Food']

export default function POSScreen() {
  const router = useRouter()
  const { items, add, increment, decrement, total, clear } = useCart()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('All')

  useEffect(() => {
    // Initial fetch
    pb.collection('products')
      .getFullList<Product>({ filter: 'is_available = true', sort: 'category,name' })
      .then(data => { setProducts(data); setLoading(false) })
      .catch(() => setLoading(false))

    // Realtime subscription — live-update when admin changes products
    pb.collection('products').subscribe<Product>('*', ({ action, record }) => {
      setProducts(prev => {
        if (action === 'create') {
          return record.is_available ? [...prev, record] : prev
        }
        if (action === 'update') {
          if (!record.is_available) return prev.filter(p => p.id !== record.id)
          const idx = prev.findIndex(p => p.id === record.id)
          if (idx === -1) return [...prev, record]
          return prev.map(p => p.id === record.id ? record : p)
        }
        if (action === 'delete') return prev.filter(p => p.id !== record.id)
        return prev
      })
    })

    return () => { pb.collection('products').unsubscribe('*') }
  }, [])

  const filtered = activeCategory === 'All'
    ? products
    : products.filter(p => p.category === activeCategory)

  const cartCount = items.reduce((s, i) => s + i.quantity, 0)
  const getQty = (id: string) => items.find(i => i.product.id === id)?.quantity ?? 0

  return (
    <SafeAreaView style={styles.root}>
      {/* Left: Product Grid */}
      <View style={styles.left}>
        <View style={styles.header}>
          <Text style={styles.logo}>🌙 Luna POS</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[styles.tab, activeCategory === cat && styles.tabActive]}
              onPress={() => setActiveCategory(cat)}
            >
              <Text style={[styles.tabText, activeCategory === cat && styles.tabTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={item => item.id}
            numColumns={3}
            contentContainerStyle={styles.grid}
            renderItem={({ item }) => {
              const qty = getQty(item.id)
              return (
                <TouchableOpacity style={styles.card} onPress={() => add(item)}>
                  <View style={styles.cardEmoji}>
                    <Text style={{ fontSize: 32 }}>☕</Text>
                  </View>
                  <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
                  <Text style={styles.cardPrice}>{formatRupiah(item.price)}</Text>
                  {qty > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{qty}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )
            }}
          />
        )}
      </View>

      {/* Right: Cart */}
      <View style={styles.right}>
        <Text style={styles.cartTitle}>Order</Text>

        {items.length === 0 ? (
          <View style={styles.emptyCart}>
            <Text style={styles.emptyText}>No items yet</Text>
            <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>
              Tap a product to add
            </Text>
          </View>
        ) : (
          <ScrollView style={styles.cartList}>
            {items.map(item => (
              <View key={item.product.id} style={styles.cartItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cartItemName} numberOfLines={1}>
                    {item.product.name}
                  </Text>
                  <Text style={styles.cartItemPrice}>
                    {formatRupiah(item.product.price * item.quantity)}
                  </Text>
                </View>
                <View style={styles.qtyControl}>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => decrement(item.product.id)}>
                    <Text style={styles.qtyBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{item.quantity}</Text>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => increment(item.product.id)}>
                    <Text style={styles.qtyBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
        )}

        <View style={styles.cartFooter}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalAmount}>{formatRupiah(total())}</Text>
          </View>
          <View style={styles.footerActions}>
            <TouchableOpacity style={styles.clearBtn} onPress={clear} disabled={items.length === 0}>
              <Text style={styles.clearBtnText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.checkoutBtn, items.length === 0 && styles.checkoutBtnDisabled]}
              onPress={() => router.push('/checkout')}
              disabled={items.length === 0}
            >
              <Text style={styles.checkoutBtnText}>
                Charge · {cartCount} item{cartCount !== 1 ? 's' : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: '#f8fafc' },
  left: { flex: 2, backgroundColor: '#f8fafc' },
  header: {
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  logo: { fontSize: 20, fontWeight: '700', color: '#1e293b' },
  tabs: { paddingHorizontal: 16, paddingVertical: 10, flexGrow: 0 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8, backgroundColor: '#e2e8f0' },
  tabActive: { backgroundColor: '#6366f1' },
  tabText: { color: '#64748b', fontWeight: '500' },
  tabTextActive: { color: '#fff' },
  grid: { padding: 12 },
  card: {
    flex: 1, margin: 6, padding: 12,
    backgroundColor: '#fff', borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 2, position: 'relative',
  },
  cardEmoji: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  cardName: { fontSize: 13, fontWeight: '600', color: '#1e293b', textAlign: 'center' },
  cardPrice: { fontSize: 12, color: '#6366f1', marginTop: 4, fontWeight: '500' },
  badge: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: '#6366f1', borderRadius: 10,
    width: 20, height: 20, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  right: { flex: 1, backgroundColor: '#fff', borderLeftWidth: 1, borderLeftColor: '#e2e8f0', flexDirection: 'column' },
  cartTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  emptyCart: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#64748b', fontSize: 15, fontWeight: '500' },
  cartList: { flex: 1, padding: 12 },
  cartItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  cartItemName: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
  cartItemPrice: { fontSize: 12, color: '#6366f1', marginTop: 2 },
  qtyControl: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { fontSize: 16, color: '#1e293b', fontWeight: '600' },
  qtyText: { fontSize: 14, fontWeight: '700', color: '#1e293b', minWidth: 20, textAlign: 'center' },
  cartFooter: { padding: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  totalLabel: { fontSize: 15, color: '#64748b', fontWeight: '500' },
  totalAmount: { fontSize: 20, fontWeight: '800', color: '#1e293b' },
  footerActions: { flexDirection: 'row', gap: 8 },
  clearBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  clearBtnText: { color: '#64748b', fontWeight: '600' },
  checkoutBtn: { flex: 2, paddingVertical: 14, backgroundColor: '#6366f1', borderRadius: 12, alignItems: 'center' },
  checkoutBtnDisabled: { backgroundColor: '#c7d2fe' },
  checkoutBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
})
