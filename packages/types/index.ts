// PocketBase base record fields (all collections have these)
export interface PBRecord {
  id: string        // 15-char string (PocketBase format)
  created: string   // ISO datetime (was created_at in Supabase)
  updated: string
}

export interface Product extends PBRecord {
  name: string
  price: number     // in IDR (e.g. 20000)
  category: string
  image_url?: string
  is_available: boolean
}

export interface CartItem {
  product: Product
  quantity: number
}

export interface Order extends PBRecord {
  total: number
  status: 'pending' | 'paid' | 'cancelled'
  note?: string
  // populated when fetched with expand: 'order_items_via_order'
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
