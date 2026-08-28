'use client'
import { useEffect, useState } from 'react'
import PocketBase from 'pocketbase'
import type { Ingredient, StockPurchase } from '../../../../packages/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL!

const formatRupiah = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

export default function StockInClient({ token }: { token: string | null }) {
  const [pb] = useState(() => {
    const c = new PocketBase(API_URL); c.autoCancellation(false)
    if (token) c.authStore.save(token, null); return c
  })
  const [purchases,   setPurchases]   = useState<StockPurchase[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [form,        setForm]        = useState({ ingredient: '', qty: '', price_total: '', note: '' })

  const load = async () => {
    setLoading(true)
    const [p, i] = await Promise.all([
      pb.collection('stock_purchases').getFullList<StockPurchase>({
        sort: '-created', expand: 'ingredient', batch: 50,
      }),
      pb.collection('ingredients').getFullList<Ingredient>({ sort: 'name' }),
    ])
    setPurchases(p); setIngredients(i)
    if (i.length > 0 && !form.ingredient) setForm(f => ({ ...f, ingredient: i[0].id }))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    if (!form.ingredient || !form.qty) return
    setSaving(true)
    try {
      const qty = Number(form.qty)
      // Update ingredient stock
      const ingr = await pb.collection('ingredients').getOne<Ingredient>(form.ingredient)
      await pb.collection('ingredients').update(form.ingredient, { stock_qty: ingr.stock_qty + qty })
      // Record purchase
      await pb.collection('stock_purchases').create({
        ingredient: form.ingredient, qty,
        price_total: Number(form.price_total) || 0,
        note: form.note,
      })
      // Record adjustment log
      await pb.collection('stock_adjustments').create({
        ingredient: form.ingredient, qty_change: qty,
        reason: 'purchase', note: form.note || `Stock in: ${qty} ${ingr.unit}`,
      })
      setForm(f => ({ ...f, qty: '', price_total: '', note: '' }))
      load()
    } finally {
      setSaving(false)
    }
  }

  const ingrName = (id: string) => ingredients.find(i => i.id === id)?.name ?? id
  const ingrUnit = (id: string) => ingredients.find(i => i.id === id)?.unit ?? ''

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Stock In</h2>
        <p className="text-sm text-slate-400 mt-1">Record ingredient purchases — stock updates automatically</p>
      </div>

      {/* Quick add form */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 mb-8">
        <h3 className="font-semibold text-slate-700 mb-4">Record Purchase</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Ingredient</label>
            <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={form.ingredient} onChange={e => setForm(f => ({ ...f, ingredient: e.target.value }))}>
              {ingredients.map(i => <option key={i.id} value={i.id}>{i.name} (current: {i.stock_qty} {i.unit})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Qty ({ingrUnit(form.ingredient)})
            </label>
            <input type="number" placeholder="e.g. 5000"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={form.qty} onChange={e => setForm(f => ({ ...f, qty: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Total Price (IDR)</label>
            <input type="number" placeholder="e.g. 25000"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={form.price_total} onChange={e => setForm(f => ({ ...f, price_total: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Note (optional)</label>
            <input type="text" placeholder="e.g. Beli di Alfamart"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
          </div>
        </div>
        <button onClick={save} disabled={saving || !form.ingredient || !form.qty}
          className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60">
          {saving ? 'Saving...' : '+ Record Stock In'}
        </button>
      </div>

      {/* Purchase history */}
      <h3 className="font-semibold text-slate-700 mb-3">Recent Purchases</h3>
      {loading ? <div className="text-slate-400 text-center py-10">Loading...</div> : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Date</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Ingredient</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Qty</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Total Price</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Note</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map(p => (
                <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-6 py-3 text-slate-500 text-xs">
                    {p.created ? new Date(p.created).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                  <td className="px-6 py-3 font-medium text-slate-800">{ingrName(p.ingredient)}</td>
                  <td className="px-6 py-3 text-slate-600">+{p.qty} {ingrUnit(p.ingredient)}</td>
                  <td className="px-6 py-3 text-slate-600">{p.price_total > 0 ? formatRupiah(p.price_total) : '—'}</td>
                  <td className="px-6 py-3 text-slate-400 text-xs">{p.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {purchases.length === 0 && <div className="px-6 py-12 text-center text-slate-400">No purchases recorded yet</div>}
        </div>
      )}
    </div>
  )
}
