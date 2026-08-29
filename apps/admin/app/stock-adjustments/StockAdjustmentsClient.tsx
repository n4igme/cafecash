'use client'
import { useEffect, useState } from 'react'
import PocketBase from 'pocketbase'
import type { Ingredient, StockAdjustment } from '../../../../packages/types'
import { useT } from '../components/LangProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL!

const REASONS = [
  { value: 'waste',      label: '🗑️ Waste',      desc: 'Bahan terbuang / kelebihan' },
  { value: 'spoilage',   label: '🤢 Spoilage',    desc: 'Bahan basi / expired' },
  { value: 'correction', label: '✏️ Correction',  desc: 'Koreksi hitung stok' },
]

const REASON_BADGE: Record<string, { label: string; color: string }> = {
  purchase:      { label: 'Purchase',     color: 'bg-green-100 text-green-700' },
  waste:         { label: 'Waste',        color: 'bg-red-100 text-red-600' },
  spoilage:      { label: 'Spoilage',     color: 'bg-orange-100 text-orange-700' },
  correction:    { label: 'Correction',   color: 'bg-blue-100 text-blue-700' },
  order_deduct:  { label: 'Order',        color: 'bg-indigo-100 text-indigo-700' },
  order_restore: { label: 'Restore',      color: 'bg-purple-100 text-purple-700' },
}

export default function StockAdjustmentsClient({ token }: { token: string | null }) {
  const t = useT()
  const [pb] = useState(() => {
    const c = new PocketBase(API_URL); c.autoCancellation(false)
    if (token) c.authStore.save(token, null); return c
  })
  const [adjustments,  setAdjustments]  = useState<StockAdjustment[]>([])
  const [ingredients,  setIngredients]  = useState<Ingredient[]>([])
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [form,         setForm]         = useState({
    ingredient: '', reason: 'waste', qty_change: '', note: ''
  })
  const [filterReason, setFilterReason] = useState('all')

  const load = async () => {
    setLoading(true)
    const [adj, ingr] = await Promise.all([
      pb.collection('stock_adjustments').getFullList<StockAdjustment>({
        sort: '-created', expand: 'ingredient', batch: 100,
      }),
      pb.collection('ingredients').getFullList<Ingredient>({ sort: 'name' }),
    ])
    setAdjustments(adj)
    setIngredients(ingr)
    if (ingr.length > 0 && !form.ingredient) setForm(f => ({ ...f, ingredient: ingr[0].id }))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    if (!form.ingredient || !form.qty_change) return
    const rawQty = Number(form.qty_change)
    if (rawQty === 0) return

    // Waste/spoilage are always negative deductions
    const qty = ['waste', 'spoilage'].includes(form.reason) ? -Math.abs(rawQty) : rawQty

    setSaving(true)
    try {
      // Update ingredient stock
      const ingr = await pb.collection('ingredients').getOne<Ingredient>(form.ingredient)
      const newQty = Math.max(0, ingr.stock_qty + qty)
      await pb.collection('ingredients').update(form.ingredient, { stock_qty: newQty })

      // Record adjustment
      await pb.collection('stock_adjustments').create({
        ingredient: form.ingredient,
        qty_change: qty,
        reason: form.reason,
        note: form.note,
      })

      setForm(f => ({ ...f, qty_change: '', note: '' }))
      load()
    } finally {
      setSaving(false)
    }
  }

  const ingrName = (id: string) => ingredients.find(i => i.id === id)?.name ?? id
  const ingrUnit = (id: string) => ingredients.find(i => i.id === id)?.unit ?? ''

  const filtered = filterReason === 'all'
    ? adjustments
    : adjustments.filter(a => a.reason === filterReason)

  const isDeduction = ['waste', 'spoilage'].includes(form.reason)

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">{t('adjustments.title')}</h2>
        <p className="text-sm text-slate-400 mt-1">{t('adjustments.subtitle')}</p>
      </div>

      {/* Quick adjustment form */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 mb-8">
        <h3 className="font-semibold text-slate-700 mb-4">{t('adjustments.record')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Ingredient */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">{t('recipes.ingredient')}</label>
            <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={form.ingredient} onChange={e => setForm(f => ({ ...f, ingredient: e.target.value }))}>
              {ingredients.map(i => (
                <option key={i.id} value={i.id}>
                  {i.name} ({t('stock_in.current')} {i.stock_qty} {i.unit})
                </option>
              ))}
            </select>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">{t('adjustments.reason')}</label>
            <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}>
              <option value="waste">{t('adjustments.waste')}</option>
              <option value="spoilage">{t('adjustments.spoilage')}</option>
              <option value="correction">{t('adjustments.correction')}</option>
            </select>
          </div>

          {/* Qty */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              {t('stock_in.qty')} ({ingrUnit(form.ingredient)})
              {isDeduction && <span className="ml-1 text-red-500 text-xs">— {t('adjustments.will_deduct')}</span>}
              {!isDeduction && <span className="ml-1 text-green-500 text-xs">— {t('adjustments.use_sign')}</span>}
            </label>
            <input type="number" placeholder={isDeduction ? "e.g. 200" : "e.g. +500 or -100"}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={form.qty_change} onChange={e => setForm(f => ({ ...f, qty_change: e.target.value }))} />
          </div>

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">{t('common.note')} ({t('common.optional')})</label>
            <input type="text" placeholder="e.g. Susu tumpah, 1 pack expired"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
          </div>
        </div>

        {/* Preview */}
        {form.ingredient && form.qty_change && Number(form.qty_change) !== 0 && (
          <div className={`mt-4 px-4 py-2 rounded-lg text-sm font-medium ${
            isDeduction ? 'bg-red-50 text-red-700 border border-red-100'
            : Number(form.qty_change) > 0 ? 'bg-green-50 text-green-700 border border-green-100'
            : 'bg-amber-50 text-amber-700 border border-amber-100'
          }`}>
            {isDeduction
              ? `${t('adjustments.preview_deduct')} ${Math.abs(Number(form.qty_change))} ${ingrUnit(form.ingredient)} dari ${ingrName(form.ingredient)}`
              : Number(form.qty_change) > 0
              ? `${t('adjustments.preview_add')} ${Number(form.qty_change)} ${ingrUnit(form.ingredient)} ke ${ingrName(form.ingredient)}`
              : `${t('adjustments.preview_remove')} ${Math.abs(Number(form.qty_change))} ${ingrUnit(form.ingredient)} dari ${ingrName(form.ingredient)}`
            }
          </div>
        )}

        <button onClick={save} disabled={saving || !form.ingredient || !form.qty_change || Number(form.qty_change) === 0}
          className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60">
          {saving ? t('common.saving') : t('adjustments.record_btn')}
        </button>
      </div>

      {/* Filter + history */}
      <div className="flex flex-col gap-2 mb-3">
        <h3 className="font-semibold text-slate-700">{t('adjustments.history')}</h3>
        <div className="flex flex-wrap gap-2">
          {['all', 'waste', 'spoilage', 'correction', 'order_deduct', 'order_restore'].map(r => (
            <button key={r} onClick={() => setFilterReason(r)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                filterReason === r
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}>
              {r === 'all' ? t('common.all') : REASON_BADGE[r]?.label ?? r}
            </button>
          ))}
        </div>
      </div>

      {loading ? <div className="text-slate-400 text-center py-20">{t('common.loading')}</div> : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-6 py-3 text-slate-500 font-medium whitespace-nowrap">{t('common.date')}</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium whitespace-nowrap">{t('recipes.ingredient')}</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium whitespace-nowrap">{t('adjustments.change')}</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium whitespace-nowrap">{t('adjustments.reason')}</th>
                <th className="hidden sm:table-cell text-left px-6 py-3 text-slate-500 font-medium whitespace-nowrap">{t('common.note')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => {
                const badge = REASON_BADGE[a.reason] ?? { label: a.reason, color: 'bg-slate-100 text-slate-500' }
                return (
                  <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-6 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {a.created ? new Date(a.created).toLocaleString('id-ID', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                      }) : '—'}
                    </td>
                    <td className="px-6 py-3 font-medium text-slate-800 whitespace-nowrap">{ingrName(a.ingredient)}</td>
                    <td className={`px-6 py-3 font-semibold whitespace-nowrap ${a.qty_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {a.qty_change >= 0 ? '+' : ''}{a.qty_change} {ingrUnit(a.ingredient)}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${badge.color}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="hidden sm:table-cell px-6 py-3 text-slate-400 text-xs">{a.note || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
          {filtered.length === 0 && (
            <div className="px-6 py-12 text-center text-slate-400">{t('adjustments.no_history')}</div>
          )}
        </div>
      )}
    </div>
  )
}
