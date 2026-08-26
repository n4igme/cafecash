export const dynamic = 'force-dynamic'
import { getServerPB } from '../lib/pocketbase'
import type { Product, Order, OrderItem } from '../../../packages/types'

const formatRupiah = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

export default async function DashboardPage() {
  const pb = await getServerPB()

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayISO = today.toISOString().replace('T', ' ')

  const [ordersRes, productsRes] = await Promise.all([
    pb.collection('orders').getFullList<Order>({
      filter:  `status = 'paid'`,
      sort:    '-id',
      expand: 'order_items(order)',
    }),
    pb.collection('products').getFullList<Product>(),
  ])

  const todayOrders  = ordersRes.filter(o => o.created >= todayISO)
  const todayRevenue = todayOrders.reduce((s, o) => s + o.total, 0)
  const totalRevenue = ordersRes.reduce((s, o) => s + o.total, 0)

  const stats = [
    { label: "Today's Revenue", value: formatRupiah(todayRevenue), icon: '💰' },
    { label: "Today's Orders",  value: todayOrders.length,         icon: '📋' },
    { label: 'Total Revenue',   value: formatRupiah(totalRevenue), icon: '📈' },
    { label: 'Total Products',  value: productsRes.length,         icon: '🛍️' },
  ]

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Dashboard</h2>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
            <div className="text-2xl mb-2">{s.icon}</div>
            <div className="text-2xl font-bold text-slate-800">{s.value}</div>
            <div className="text-sm text-slate-400 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Recent Orders</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left px-6 py-3 text-slate-400 font-medium">Order ID</th>
              <th className="text-left px-6 py-3 text-slate-400 font-medium">Items</th>
              <th className="text-left px-6 py-3 text-slate-400 font-medium">Total</th>
              <th className="text-left px-6 py-3 text-slate-400 font-medium">Time</th>
              <th className="text-left px-6 py-3 text-slate-400 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {ordersRes.slice(0, 10).map(o => {
              const orderItems: OrderItem[] = (o.expand as any)?.['order_items(order)'] ?? []
              return (
                <tr key={o.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-6 py-3 font-mono text-xs text-slate-500">{o.id.slice(0, 8)}…</td>
                  <td className="px-6 py-3 text-slate-700">{orderItems.length} items</td>
                  <td className="px-6 py-3 font-semibold text-indigo-600">{formatRupiah(o.total)}</td>
                  <td className="px-6 py-3 text-slate-500">
                    {new Date(o.created).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-6 py-3">
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      {o.status}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {ordersRes.length === 0 && (
          <div className="px-6 py-12 text-center text-slate-400">No orders yet</div>
        )}
      </div>
    </div>
  )
}
