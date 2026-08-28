/**
 * Stock management utilities for the tablet.
 * Called during saveOrder (deduct) and cancelOrder (restore).
 */
import { pb } from './pocketbase'

interface OrderItemLike {
  product: string  // product id
  quantity: number
}

/**
 * Deduct stock for a list of order items.
 * For each item: find recipes → reduce ingredient.stock_qty
 */
export async function deductStock(orderId: string, items: OrderItemLike[]): Promise<void> {
  for (const item of items) {
    const recipes = await pb.collection('recipes').getFullList<{
      id: string; ingredient: string; qty_needed: number
    }>({ filter: `product = '${item.product}'` })

    for (const recipe of recipes) {
      const deduct = recipe.qty_needed * item.quantity
      // Get current stock
      const ingr = await pb.collection('ingredients').getOne<{ id: string; stock_qty: number }>(recipe.ingredient)
      const newQty = Math.max(0, ingr.stock_qty - deduct)
      await pb.collection('ingredients').update(recipe.ingredient, { stock_qty: newQty })
      // Log adjustment
      await pb.collection('stock_adjustments').create({
        ingredient: recipe.ingredient,
        qty_change: -deduct,
        reason: 'order_deduct',
        order: orderId,
        note: `Order deduct x${item.quantity}`,
      })
    }
  }
}

/**
 * Restore stock for a list of order items (cancel or edit old items).
 */
export async function restoreStock(orderId: string, items: OrderItemLike[]): Promise<void> {
  for (const item of items) {
    const recipes = await pb.collection('recipes').getFullList<{
      id: string; ingredient: string; qty_needed: number
    }>({ filter: `product = '${item.product}'` })

    for (const recipe of recipes) {
      const restore = recipe.qty_needed * item.quantity
      const ingr = await pb.collection('ingredients').getOne<{ id: string; stock_qty: number }>(recipe.ingredient)
      await pb.collection('ingredients').update(recipe.ingredient, {
        stock_qty: ingr.stock_qty + restore,
      })
      await pb.collection('stock_adjustments').create({
        ingredient: recipe.ingredient,
        qty_change: restore,
        reason: 'order_restore',
        order: orderId,
        note: `Order restore x${item.quantity}`,
      })
    }
  }
}

/**
 * Get available qty for a product (min cups possible across all ingredients).
 * Returns null if no recipe defined (treat as unlimited).
 */
export async function getProductAvailableQty(productId: string): Promise<number | null> {
  const recipes = await pb.collection('recipes').getFullList<{
    ingredient: string; qty_needed: number
  }>({ filter: `product = '${productId}'` })

  if (recipes.length === 0) return null // no recipe = unlimited

  let minQty = Infinity
  for (const recipe of recipes) {
    const ingr = await pb.collection('ingredients').getOne<{ stock_qty: number }>(recipe.ingredient)
    const possible = recipe.qty_needed > 0 ? Math.floor(ingr.stock_qty / recipe.qty_needed) : Infinity
    minQty = Math.min(minQty, possible)
  }
  return minQty === Infinity ? null : minQty
}
