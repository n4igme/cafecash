'use client'
import { useEffect, useState, useRef } from 'react'
import PocketBase from 'pocketbase'
import type { Product } from '../../../../packages/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL!

const formatRupiah = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

const CATEGORIES = ['Coffee', 'Non-Coffee', 'Drinks', 'Food']
const EMPTY: Partial<Product> = { name: '', price: 0, category: 'Coffee', is_available: true }

function productImageUrl(pb: PocketBase, product: Product): string | null {
  if (product.image) {
    return `${API_URL}/api/files/${product.collectionId}/${product.id}/${product.image}`
  }
  return null
}

export default function ProductsClient({ token }: { token: string | null }) {
  const [pb] = useState(() => {
    const client = new PocketBase(API_URL)
    client.autoCancellation(false)
    if (token) client.authStore.save(token, null)
    return client
  })
  const [products,     setProducts]     = useState<Product[]>([])
  const [loading,      setLoading]      = useState(true)
  const [modal,        setModal]        = useState(false)
  const [form,         setForm]         = useState<Partial<Product>>(EMPTY)
  const [saving,       setSaving]       = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    setLoading(true)
    const data = await pb.collection('products').getFullList<Product>({ sort: 'category,name' })
    setProducts(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openNew = () => {
    setForm(EMPTY)
    setImagePreview(null)
    setModal(true)
  }

  const openEdit = (p: Product) => {
    setForm({ ...p })
    setImagePreview(productImageUrl(pb, p))
    setModal(true)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImagePreview(URL.createObjectURL(file))
  }

  const save = async () => {
    if (!form.name || !form.price) return
    setSaving(true)
    try {
      const formData = new FormData()
      formData.append('name',         form.name)
      formData.append('price',        String(form.price))
      formData.append('category',     form.category ?? 'Coffee')
      formData.append('is_available', String(form.is_available ?? true))
      const file = fileRef.current?.files?.[0]
      if (file) formData.append('image', file)

      if (form.id) {
        await pb.collection('products').update(form.id, formData)
      } else {
        await pb.collection('products').create(formData)
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
                <th className="text-left px-4 py-3 text-slate-500 font-medium w-16">Image</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Name</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Category</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Price</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => {
                const imgUrl = productImageUrl(pb, p)
                return (
                  <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-2">
                      {imgUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={imgUrl} alt={p.name}
                          className="w-10 h-10 object-cover rounded-lg border border-slate-100" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-lg">☕</div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                    <td className="px-4 py-3 text-slate-500">{p.category}</td>
                    <td className="px-4 py-3 font-semibold text-indigo-600">{formatRupiah(p.price)}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleAvailable(p)}
                        className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                          p.is_available
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}>
                        {p.is_available ? 'Available' : 'Hidden'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
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
                )
              })}
            </tbody>
          </table>
          {products.length === 0 && (
            <div className="px-6 py-12 text-center text-slate-400">No products yet</div>
          )}
        </div>
      )}

      {/* Modal */}
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

              {/* Image upload */}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">Product Image</label>
                {imagePreview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imagePreview} alt="preview"
                    className="w-24 h-24 object-cover rounded-lg border border-slate-200 mb-2" />
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                  id="product-image-upload"
                />
                <label htmlFor="product-image-upload"
                  className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg
                             text-sm font-medium text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors">
                  📷 {imagePreview ? 'Change image' : 'Upload image'}
                </label>
                <p className="text-xs text-slate-400 mt-1">PNG, JPG, WebP · max 5MB</p>
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
