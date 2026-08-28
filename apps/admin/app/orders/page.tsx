export const dynamic = 'force-dynamic'
import { cookies } from 'next/headers'
import { getServerPB } from '../../lib/pocketbase'
import type { Order, OrderItem } from '../../../../packages/types'
import CancelOrderButton from '../components/CancelOrderButton'
import RefundOrderButton from '../components/RefundOrderButton'

const API_URL = process.env.NEXT_PUBLIC_API_URL!

const formatRupiah = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  open:      { label: 'Open',      color: 'bg-blue-100 text-blue-700' },
  paid:      { label: 'Paid',      color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', color: 'bg-slate-100 text-slate-500' },
  refunded:  { label: 'Refunded',  color: 'bg-red-100 text-red-600' },
}

const METHOD_BADGE: Record<string, { label: string; color: string }> = {
  qris:  { label: 'QRIS',  color: 'bg-blue-100 text-blue-700' },
  cash:  { label: 'Cash',  color: 'bg-amber-100 text-amber-700' },
  split: { label: 'Split', color: 'bg-purple-100 text-purple-700' },
}

export default async function OrdersPage() {
  const pb = await getServerPB()
  const cookieStore = await cookies()
  const token = cookieStore.get('pb_auth')?.value ?? null

  const orders = await pb.collection('orders').getFullList<Order>({
    sort:   '-id',
    expand: 'order_items_via_order',
    batch:  200,
  })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Orders</h2>
        <div className="flex gap-2 text-xs text-slate-500">
          {Object.entries(STATUS_BADGE).map(([k, v]) => (
            <span key={k} className={`px-2 py-1 rounded-full font-medium ${v.color}`}>{v.label}</span>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Order</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Customer</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Items</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Total</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Payment</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Slip</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Note</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Date</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(o => {
              const orderItems: OrderItem[] = (o.expand as any)?.['order_items_via_order'] ?? []
              const statusBadge = STATUS_BADGE[o.status] ?? STATUS_BADGE['open']
              const methodBadge = o.payment_method ? METHOD_BADGE[o.payment_method] : null
              const slipUrl = o.payment_slip
                ? `${API_URL}/api/files/${o.collectionId}/${o.id}/${o.payment_slip}`
                : null

              return (
                <tr key={o.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{o.id.slice(0, 8)}…</td>
                  <td className="px-4 py-3 font-medium text-slate-700">
                    {o.customer_name || <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    <div className="flex flex-col gap-0.5">
                      {orderItems.length > 0 ? orderItems.map(item => (
                        <span key={item.id} className="text-xs text-slate-500">
                          {item.quantity}× {item.product_name}
                        </span>
                      )) : <span className="text-slate-300 text-xs">No items</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-indigo-600">
                    {o.total > 0 ? formatRupiah(o.total) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {methodBadge ? (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${methodBadge.color}`}>
                        {methodBadge.label}
                      </span>
                    ) : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {slipUrl ? (
                      <a href={slipUrl} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={slipUrl} alt="slip"
                          className="w-12 h-12 object-cover rounded-lg border border-slate-200 hover:opacity-80 transition-opacity cursor-pointer" />
                      </a>
                    ) : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs max-w-[100px] truncate">
                    {o.note || o.refund_reason || '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {o.created ? new Date(o.created).toLocaleString('id-ID', {
                      day: '2-digit', month: 'short',
                      hour: '2-digit', minute: '2-digit',
                    }) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium text-center ${statusBadge.color}`}>
                        {statusBadge.label}
                      </span>
                      {o.status === 'open' && (
                        <CancelOrderButton orderId={o.id} status={o.status} token={token} />
                      )}
                      {o.status === 'paid' && (
                        <RefundOrderButton orderId={o.id} token={token} />
                      )}
                    </div>
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
