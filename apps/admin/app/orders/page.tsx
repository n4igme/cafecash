export const dynamic = 'force-dynamic'
import { getServerPB } from '../../lib/pocketbase'
import type { Order, OrderItem } from '../../../../packages/types'

const formatRupiah = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

export default async function OrdersPage() {
  const pb = await getServerPB()

  const orders = await pb.collection('orders').getFullList<Order>({
    sort:   '-id',
    expand: 'order_items(order)',
    batch:  100,
  })

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Orders</h2>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-6 py-3 text-slate-500 font-medium">Order</th>
              <th className="text-left px-6 py-3 text-slate-500 font-medium">Items</th>
              <th className="text-left px-6 py-3 text-slate-500 font-medium">Total</th>
              <th className="text-left px-6 py-3 text-slate-500 font-medium">Status</th>
              <th className="text-left px-6 py-3 text-slate-500 font-medium">Date & Time</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(o => {
              const orderItems: OrderItem[] = (o.expand as any)?.['order_items(order)'] ?? []
              return (
                <tr key={o.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-6 py-3 font-mono text-xs text-slate-500">{o.id.slice(0, 8)}…</td>
                  <td className="px-6 py-3 text-slate-700">
                    <div className="flex flex-col gap-0.5">
                      {orderItems.map(item => (
                        <span key={item.id} className="text-xs text-slate-500">
                          {item.quantity}× {item.product_name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-3 font-semibold text-indigo-600">{formatRupiah(o.total)}</td>
                  <td className="px-6 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      o.status === 'paid'
                        ? 'bg-green-100 text-green-700'
                        : o.status === 'cancelled'
                        ? 'bg-red-100 text-red-600'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-slate-500 text-xs">
                    {new Date(o.created).toLocaleString('id-ID', {
                      day: '2-digit', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {orders.length === 0 && (
          <div className="px-6 py-12 text-center text-slate-400">No orders yet</div>
        )}
      </div>
    </div>
  )
}
