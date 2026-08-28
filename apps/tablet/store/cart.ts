import { create } from 'zustand'
import type { Product, CartItem } from '../../../packages/types'

interface CartStore {
  // Active order context
  orderId:      string | null
  customerName: string

  // Cart items
  items: CartItem[]

  // Order actions
  setOrder:     (id: string, name: string) => void
  clearOrder:   () => void

  // Cart actions
  add:       (product: Product) => void
  remove:    (productId: string) => void
  increment: (productId: string) => void
  decrement: (productId: string) => void
  clear:     () => void
  total:     () => number
}

export const useCart = create<CartStore>((set, get) => ({
  orderId:      null,
  customerName: '',
  items:        [],

  setOrder: (id, name) => set({ orderId: id, customerName: name }),

  clearOrder: () => set({ orderId: null, customerName: '', items: [] }),

  add: (product) => {
    const existing = get().items.find(i => i.product.id === product.id)
    if (existing) {
      set(s => ({ items: s.items.map(i =>
        i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
      )}))
    } else {
      set(s => ({ items: [...s.items, { product, quantity: 1 }] }))
    }
  },

  remove: (productId) =>
    set(s => ({ items: s.items.filter(i => i.product.id !== productId) })),

  increment: (productId) =>
    set(s => ({ items: s.items.map(i =>
      i.product.id === productId ? { ...i, quantity: i.quantity + 1 } : i
    )})),

  decrement: (productId) =>
    set(s => ({ items: s.items
      .map(i => i.product.id === productId ? { ...i, quantity: i.quantity - 1 } : i)
      .filter(i => i.quantity > 0)
    })),

  clear: () => set({ items: [] }),

  total: () => get().items.reduce((sum, i) => sum + i.product.price * i.quantity, 0),
}))
