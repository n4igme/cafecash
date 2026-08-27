'use client'
import { useEffect, useState } from 'react'
import PocketBase from 'pocketbase'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, LineChart, Line,
} from 'recharts'

const API_URL = process.env.NEXT_PUBLIC_API_URL!

const formatRupiah = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

interface Order {
  id: string
  total: number
  status: string
  created: string
  expand?: { order_items_via_order?: OrderItem[] }
}
interface OrderItem {
  id: string
  product_name: string
  price: number
  quantity: number
}

type Range = 'week' | 'month' | 'year' | 'all'

function startOf(range: Range): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  if (range === 'week')  { d.setDate(d.getDate() - 6) }
  if (range === 'month') { d.setDate(1) }
  if (range === 'year')  { d.setMonth(0, 1) }
  if (range === 'all')   { return new Date(0) }
  return d
}

function buildMonthlyChart(orders: Order[]) {
  const map: Record<string, number> = {}
  for (const o of orders) {
    if (!o.created) continue
    const key = o.created.slice(0, 7) // YYYY-MM
    map[key] = (map[key] ?? 0) + o.total
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, revenue]) => ({
      month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      revenue,
    }))
}

function buildProductSales(orders: Order[]) {
  const map: Record<string, { qty: number; revenue: number }> = {}
  for (const o of orders) {
    for (const item of o.expand?.order_items_via_order ?? []) {
      if (!map[item.product_name]) map[item.product_name] = { qty: 0, revenue: 0 }
      map[item.product_name].qty     += item.quantity
      map[item.product_name].revenue += item.price * item.quantity
    }
  }
  return Object.entries(map)
    .map(([name, { qty, revenue }]) => ({ name, qty, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
}

export default function ReportsClient({ token }: { token: string | null }) {
  const [pb] = useState(() => {
    const client = new PocketBase(API_URL)
    client.autoCancellation(false)
    if (token) client.authStore.save(token, null)
    return client
  })
  const [orders,  setOrders]  = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [range,   setRange]   = useState<Range>('month')

  useEffect(() => {
    setLoading(true)
    pb.collection('orders').getFullList<Order>({
      filter: "status = 'paid'",
      sort:   '-id',
      expand: 'order_items_via_order',
    }).then(data => { setOrders(data); setLoading(false) })
  }, [])

  const from = startOf(range)
  const filtered = orders.filter(o => {
    if (range === 'all') return true          // all time: include everything
    if (!o.created) return false              // no timestamp: exclude from period filters
    return new Date(o.created) >= from
  })

  const omset      = filtered.reduce((s, o) => s + o.total, 0)
  const orderCount = filtered.length
  const avgOrder   = orderCount > 0 ? omset / orderCount : 0

  const monthlyChart  = buildMonthlyChart(orders)      // always all-time
  const productSales  = buildProductSales(filtered)

  const RANGES: { label: string; value: Range }[] = [
    { label: 'This Week',  value: 'week'  },
    { label: 'This Month', value: 'month' },
    { label: 'This Year',  value: 'year'  },
    { label: 'All Time',   value: 'all'   },
  ]

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Reports</h2>
        <div className="flex gap-2">
          {RANGES.map(r => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                range === r.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-slate-400 text-center py-20">Loading...</div>
      ) : (
        <>
          {/* Omset summary cards */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
              <div className="text-2xl mb-2">💰</div>
              <div className="text-2xl font-bold text-slate-800">{formatRupiah(omset)}</div>
              <div className="text-sm text-slate-400 mt-1">Omset</div>
            </div>
            <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
              <div className="text-2xl mb-2">📋</div>
              <div className="text-2xl font-bold text-slate-800">{orderCount}</div>
              <div className="text-sm text-slate-400 mt-1">Orders</div>
            </div>
            <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
              <div className="text-2xl mb-2">🧾</div>
              <div className="text-2xl font-bold text-slate-800">{formatRupiah(avgOrder)}</div>
              <div className="text-sm text-slate-400 mt-1">Avg Order Value</div>
            </div>
          </div>

          {/* Monthly revenue trend */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">Monthly Revenue Trend</h3>
              <span className="text-xs text-slate-400">Last 12 months · paid orders</span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={monthlyChart} margin={{ top: 4, right: 4, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis
                  tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false} tickLine={false} width={40}
                />
                <Tooltip
                  formatter={(v: number) => [formatRupiah(v), 'Revenue']}
                  contentStyle={{ border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }}
                />
                <Line type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Product sales table + chart */}
          <div className="grid grid-cols-2 gap-6">

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="font-semibold text-slate-800">Sales by Product</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-50 bg-slate-50">
                    <th className="text-left px-6 py-3 text-slate-500 font-medium">#</th>
                    <th className="text-left px-6 py-3 text-slate-500 font-medium">Product</th>
                    <th className="text-left px-6 py-3 text-slate-500 font-medium">Qty</th>
                    <th className="text-left px-6 py-3 text-slate-500 font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {productSales.map((p, i) => (
                    <tr key={p.name} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-6 py-3 text-slate-400 text-xs">{i + 1}</td>
                      <td className="px-6 py-3 font-medium text-slate-800">{p.name}</td>
                      <td className="px-6 py-3 text-slate-500">{p.qty}</td>
                      <td className="px-6 py-3 font-semibold text-indigo-600">{formatRupiah(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {productSales.length === 0 && (
                <div className="px-6 py-12 text-center text-slate-400">No data for this period</div>
              )}
            </div>

            {/* Bar chart top products */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
              <h3 className="font-semibold text-slate-800 mb-4">Top Products by Revenue</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={productSales.slice(0, 8)}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis
                    type="number"
                    tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis
                    type="category" dataKey="name"
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    axisLine={false} tickLine={false} width={90}
                  />
                  <Tooltip
                    formatter={(v: number) => [formatRupiah(v), 'Revenue']}
                    contentStyle={{ border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="revenue" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
