'use client'
import { useEffect, useState, useMemo } from 'react'
import PocketBase from 'pocketbase'
import type { Order, OrderItem } from '../../../../packages/types'
import CancelOrderButton from '../components/CancelOrderButton'
import RefundOrderButton from '../components/RefundOrderButton'
import { useT } from '../components/LangProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL!

const formatRupiah = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

type SortKey = 'created' | 'total' | 'customer_name' | 'status'
type SortDir = 'desc' | 'asc'

export default function OrdersClient({ token }: { token: string | null }) {
  const t = useT()
  const [pb] = useState(() => {
    const client = new PocketBase(API_URL)
    client.autoCancellation(false)
    if (token) client.authStore.save(token, null)
    return client
  })

  const [orders,       setOrders]       = useState<Order[]>([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortKey,      setSortKey]      = useState<SortKey>('created')
  const [sortDir,      setSortDir]      = useState<SortDir>('desc')

  useEffect(() => {
    setLoading(true)
    pb.collection('orders').getFullList<Order>({
      sort: '-created', expand: 'order_items_via_order', batch: 500,
    }).then(data => { setOrders(data); setLoading(false) })
  }, [])

  const STATUS_BADGE = useMemo(() => ({
    open:      { label: t('orders.open'),      color: 'bg-blue-100 text-blue-700' },
    paid:      { label: t('orders.paid'),      color: 'bg-green-100 text-green-700' },
    cancelled: { label: t('orders.cancelled'), color: 'bg-slate-100 text-slate-500' },
    refunded:  { label: t('orders.refunded'),  color: 'bg-red-100 text-red-600' },
  }), [t])

  const METHOD_BADGE: Record<string, { label: string; color: string }> = {
    qris:  { label: 'QRIS',  color: 'bg-blue-100 text-blue-700' },
    cash:  { label: 'Cash',  color: 'bg-amber-100 text-amber-700' },
    split: { label: 'Split', color: 'bg-purple-100 text-purple-700' },
  }

  const filtered = useMemo(() => {
    let list = [...orders]
    if (statusFilter !== 'all') list = list.filter(o => o.status === statusFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(o => {
        const inName  = (o.customer_name ?? '').toLowerCase().includes(q)
        const inId    = o.id.toLowerCase().includes(q)
        const inItems = ((o.expand as any)?.order_items_via_order ?? [])
          .some((i: OrderItem) => i.product_name.toLowerCase().includes(q))
        return inName || inId || inItems
      })
    }
    list.sort((a, b) => {
      let va: any, vb: any
      if (sortKey === 'created')       { va = a.created ?? ''; vb = b.created ?? '' }
      else if (sortKey === 'total')    { va = a.total ?? 0;    vb = b.total ?? 0 }
      else if (sortKey === 'customer_name') { va = a.customer_name ?? ''; vb = b.customer_name ?? '' }
      else if (sortKey === 'status')   { va = a.status ?? '';  vb = b.status ?? '' }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return list
  }, [orders, search, statusFilter, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <span className="text-slate-300 ml-1">↕</span>
    return <span className="text-indigo-500 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const STATUS_COUNTS = useMemo(() => {
    const c: Record<string, number> = { all: orders.length }
    orders.forEach(o => { c[o.status] = (c[o.status] ?? 0) + 1 })
    return c
  }, [orders])

  const statusLabel = (s: string) => {
    if (s === 'all') return t('common.all')
    return STATUS_BADGE[s as keyof typeof STATUS_BADGE]?.label ?? s
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">{t('orders.title')}</h2>
        <span className="text-sm text-slate-400">{filtered.length} {t('orders.of')} {orders.length} {t('orders.title').toLowerCase()}</span>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
          <input
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder={t('orders.search')}
            value={search} onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">✕</button>
          )}
        </div>
        <div className="flex gap-1">
          {['all', 'open', 'paid', 'cancelled', 'refunded'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === s ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}>
              {statusLabel(s)}
              {STATUS_COUNTS[s] !== undefined && (
                <span className={`ml-1 ${statusFilter === s ? 'text-indigo-200' : 'text-slate-400'}`}>
                  ({STATUS_COUNTS[s] ?? 0})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-slate-400 text-center py-20">{t('common.loading')}</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Order</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium cursor-pointer hover:text-slate-700"
                  onClick={() => toggleSort('customer_name')}>
                  {t('orders.customer')} <SortIcon k="customer_name" />
                </th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">{t('orders.items')}</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium cursor-pointer hover:text-slate-700"
                  onClick={() => toggleSort('total')}>
                  {t('common.total')} <SortIcon k="total" />
                </th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">{t('orders.payment')}</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">{t('orders.slip')}</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">{t('common.note')}</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium cursor-pointer hover:text-slate-700"
                  onClick={() => toggleSort('created')}>
                  {t('common.date')} <SortIcon k="created" />
                </th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium cursor-pointer hover:text-slate-700"
                  onClick={() => toggleSort('status')}>
                  {t('common.status')} <SortIcon k="status" />
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => {
                const orderItems: OrderItem[] = (o.expand as any)?.['order_items_via_order'] ?? []
                const statusBadge = STATUS_BADGE[o.status as keyof typeof STATUS_BADGE] ?? STATUS_BADGE['open']
                const methodBadge = o.payment_method ? METHOD_BADGE[o.payment_method] : null
                const slipUrl = o.payment_slip
                  ? `${API_URL}/api/files/${o.collectionId}/${o.id}/${o.payment_slip}` : null
                return (
                  <tr key={o.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{o.id.slice(0, 8)}…</td>
                    <td className="px-4 py-3 font-medium text-slate-700">
                      {o.customer_name || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <div className="flex flex-col gap-0.5">
                        {orderItems.length > 0 ? orderItems.map(item => (
                          <span key={item.id} className="text-xs text-slate-500">{item.quantity}× {item.product_name}</span>
                        )) : <span className="text-slate-300 text-xs">{t('orders.no_items')}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-indigo-600">
                      {o.total > 0 ? formatRupiah(o.total) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {methodBadge
                        ? <span className={`px-2 py-1 rounded-full text-xs font-medium ${methodBadge.color}`}>{methodBadge.label}</span>
                        : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {slipUrl
                        ? <a href={slipUrl} target="_blank" rel="noopener noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={slipUrl} alt="slip"
                              className="w-12 h-12 object-cover rounded-lg border border-slate-200 hover:opacity-80 transition-opacity cursor-pointer" />
                          </a>
                        : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs max-w-[100px] truncate">
                      {o.note || o.refund_reason || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {o.created ? new Date(o.created).toLocaleString('id-ID', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                      }) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium text-center ${statusBadge.color}`}>
                          {statusBadge.label}
                        </span>
                        {o.status === 'open' && <CancelOrderButton orderId={o.id} status={o.status} token={token} />}
                        {o.status === 'paid' && <RefundOrderButton orderId={o.id} token={token} />}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="px-6 py-12 text-center text-slate-400">
              {search || statusFilter !== 'all' ? t('orders.no_match') : t('common.no_data')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

