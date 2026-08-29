'use client'
import { useEffect, useState } from 'react'
import PocketBase from 'pocketbase'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, LineChart, Line,
} from 'recharts'

const API_URL = process.env.NEXT_PUBLIC_API_URL!

const formatRupiah = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

interface Order {
  id: string; total: number; status: string; created: string
  expand?: { order_items_via_order?: OrderItem[] }
}
interface OrderItem { id: string; product_name: string; price: number; quantity: number }
interface Recipe { product: string; ingredient: string; qty_needed: number }
interface Ingredient { id: string; name: string; stock_qty: number; alert_qty: number; unit: string; cost_per_unit: number }
interface Product { id: string; name: string }
type Range = 'today' | 'week' | 'month' | 'year' | 'all'

// Build HPP map: productName → cost per serving (IDR)
function buildHppMap(
  products: Product[],
  recipes: Recipe[],
  ingredients: Ingredient[]
): Record<string, number> {
  const ingrById: Record<string, Ingredient> = {}
  for (const i of ingredients) ingrById[i.id] = i
  const prodById: Record<string, string> = {}
  for (const p of products) prodById[p.id] = p.name

  const map: Record<string, number> = {}
  for (const p of products) {
    const lines = recipes.filter(r => r.product === p.id)
    if (lines.length === 0) continue
    let hpp = 0
    for (const line of lines) {
      const ingr = ingrById[line.ingredient]
      if (ingr) hpp += line.qty_needed * ingr.cost_per_unit
    }
    map[p.name] = hpp
  }
  return map
}

function startOf(range: Range): Date {
  const d = new Date(); d.setHours(0, 0, 0, 0)
  if (range === 'today') return d
  if (range === 'week')  { d.setDate(d.getDate() - 6); return d }
  if (range === 'month') { d.setDate(1); return d }
  if (range === 'year')  { d.setMonth(0, 1); return d }
  return new Date(0) // all
}

function build7DayChart(orders: Order[]) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (6 - i))
    const date = d.toISOString().slice(0, 10)
    const dayOrders = orders.filter(o => o.created?.slice(0, 10) === date)
    return {
      day:     d.toLocaleDateString('en-US', { weekday: 'short' }),
      revenue: dayOrders.reduce((s, o) => s + o.total, 0),
    }
  })
}

function buildMonthlyChart(orders: Order[]) {
  const map: Record<string, number> = {}
  for (const o of orders) {
    if (!o.created) continue
    const key = o.created.slice(0, 7)
    map[key] = (map[key] ?? 0) + o.total
  }
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).slice(-12)
    .map(([month, revenue]) => ({
      month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      revenue,
    }))
}

function buildProductSales(orders: Order[]) {
  const map: Record<string, { qty: number; revenue: number }> = {}
  for (const o of orders)
    for (const item of o.expand?.order_items_via_order ?? []) {
      if (!map[item.product_name]) map[item.product_name] = { qty: 0, revenue: 0 }
      map[item.product_name].qty     += item.quantity
      map[item.product_name].revenue += item.price * item.quantity
    }
  return Object.entries(map).map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
}

const RANGES: { label: string; value: Range }[] = [
  { label: 'Today',      value: 'today' },
  { label: 'This Week',  value: 'week'  },
  { label: 'This Month', value: 'month' },
  { label: 'This Year',  value: 'year'  },
  { label: 'All Time',   value: 'all'   },
]

export default function DashboardClient({ token }: { token: string | null }) {
  const [pb] = useState(() => {
    const client = new PocketBase(API_URL)
    client.autoCancellation(false)
    if (token) client.authStore.save(token, null)
    return client
  })
  const [orders,       setOrders]       = useState<Order[]>([])
  const [productCount, setProductCount] = useState(0)
  const [lowStock,     setLowStock]     = useState<Ingredient[]>([])
  const [loading,      setLoading]      = useState(true)
  const [range,        setRange]        = useState<Range>('today')
  const [hppMap,       setHppMap]       = useState<Record<string, number>>({})

  useEffect(() => {
    Promise.all([
      pb.collection('orders').getFullList<Order>({
        filter: "status = 'paid'", sort: '-id', expand: 'order_items_via_order',
      }),
      pb.collection('products').getFullList<Product>({ fields: 'id,name' }),
      pb.collection('ingredients').getFullList<Ingredient>({ filter: 'alert_qty > 0' }),
      pb.collection('recipes').getFullList<Recipe>({ fields: 'product,ingredient,qty_needed' }),
      pb.collection('ingredients').getFullList<Ingredient>({ fields: 'id,name,stock_qty,alert_qty,unit,cost_per_unit' }),
    ]).then(([ords, prods, ingrAlert, recipes, allIngrs]) => {
      setOrders(ords)
      setProductCount(prods.length)
      setLowStock(ingrAlert.filter(i => i.stock_qty <= i.alert_qty))
      setHppMap(buildHppMap(prods, recipes, allIngrs))
      setLoading(false)
    })
  }, [])

  const from = startOf(range)
  const filtered = orders.filter(o => {
    if (range === 'all') return true
    if (!o.created) return false
    return new Date(o.created) >= from
  })

  const omset    = filtered.reduce((s, o) => s + o.total, 0)
  const ordCount = filtered.length
  const avgOrder = ordCount > 0 ? omset / ordCount : 0

  // HPP calculation for filtered period
  const totalHpp = filtered.reduce((s, o) => {
    for (const item of o.expand?.order_items_via_order ?? []) {
      const hpp = hppMap[item.product_name] ?? 0
      s += hpp * item.quantity
    }
    return s
  }, 0)
  const grossProfit = omset - totalHpp
  const margin = omset > 0 ? (grossProfit / omset) * 100 : 0

  const chart7Day    = build7DayChart(orders)
  const chartMonthly = buildMonthlyChart(orders)
  const productSales = buildProductSales(filtered)

  if (loading) return <div className="p-8 text-slate-400 text-center py-20">Loading...</div>

  return (
    <div className="p-8 space-y-6">

      {/* ── Header + period filter ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0 sm:justify-between">
        <h2 className="text-2xl font-bold text-slate-800">Dashboard</h2>
        <div className="flex flex-wrap gap-2">
          {RANGES.map(r => (
            <button key={r.value} onClick={() => setRange(r.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                range === r.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Low stock alert */}
      {lowStock.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <span className="text-amber-500 text-xl mt-0.5">⚠️</span>
          <div className="flex-1">
            <p className="text-amber-700 text-sm font-semibold">{lowStock.length} ingredient(s) running low</p>
            <div className="flex flex-wrap gap-2 mt-1">
              {lowStock.map(i => (
                <span key={i.id} className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  i.stock_qty <= 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {i.name}: {i.stock_qty} {i.unit} {i.stock_qty <= 0 ? '🔴' : '🟡'}
                </span>
              ))}
            </div>
            <a href="/ingredients" className="text-xs text-amber-600 hover:text-amber-800 font-medium mt-1 inline-block">
              → Go to Ingredients
            </a>
          </div>
        </div>
      )}

      {/* ── 4 stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Revenue',        value: formatRupiah(omset),        icon: '💰' },
          { label: 'Orders',         value: ordCount,                   icon: '📋' },
          { label: 'Avg Order Value',value: formatRupiah(avgOrder),     icon: '🧾' },
          { label: 'Total Products', value: productCount,               icon: '🛍️' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
            <div className="text-2xl mb-2">{s.icon}</div>
            <div className="text-2xl font-bold text-slate-800">{s.value}</div>
            <div className="text-sm text-slate-400 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── HPP / Margin cards ── */}
      {omset > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
            <div className="text-2xl mb-2">🏭</div>
            <div className="text-2xl font-bold text-red-500">{formatRupiah(totalHpp)}</div>
            <div className="text-sm text-slate-400 mt-1">Total HPP (Biaya Bahan)</div>
          </div>
          <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
            <div className="text-2xl mb-2">📈</div>
            <div className="text-2xl font-bold text-green-600">{formatRupiah(grossProfit)}</div>
            <div className="text-sm text-slate-400 mt-1">Laba Kotor</div>
          </div>
          <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
            <div className="text-2xl mb-2">💹</div>
            <div className={`text-2xl font-bold ${margin >= 60 ? 'text-green-600' : margin >= 40 ? 'text-amber-500' : 'text-red-500'}`}>
              {margin.toFixed(1)}%
            </div>
            <div className="text-sm text-slate-400 mt-1">Margin Kotor</div>
          </div>
        </div>
      )}

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* 7-day bar chart */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">Last 7 Days</h3>
            <span className="text-xs text-slate-400">paid orders</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chart7Day} margin={{ top: 4, right: 4, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={36} />
              <Tooltip formatter={(v: number) => [formatRupiah(v), 'Revenue']}
                contentStyle={{ border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 12-month line chart */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">Monthly Revenue Trend</h3>
            <span className="text-xs text-slate-400">Last 12 months</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartMonthly} margin={{ top: 4, right: 4, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={36} />
              <Tooltip formatter={(v: number) => [formatRupiah(v), 'Revenue']}
                contentStyle={{ border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Product sales + top products ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Sales table */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">Sales by Product</h3>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-50 bg-slate-50">
                <th className="text-left px-6 py-3 text-slate-500 font-medium">#</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Product</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Qty</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Revenue</th>
                <th className="hidden sm:table-cell text-left px-6 py-3 text-slate-500 font-medium">HPP</th>
                <th className="hidden sm:table-cell text-left px-6 py-3 text-slate-500 font-medium">Margin</th>
              </tr>
            </thead>
            <tbody>
              {productSales.map((p, i) => {
                const hpp     = (hppMap[p.name] ?? 0) * p.qty
                const margin_ = p.revenue > 0 ? ((p.revenue - hpp) / p.revenue) * 100 : 0
                return (
                  <tr key={p.name} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-6 py-3 text-slate-400 text-xs">{i + 1}</td>
                    <td className="px-6 py-3 font-medium text-slate-800">{p.name}</td>
                    <td className="px-6 py-3 text-slate-500">{p.qty}</td>
                    <td className="px-6 py-3 font-semibold text-indigo-600 whitespace-nowrap">{formatRupiah(p.revenue)}</td>
                    <td className="hidden sm:table-cell px-6 py-3 text-red-400 text-xs whitespace-nowrap">{hpp > 0 ? formatRupiah(hpp) : '—'}</td>
                    <td className="hidden sm:table-cell px-6 py-3 text-xs font-semibold">
                      {hpp > 0 ? (
                        <span className={margin_ >= 60 ? 'text-green-600' : margin_ >= 40 ? 'text-amber-500' : 'text-red-500'}>
                          {margin_.toFixed(0)}%
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
          {productSales.length === 0 && (
            <div className="px-6 py-10 text-center text-slate-400 text-sm">No data for this period</div>
          )}
        </div>

        {/* Top products bar */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
          <h3 className="font-semibold text-slate-800 mb-4">Top Products</h3>
          {productSales.length === 0 ? (
            <div className="text-slate-400 text-sm text-center py-10">No data for this period</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={productSales.slice(0, 6)} layout="vertical"
                margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tickFormatter={v => `${(v/1000).toFixed(0)}k`}
                  tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }}
                  axisLine={false} tickLine={false} width={90} />
                <Tooltip formatter={(v: number) => [formatRupiah(v), 'Revenue']}
                  contentStyle={{ border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="revenue" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Recent orders ── */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Recent Orders</h3>
          <a href="/orders" className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">View all →</a>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left px-6 py-3 text-slate-400 font-medium">Order ID</th>
              <th className="text-left px-6 py-3 text-slate-400 font-medium">Items</th>
              <th className="text-left px-6 py-3 text-slate-400 font-medium">Total</th>
              <th className="hidden sm:table-cell text-left px-6 py-3 text-slate-400 font-medium">Time</th>
              <th className="text-left px-6 py-3 text-slate-400 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.slice(0, 8).map(o => {
              const items = o.expand?.order_items_via_order ?? []
              return (
                <tr key={o.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-6 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">{o.id.slice(0, 8)}…</td>
                  <td className="px-6 py-3 text-slate-700 whitespace-nowrap">{items.length} items</td>
                  <td className="px-6 py-3 font-semibold text-indigo-600 whitespace-nowrap">{formatRupiah(o.total)}</td>
                  <td className="hidden sm:table-cell px-6 py-3 text-slate-500 text-xs whitespace-nowrap">
                    {o.created ? new Date(o.created).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                  <td className="px-6 py-3">
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 whitespace-nowrap">
                      {o.status}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
        {orders.length === 0 && (
          <div className="px-6 py-12 text-center text-slate-400">No orders yet</div>
        )}
      </div>
    </div>
  )
}
