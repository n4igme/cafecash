'use client'
import { useEffect, useState } from 'react'
import PocketBase from 'pocketbase'
import type { Recipe, Product, Ingredient } from '../../../../packages/types'
import { useT } from '../components/LangProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL!

export default function RecipesClient({ token }: { token: string | null }) {
  const t = useT()
  const [pb] = useState(() => {
    const c = new PocketBase(API_URL); c.autoCancellation(false)
    if (token) c.authStore.save(token, null); return c
  })
  const [recipes,     setRecipes]     = useState<Recipe[]>([])
  const [products,    setProducts]    = useState<Product[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [loading,     setLoading]     = useState(true)
  const [modal,       setModal]       = useState(false)
  const [form,        setForm]        = useState({ product: '', ingredient: '', qty_needed: '' })
  const [editId,      setEditId]      = useState<string | null>(null)
  const [saving,      setSaving]      = useState(false)
  const [filterProd,  setFilterProd]  = useState('')

  const load = async () => {
    setLoading(true)
    const [r, p, i] = await Promise.all([
      pb.collection('recipes').getFullList<Recipe>({ expand: 'product,ingredient', sort: 'product,ingredient' }),
      pb.collection('products').getFullList<Product>({ sort: 'name' }),
      pb.collection('ingredients').getFullList<Ingredient>({ sort: 'name' }),
    ])
    setRecipes(r); setProducts(p); setIngredients(i); setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openNew  = () => { setForm({ product: products[0]?.id ?? '', ingredient: ingredients[0]?.id ?? '', qty_needed: '' }); setEditId(null); setModal(true) }
  const openEdit = (r: Recipe) => { setForm({ product: r.product, ingredient: r.ingredient, qty_needed: String(r.qty_needed) }); setEditId(r.id); setModal(true) }

  const save = async () => {
    if (!form.product || !form.ingredient || !form.qty_needed) return
    setSaving(true)
    const payload = { product: form.product, ingredient: form.ingredient, qty_needed: Number(form.qty_needed) }
    if (editId) await pb.collection('recipes').update(editId, payload)
    else await pb.collection('recipes').create(payload)
    setSaving(false); setModal(false); load()
  }

  const del = async (id: string) => {
    if (!confirm('Delete this recipe entry?')) return
    await pb.collection('recipes').delete(id); load()
  }

  const filtered     = filterProd ? recipes.filter(r => r.product === filterProd) : recipes
  const productName  = (id: string) => products.find(p => p.id === id)?.name ?? id
  const ingrName     = (id: string) => ingredients.find(i => i.id === id)?.name ?? id
  const ingrUnit     = (id: string) => ingredients.find(i => i.id === id)?.unit ?? ''

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">{t('recipes.title')}</h2>
          <p className="text-sm text-slate-400 mt-1">{t('recipes.subtitle')}</p>
        </div>
        <button onClick={openNew} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700">
          {t('recipes.add')}
        </button>
      </div>

      <div className="mb-4">
        <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          value={filterProd} onChange={e => setFilterProd(e.target.value)}>
          <option value="">{t('recipes.all_products')}</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {loading ? <div className="text-slate-400 text-center py-20">{t('common.loading')}</div> : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-6 py-3 text-slate-500 font-medium">{t('recipes.product')}</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">{t('recipes.ingredient')}</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">{t('recipes.qty_per_serving')}</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-6 py-3 font-medium text-slate-800">{productName(r.product)}</td>
                  <td className="px-6 py-3 text-slate-600">{ingrName(r.ingredient)}</td>
                  <td className="px-6 py-3 text-slate-600">{r.qty_needed} {ingrUnit(r.ingredient)}</td>
                  <td className="px-6 py-3">
                    <button onClick={() => openEdit(r)} className="text-indigo-600 hover:text-indigo-800 font-medium mr-4">{t('common.edit')}</button>
                    <button onClick={() => del(r.id)} className="text-red-500 hover:text-red-700 font-medium">{t('common.delete')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="px-6 py-12 text-center text-slate-400">{t('recipes.no_recipes')}</div>}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold text-slate-800 mb-4">{editId ? t('recipes.edit') : t('recipes.new')}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">{t('recipes.product')}</label>
                <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  value={form.product} onChange={e => setForm(f => ({ ...f, product: e.target.value }))}>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">{t('recipes.ingredient')}</label>
                <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  value={form.ingredient} onChange={e => setForm(f => ({ ...f, ingredient: e.target.value }))}>
                  {ingredients.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  {t('recipes.qty_needed')} ({ingredients.find(i => i.id === form.ingredient)?.unit ?? '—'})
                </label>
                <input type="number" placeholder="e.g. 150"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  value={form.qty_needed} onChange={e => setForm(f => ({ ...f, qty_needed: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setModal(false)} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50">{t('common.cancel')}</button>
              <button onClick={save} disabled={saving} className="flex-1 py-2 bg-indigo-600 rounded-lg text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
                {saving ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

