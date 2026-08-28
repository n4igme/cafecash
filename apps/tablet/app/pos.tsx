import React, { useEffect, useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, Image, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { pb } from '../lib/pocketbase'
import { useCart } from '../store/cart'
import { formatRupiah } from '../lib/format'
import { deductStock, restoreStock } from '../lib/stock'
import type { Product } from '../../../packages/types'

const API_URL = process.env.EXPO_PUBLIC_API_URL!
const CATEGORIES = ['All', 'Coffee', 'Non-Coffee', 'Drinks', 'Food']

function getProductImageUrl(product: Product): string | null {
  if (product.image)
    return `${API_URL}/api/files/${product.collectionId}/${product.id}/${product.image}`
  return null
}

interface StoreSettings { store_name: string; logo_emoji: string; logo: string; id: string; collectionId: string }

// Map of productId → available qty (null = no recipe = unlimited)
type StockMap = Record<string, number | null>

function buildStockMap(
  recipes: { product: string; ingredient: string; qty_needed: number }[],
  ingredients: { id: string; stock_qty: number }[]
): StockMap {
  const ingrMap: Record<string, number> = {}
  ingredients.forEach(i => { ingrMap[i.id] = i.stock_qty })

  // Group recipes by product
  const byProduct: Record<string, { ingredient: string; qty_needed: number }[]> = {}
  recipes.forEach(r => {
    if (!byProduct[r.product]) byProduct[r.product] = []
    byProduct[r.product].push({ ingredient: r.ingredient, qty_needed: r.qty_needed })
  })

  const map: StockMap = {}
  Object.entries(byProduct).forEach(([productId, reqs]) => {
    let min = Infinity
    reqs.forEach(req => {
      const stock = ingrMap[req.ingredient] ?? 0
      const possible = req.qty_needed > 0 ? Math.floor(stock / req.qty_needed) : Infinity
      min = Math.min(min, possible)
    })
    map[productId] = min === Infinity ? null : min
  })
  return map
}

export default function POSScreen() {
  const router = useRouter()
  const { orderId, customerName, items, add, increment, decrement, total, clearOrder } = useCart()

  const [products,       setProducts]       = useState<Product[]>([])
  const [loading,        setLoading]        = useState(true)
  const [activeCategory, setActiveCategory] = useState('All')
  const [storeName,      setStoreName]      = useState('CafeCash')
  const [logoEmoji,      setLogoEmoji]      = useState('☕')
  const [logoUrl,        setLogoUrl]        = useState<string | null>(null)
  const [stockMap,       setStockMap]       = useState<StockMap>({})

  useEffect(() => {
    pb.collection('settings').getFirstListItem<StoreSettings>('')
      .then(s => {
        if (s.store_name) setStoreName(s.store_name)
        if (s.logo_emoji) setLogoEmoji(s.logo_emoji)
        if (s.logo) setLogoUrl(`${API_URL}/api/files/${s.collectionId}/${s.id}/${s.logo}`)
      }).catch(() => {})

    pb.collection('products')
      .getFullList<Product>({ filter: 'is_available = true', sort: 'category,name' })
      .then(data => {
        setProducts(data)
        setLoading(false)

        // Fetch recipes + ingredients to build stock availability map
        Promise.all([
          pb.collection('recipes').getFullList<{ product: string; ingredient: string; qty_needed: number }>({ fields: 'product,ingredient,qty_needed' }),
          pb.collection('ingredients').getFullList<{ id: string; stock_qty: number }>({ fields: 'id,stock_qty' }),
        ]).then(([recipes, ingredients]) => {
          setStockMap(buildStockMap(recipes, ingredients))
        }).catch(() => {})

        // If reopening an existing order, load its items into cart
        if (orderId && items.length === 0) {
          pb.collection('order_items').getFullList<{
            id: string; product: string; product_name: string; price: number; quantity: number
          }>({ filter: `order = '${orderId}'` })
            .then(existingItems => {
              existingItems.forEach(oi => {
                const product = data.find(p => p.id === oi.product)
                if (product) {
                  // Add item qty times
                  for (let i = 0; i < oi.quantity; i++) add(product)
                }
              })
            })
            .catch(() => {})
        }
      })
      .catch(err => {
        console.error('[CafeCash] products fetch error:', JSON.stringify(err))
        setLoading(false)
      })

    pb.collection('products').subscribe<Product>('*', ({ action, record }) => {
      setProducts(prev => {
        if (action === 'create') return record.is_available ? [...prev, record] : prev
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

  const [saving, setSaving] = useState(false)

  const saveOrder = async () => {
    if (!orderId) {
      Alert.alert('Error', 'No order ID — go back and start a new order.')
      return
    }
    if (items.length === 0) {
      Alert.alert('No items', 'Add at least one item before saving.')
      return
    }
    setSaving(true)
    try {
      // 1. Get existing order_items (for stock restore)
      const existing = await pb.collection('order_items').getFullList<{
        id: string; product: string; quantity: number
      }>({ filter: `order = '${orderId}'`, fields: 'id,product,quantity' })

      // 2. Restore stock for old items
      if (existing.length > 0) {
        await restoreStock(orderId, existing.map(i => ({ product: i.product, quantity: i.quantity })))
      }

      // 3. Delete old order_items
      await Promise.all(existing.map(i => pb.collection('order_items').delete(i.id)))

      // 4. Create new order_items
      await Promise.all(items.map(i =>
        pb.collection('order_items').create({
          order: orderId, product: i.product.id,
          product_name: i.product.name, price: i.product.price, quantity: i.quantity,
        })
      ))

      // 5. Deduct stock for new items
      await deductStock(orderId, items.map(i => ({ product: i.product.id, quantity: i.quantity })))

      // 6. Update order total
      await pb.collection('orders').update(orderId, { total: total() })
      router.replace('/active-orders')
    } catch (e: any) {
      const msg = e?.response?.message ?? e?.message ?? 'Failed to save order'
      Alert.alert('Save Error', msg)
    } finally {
      setSaving(false)
    }
  }

  const cancelOrder = () => {
    Alert.alert(
      'Cancel Order',
      `Cancel order for "${customerName}"? This cannot be undone.`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel Order', style: 'destructive',
          onPress: async () => {
            if (orderId) {
              // Restore stock before cancelling
              const existing = await pb.collection('order_items').getFullList<{
                id: string; product: string; quantity: number
              }>({ filter: `order = '${orderId}'`, fields: 'id,product,quantity' })
              if (existing.length > 0) {
                await restoreStock(orderId, existing.map(i => ({ product: i.product, quantity: i.quantity })))
              }
              await pb.collection('orders').update(orderId, { status: 'cancelled' }).catch(() => {})
            }
            clearOrder()
            router.replace('/active-orders')
          }
        }
      ]
    )
  }

  return (
    <SafeAreaView style={styles.root}>
      {/* Left: Product Grid */}
      <View style={styles.left}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {logoUrl ? (
              <Image source={{ uri: logoUrl }} style={styles.logoImage} resizeMode="contain" />
            ) : (
              <Text style={styles.logoEmoji}>{logoEmoji}</Text>
            )}
            <View>
              <Text style={styles.logo}>{storeName}</Text>
              <Text style={styles.orderLabel}>Order: {customerName}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={cancelOrder} style={styles.cancelOrderBtn}>
            <Text style={styles.cancelOrderBtnText}>✕ Cancel</Text>
          </TouchableOpacity>
        </View>

        {/* Category tabs */}
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

        {/* Products */}
        {loading ? (
          <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={item => item.id}
            numColumns={3}
            contentContainerStyle={styles.grid}
            renderItem={({ item }) => {
              const qty      = getQty(item.id)
              const imgUrl   = getProductImageUrl(item)
              const available = stockMap[item.id] // null = unlimited, 0 = out
              const outOfStock = available !== null && available !== undefined && available <= 0

              return (
                <TouchableOpacity
                  style={[styles.card, outOfStock && styles.cardDisabled]}
                  onPress={() => !outOfStock && add(item)}
                  disabled={outOfStock}
                >
                  <View style={styles.cardImage}>
                    {imgUrl ? (
                      <Image source={{ uri: imgUrl }} style={[styles.productImage, outOfStock && { opacity: 0.3 }]} resizeMode="cover" />
                    ) : (
                      <Text style={{ fontSize: 28, opacity: outOfStock ? 0.3 : 1 }}>☕</Text>
                    )}
                  </View>
                  <Text style={[styles.cardName, outOfStock && styles.cardNameDisabled]} numberOfLines={2}>{item.name}</Text>
                  {outOfStock ? (
                    <Text style={styles.outOfStockLabel}>Out of stock</Text>
                  ) : (
                    <Text style={styles.cardPrice}>{formatRupiah(item.price)}</Text>
                  )}
                  {qty > 0 && !outOfStock && (
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
          {/* Save Order — persists items to DB, back to Active Orders */}
          <TouchableOpacity
            style={[styles.saveBtn, (items.length === 0 || saving) && styles.saveBtnDisabled]}
            onPress={saveOrder}
            disabled={items.length === 0 || saving}
          >
            {saving
              ? <ActivityIndicator color="#6366f1" size="small" />
              : <Text style={styles.saveBtnText}>💾 Save Order</Text>
            }
          </TouchableOpacity>
          {/* Proceed to Payment */}
          <TouchableOpacity
            style={[styles.checkoutBtn, items.length === 0 && styles.checkoutBtnDisabled]}
            onPress={() => router.push('/checkout')}
            disabled={items.length === 0}
          >
            <Text style={styles.checkoutBtnText}>
              Proceed to Payment · {cartCount} item{cartCount !== 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: '#f8fafc' },
  left: { flex: 2, backgroundColor: '#f8fafc' },

  header: {
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
    backgroundColor: '#fff',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoImage:   { width: 32, height: 32, borderRadius: 6 },
  logoEmoji:   { fontSize: 24 },
  logo:        { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  orderLabel:  { fontSize: 11, color: '#6366f1', fontWeight: '500', marginTop: 1 },

  cancelOrderBtn:     { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#fca5a5', backgroundColor: '#fff5f5' },
  cancelOrderBtnText: { color: '#ef4444', fontSize: 12, fontWeight: '600' },

  tabs: { paddingHorizontal: 16, paddingVertical: 10, flexGrow: 0 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8, backgroundColor: '#e2e8f0' },
  tabActive: { backgroundColor: '#6366f1' },
  tabText: { color: '#64748b', fontWeight: '500' },
  tabTextActive: { color: '#fff' },
  grid: { padding: 12 },
  card: {
    flex: 1, margin: 6, padding: 12,
    backgroundColor: '#fff', borderRadius: 12, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 2, position: 'relative',
  },
  cardImage: {
    width: 60, height: 60, borderRadius: 10,
    backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center',
    marginBottom: 8, overflow: 'hidden',
  },
  productImage: { width: 60, height: 60, borderRadius: 10 },
  cardName:  { fontSize: 13, fontWeight: '600', color: '#1e293b', textAlign: 'center' },
  cardNameDisabled: { fontSize: 13, fontWeight: '600', color: '#cbd5e1', textAlign: 'center' },
  cardPrice: { fontSize: 12, color: '#6366f1', marginTop: 4, fontWeight: '500' },
  outOfStockLabel: { fontSize: 10, color: '#ef4444', marginTop: 4, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  cardDisabled: { opacity: 0.6, backgroundColor: '#f8fafc' },
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
  cartList:  { flex: 1, padding: 12 },
  cartItem:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  cartItemName:  { fontSize: 13, fontWeight: '600', color: '#1e293b' },
  cartItemPrice: { fontSize: 12, color: '#6366f1', marginTop: 2 },
  qtyControl: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn:     { width: 28, height: 28, borderRadius: 14, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { fontSize: 16, color: '#1e293b', fontWeight: '600' },
  qtyText:    { fontSize: 14, fontWeight: '700', color: '#1e293b', minWidth: 20, textAlign: 'center' },
  cartFooter: { padding: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  totalRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  totalLabel:  { fontSize: 15, color: '#64748b', fontWeight: '500' },
  totalAmount: { fontSize: 20, fontWeight: '800', color: '#1e293b' },
  checkoutBtn: { paddingVertical: 14, backgroundColor: '#6366f1', borderRadius: 12, alignItems: 'center' },
  checkoutBtnDisabled: { backgroundColor: '#c7d2fe' },
  checkoutBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  saveBtn: { paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginBottom: 8, borderWidth: 1.5, borderColor: '#6366f1', backgroundColor: '#fff' },
  saveBtnDisabled: { borderColor: '#c7d2fe' },
  saveBtnText: { color: '#6366f1', fontWeight: '700', fontSize: 14 },
})
