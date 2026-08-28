// PocketBase base record fields (all collections have these)
export interface PBRecord {
  id: string
  collectionId: string
  collectionName: string
  created: string
  updated: string
}

export interface Product extends PBRecord {
  name: string
  price: number
  category: string
  image?: string
  image_url?: string
  is_available: boolean
}

export interface CartItem {
  product: Product
  quantity: number
}

export interface Order extends PBRecord {
  total: number
  status: 'open' | 'paid' | 'cancelled' | 'refunded'
  customer_name?: string
  payment_method?: 'qris' | 'cash' | 'split'
  payment_slip?: string
  note?: string
  refund_reason?: string
  expand?: {
    order_items_via_order?: OrderItem[]
  }
}

export interface OrderItem extends PBRecord {
  order: string
  product?: string
  product_name: string
  price: number
  quantity: number
}

// ── Stock management ──────────────────────────────────────────────────────────

export interface Ingredient extends PBRecord {
  name: string
  unit: 'ml' | 'gram' | 'pcs'
  stock_qty: number
  alert_qty: number
  cost_per_unit: number
}

export interface Recipe extends PBRecord {
  product: string            // relation → products.id
  ingredient: string         // relation → ingredients.id
  qty_needed: number         // quantity per 1 unit of product
  expand?: {
    product?: Product
    ingredient?: Ingredient
  }
}

export interface StockPurchase extends PBRecord {
  ingredient: string         // relation → ingredients.id
  qty: number
  price_total: number
  note?: string
  expand?: { ingredient?: Ingredient }
}

export interface StockAdjustment extends PBRecord {
  ingredient: string
  qty_change: number         // positive = add, negative = deduct
  reason: 'purchase' | 'waste' | 'correction' | 'spoilage' | 'order_deduct' | 'order_restore'
  note?: string
  order?: string             // optional relation to orders
  expand?: { ingredient?: Ingredient }
}
