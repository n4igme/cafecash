'use client'
import { useEffect, useState } from 'react'
import PocketBase from 'pocketbase'
import type { Product } from '../../../../packages/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL!

const formatRupiah = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

const CATEGORIES = ['Coffee', 'Non-Coffee', 'Drinks', 'Food']
const EMPTY: Partial<Product> = { name: '', price: 0, category: 'Coffee', is_available: true }

export default function ProductsClient({ token }: { token: string | null }) {
  const [pb]       = useState(() => {
    const client = new PocketBase(API_URL)
    client.autoCancellation(false)
    if (token) client.authStore.save(token, null)
    return client
  })
  const [products, setProducts] = useState<Product[]>([])
  const [loading,  setLoading]  = useState(true)
  const [modal,    setModal]    = useState(false)
  const [form,     setForm]     = useState<Partial<Product>>(EMPTY)
  const [saving,   setSaving]   = useState(false)

  const load = async () => {
    setLoading(true)
    const data = await pb.collection('products').getFullList<Product>({ sort: 'category,name' })
    setProducts(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openNew  = () => { setForm(EMPTY); setModal(true) }
  const openEdit = (p: Product) => { setForm({ ...p }); setModal(true) }

  const save = async () => {
    if (!form.name || !form.price) return
    setSaving(true)
    const payload = {
      name:         form.name,
      price:        form.price,
      category:     form.category,
      is_available: form.is_available ?? true,
    }
    try {
      if (form.id) {
        await pb.collection('products').update(form.id, payload)
      } else {
        await pb.collection('products').create(payload)
      }
      setModal(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  const toggleAvailable = async (p: Product) => {
    await pb.collection('products').update(p.id, { is_available: !p.is_available })
    load()
  }

  const del = async (id: string) => {
    if (!confirm('Delete this product?')) return
    await pb.collection('products').delete(id)
    load()
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Products</h2>
        <button onClick={openNew}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors">
          + Add Product
        </button>
      </div>

      {loading ? (
        <div className="text-slate-400 text-center py-20">Loading...</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Name</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Category</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Price</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Status</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-6 py-3 font-medium text-slate-800">{p.name}</td>
                  <td className="px-6 py-3 text-slate-500">{p.category}</td>
                  <td className="px-6 py-3 font-semibold text-indigo-600">{formatRupiah(p.price)}</td>
                  <td className="px-6 py-3">
                    <button onClick={() => toggleAvailable(p)}
                      className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                        p.is_available
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}>
                      {p.is_available ? 'Available' : 'Hidden'}
                    </button>
                  </td>
                  <td className="px-6 py-3">
                    <button onClick={() => openEdit(p)}
                      className="text-indigo-600 hover:text-indigo-800 font-medium mr-4">
                      Edit
                    </button>
                    <button onClick={() => del(p.id)}
                      className="text-red-500 hover:text-red-700 font-medium">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {products.length === 0 && (
            <div className="px-6 py-12 text-center text-slate-400">No products yet</div>
          )}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold text-slate-800 mb-4">
              {form.id ? 'Edit Product' : 'New Product'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Name</label>
                <input
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  value={form.name ?? ''}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Americano"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Price (IDR)</label>
                <input
                  type="number"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  value={form.price ?? ''}
                  onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))}
                  placeholder="20000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Category</label>
                <select
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  value={form.category ?? 'Coffee'}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                >
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="available"
                  checked={form.is_available ?? true}
                  onChange={e => setForm(f => ({ ...f, is_available: e.target.checked }))}
                  className="w-4 h-4 accent-indigo-600"
                />
                <label htmlFor="available" className="text-sm text-slate-600">Available on POS</label>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setModal(false)}
                className="flex-1 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={save} disabled={saving}
                className="flex-1 py-2 bg-indigo-600 rounded-lg text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
