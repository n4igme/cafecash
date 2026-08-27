// PocketBase base record fields (all collections have these)
export interface PBRecord {
  id: string        // 15-char string (PocketBase format)
  collectionId: string
  collectionName: string
  created: string   // ISO datetime
  updated: string
}

export interface Product extends PBRecord {
  name: string
  price: number     // in IDR (e.g. 20000)
  category: string
  image?: string    // PocketBase file field (filename, not URL)
  image_url?: string // legacy URL field
  is_available: boolean
}

export interface CartItem {
  product: Product
  quantity: number
}

export interface Order extends PBRecord {
  total: number
  status: 'pending' | 'paid' | 'cancelled'
  payment_method?: 'qris' | 'cash' | 'split'
  payment_slip?: string   // PocketBase file field
  note?: string
  expand?: {
    order_items_via_order?: OrderItem[]
  }
}

export interface OrderItem extends PBRecord {
  order: string       // relation → orders.id
  product?: string    // relation → products.id (nullable)
  product_name: string
  price: number
  quantity: number
}
