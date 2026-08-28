'use client'
import { useEffect, useState, useRef } from 'react'
import PocketBase from 'pocketbase'
import type { Ingredient } from '../../../../packages/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL!
const UNITS = ['ml', 'gram', 'pcs']
const EMPTY = { name: '', unit: 'ml', stock_qty: 0, alert_qty: 0, cost_per_unit: 0 }

const formatRupiah = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

export default function IngredientsClient({ token }: { token: string | null }) {
  const [pb] = useState(() => {
    const c = new PocketBase(API_URL); c.autoCancellation(false)
    if (token) c.authStore.save(token, null); return c
  })
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [loading,  setLoading]  = useState(true)
  const [modal,    setModal]    = useState(false)
  const [form,     setForm]     = useState<any>(EMPTY)
  const [saving,   setSaving]   = useState(false)

  const load = async () => {
    setLoading(true)
    const data = await pb.collection('ingredients').getFullList<Ingredient>({ sort: 'name' })
    setIngredients(data); setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openNew  = () => { setForm(EMPTY); setModal(true) }
  const openEdit = (i: Ingredient) => { setForm({ ...i }); setModal(true) }

  const save = async () => {
    if (!form.name) return
    setSaving(true)
    const payload = { name: form.name, unit: form.unit, stock_qty: Number(form.stock_qty),
      alert_qty: Number(form.alert_qty), cost_per_unit: Number(form.cost_per_unit) }
    if (form.id) await pb.collection('ingredients').update(form.id, payload)
    else await pb.collection('ingredients').create(payload)
    setSaving(false); setModal(false); load()
  }

  const del = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This will also delete all recipes using it.`)) return
    await pb.collection('ingredients').delete(id); load()
  }

  const stockClass = (i: Ingredient) =>
    i.stock_qty <= 0 ? 'text-red-600 font-bold'
    : i.stock_qty <= i.alert_qty ? 'text-amber-600 font-semibold'
    : 'text-green-600'

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Ingredients</h2>
          <p className="text-sm text-slate-400 mt-1">Manage raw materials and current stock</p>
        </div>
        <button onClick={openNew} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700">
          + Add Ingredient
        </button>
      </div>

      {/* Low stock warnings */}
      {ingredients.filter(i => i.stock_qty <= i.alert_qty && i.alert_qty > 0).length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 flex items-center gap-2">
          <span className="text-amber-500 text-lg">⚠️</span>
          <span className="text-amber-700 text-sm font-medium">
            {ingredients.filter(i => i.stock_qty <= i.alert_qty && i.alert_qty > 0).length} ingredient(s) below alert level:&nbsp;
            {ingredients.filter(i => i.stock_qty <= i.alert_qty && i.alert_qty > 0).map(i => i.name).join(', ')}
          </span>
        </div>
      )}

      {loading ? <div className="text-slate-400 text-center py-20">Loading...</div> : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Name</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Unit</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Stock</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Alert at</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Cost/unit</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {ingredients.map(i => (
                <tr key={i.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-6 py-3 font-medium text-slate-800">{i.name}</td>
                  <td className="px-6 py-3 text-slate-500">{i.unit}</td>
                  <td className={`px-6 py-3 ${stockClass(i)}`}>
                    {i.stock_qty} {i.unit}
                    {i.stock_qty <= 0 && <span className="ml-1 text-xs">🔴 OUT</span>}
                    {i.stock_qty > 0 && i.stock_qty <= i.alert_qty && <span className="ml-1 text-xs">🟡 LOW</span>}
                  </td>
                  <td className="px-6 py-3 text-slate-500">{i.alert_qty} {i.unit}</td>
                  <td className="px-6 py-3 text-slate-500">{formatRupiah(i.cost_per_unit)}/{i.unit}</td>
                  <td className="px-6 py-3">
                    <button onClick={() => openEdit(i)} className="text-indigo-600 hover:text-indigo-800 font-medium mr-4">Edit</button>
                    <button onClick={() => del(i.id, i.name)} className="text-red-500 hover:text-red-700 font-medium">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {ingredients.length === 0 && <div className="px-6 py-12 text-center text-slate-400">No ingredients yet</div>}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold text-slate-800 mb-4">{form.id ? 'Edit' : 'New'} Ingredient</h3>
            <div className="space-y-4">
              {[
                { label: 'Name', key: 'name', type: 'text', placeholder: 'e.g. Whole Milk' },
                { label: 'Stock Qty', key: 'stock_qty', type: 'number', placeholder: '1000' },
                { label: 'Alert Level', key: 'alert_qty', type: 'number', placeholder: '200' },
                { label: 'Cost per unit (IDR)', key: 'cost_per_unit', type: 'number', placeholder: '5' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-slate-600 mb-1">{f.label}</label>
                  <input type={f.type} placeholder={f.placeholder}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    value={form[f.key] ?? ''} onChange={e => setForm((x: any) => ({ ...x, [f.key]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Unit</label>
                <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  value={form.unit ?? 'ml'} onChange={e => setForm((x: any) => ({ ...x, unit: e.target.value }))}>
                  {UNITS.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setModal(false)} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={save} disabled={saving} className="flex-1 py-2 bg-indigo-600 rounded-lg text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
