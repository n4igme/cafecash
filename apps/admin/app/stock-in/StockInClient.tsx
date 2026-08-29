'use client'
import { useEffect, useState } from 'react'
import PocketBase from 'pocketbase'
import type { Ingredient, StockPurchase } from '../../../../packages/types'
import { useT } from '../components/LangProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL!

const formatRupiah = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

export default function StockInClient({ token }: { token: string | null }) {
  const t = useT()
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
      pb.collection('stock_purchases').getFullList<StockPurchase>({ sort: '-created', expand: 'ingredient', batch: 50 }),
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
      const ingr = await pb.collection('ingredients').getOne<Ingredient>(form.ingredient)
      await pb.collection('ingredients').update(form.ingredient, { stock_qty: ingr.stock_qty + qty })
      await pb.collection('stock_purchases').create({
        ingredient: form.ingredient, qty,
        price_total: Number(form.price_total) || 0,
        note: form.note,
      })
      await pb.collection('stock_adjustments').create({
        ingredient: form.ingredient, qty_change: qty,
        reason: 'purchase', note: form.note || `Stock in: ${qty} ${ingr.unit}`,
      })
      setForm(f => ({ ...f, qty: '', price_total: '', note: '' }))
      load()
    } finally { setSaving(false) }
  }

  const ingrName = (id: string) => ingredients.find(i => i.id === id)?.name ?? id
  const ingrUnit = (id: string) => ingredients.find(i => i.id === id)?.unit ?? ''

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">{t('stock_in.title')}</h2>
        <p className="text-sm text-slate-400 mt-1">{t('stock_in.subtitle')}</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 mb-8">
        <h3 className="font-semibold text-slate-700 mb-4">{t('stock_in.record')}</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">{t('recipes.ingredient')}</label>
            <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={form.ingredient} onChange={e => setForm(f => ({ ...f, ingredient: e.target.value }))}>
              {ingredients.map(i => <option key={i.id} value={i.id}>{i.name} ({t('stock_in.current')} {i.stock_qty} {i.unit})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              {t('stock_in.qty')} ({ingrUnit(form.ingredient)})
            </label>
            <input type="number" placeholder="e.g. 5000"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={form.qty} onChange={e => setForm(f => ({ ...f, qty: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">{t('stock_in.price_total')}</label>
            <input type="number" placeholder="e.g. 25000"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={form.price_total} onChange={e => setForm(f => ({ ...f, price_total: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">{t('common.note')} ({t('common.optional')})</label>
            <input type="text" placeholder={t('stock_in.note_placeholder')}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
          </div>
        </div>
        <button onClick={save} disabled={saving || !form.ingredient || !form.qty}
          className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60">
          {saving ? t('common.saving') : t('stock_in.add_btn')}
        </button>
      </div>

      <h3 className="font-semibold text-slate-700 mb-3">{t('stock_in.history')}</h3>
      {loading ? <div className="text-slate-400 text-center py-10">{t('common.loading')}</div> : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-6 py-3 text-slate-500 font-medium whitespace-nowrap">{t('common.date')}</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium whitespace-nowrap">{t('recipes.ingredient')}</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium whitespace-nowrap">{t('stock_in.qty')}</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium whitespace-nowrap">{t('stock_in.price_total')}</th>
                <th className="hidden sm:table-cell text-left px-6 py-3 text-slate-500 font-medium whitespace-nowrap">{t('common.note')}</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map(p => (
                <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-6 py-3 text-slate-500 text-xs whitespace-nowrap">
                    {p.created ? new Date(p.created).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                  <td className="px-6 py-3 font-medium text-slate-800 whitespace-nowrap">{ingrName(p.ingredient)}</td>
                  <td className="px-6 py-3 text-slate-600 whitespace-nowrap">+{p.qty} {ingrUnit(p.ingredient)}</td>
                  <td className="px-6 py-3 text-slate-600 whitespace-nowrap">{p.price_total > 0 ? formatRupiah(p.price_total) : '—'}</td>
                  <td className="hidden sm:table-cell px-6 py-3 text-slate-400 text-xs">{p.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          {purchases.length === 0 && <div className="px-6 py-12 text-center text-slate-400">{t('stock_in.no_purchases')}</div>}
        </div>
      )}
    </div>
  )
}

