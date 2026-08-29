'use client'
import { useEffect, useState, useRef, useMemo } from 'react'
import PocketBase from 'pocketbase'
import type { Product } from '../../../../packages/types'
import { useT } from '../components/LangProvider'

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

// null = no recipe (unlimited), number = max servings possible
type StockMap = Record<string, number | null>

function buildStockMap(
  recipes: { product: string; ingredient: string; qty_needed: number }[],
  ingredients: { id: string; stock_qty: number }[]
): StockMap {
  const stockById: Record<string, number> = {}
  for (const i of ingredients) stockById[i.id] = i.stock_qty

  const productIds = [...new Set(recipes.map(r => r.product))]
  const map: StockMap = {}
  for (const pid of productIds) {
    const lines = recipes.filter(r => r.product === pid)
    if (lines.length === 0) { map[pid] = null; continue }
    let minServings = Infinity
    for (const line of lines) {
      const stock = stockById[line.ingredient] ?? 0
      const servings = line.qty_needed > 0 ? Math.floor(stock / line.qty_needed) : Infinity
      if (servings < minServings) minServings = servings
    }
    map[pid] = minServings === Infinity ? null : minServings
  }
  return map
}

function StockBadge({ servings }: { servings: number | null | undefined }) {
  if (servings === undefined) return null
  if (servings === null)      return null
  if (servings <= 0)  return (
    <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">
      ⚫ Out of stock
    </span>
  )
  if (servings <= 5)  return (
    <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
      🟡 Low ({servings} left)
    </span>
  )
  return null
}

type SortKey = 'name' | 'category' | 'price' | 'status'
type SortDir = 'asc' | 'desc'

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <span className="ml-1 text-slate-300">↕</span>
  return <span className="ml-1 text-indigo-500">{sortDir === 'asc' ? '↑' : '↓'}</span>
}

export default function ProductsClient({ token }: { token: string | null }) {
  const t = useT()
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
  const [stockMap,     setStockMap]     = useState<StockMap>({})
  const [search,       setSearch]       = useState('')
  const [filterCat,    setFilterCat]    = useState('All')
  const [sortKey,      setSortKey]      = useState<SortKey>('name')
  const [sortDir,      setSortDir]      = useState<SortDir>('asc')
  const fileRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    setLoading(true)
    const data = await pb.collection('products').getFullList<Product>({ sort: 'category,name' })
    setProducts(data)
    setLoading(false)

    Promise.all([
      pb.collection('recipes').getFullList<{ product: string; ingredient: string; qty_needed: number }>({ fields: 'product,ingredient,qty_needed' }),
      pb.collection('ingredients').getFullList<{ id: string; stock_qty: number }>({ fields: 'id,stock_qty' }),
    ]).then(([recipes, ingredients]) => {
      setStockMap(buildStockMap(recipes, ingredients))
    }).catch(() => {})
  }

  useEffect(() => { load() }, [])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const filtered = useMemo(() => {
    let result = [...products]

    // Category filter
    if (filterCat !== 'All') result = result.filter(p => p.category === filterCat)

    // Search
    const q = search.trim().toLowerCase()
    if (q) result = result.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      String(p.price).includes(q)
    )

    // Sort
    result.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name')     cmp = a.name.localeCompare(b.name)
      if (sortKey === 'category') cmp = a.category.localeCompare(b.category)
      if (sortKey === 'price')    cmp = a.price - b.price
      if (sortKey === 'status')   cmp = Number(b.is_available) - Number(a.is_available)
      return sortDir === 'asc' ? cmp : -cmp
    })

    return result
  }, [products, search, filterCat, sortKey, sortDir])

  // Category counts
  const catCounts = useMemo(() => {
    const counts: Record<string, number> = { All: products.length }
    for (const cat of CATEGORIES) counts[cat] = products.filter(p => p.category === cat).length
    return counts
  }, [products])

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
        <h2 className="text-2xl font-bold text-slate-800">{t('products.title')}</h2>
        <button onClick={openNew}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors">
          {t('products.add')}
        </button>
      </div>

      {/* Search + category filter */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex gap-3 items-center">
          <div className="relative flex-1 max-w-sm">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
            <input
              type="text" placeholder={t('common.search')}
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <span className="text-sm text-slate-400 ml-auto">
            {filtered.length} of {products.length} products
          </span>
        </div>

        {/* Category tabs */}
        <div className="flex gap-2">
          {['All', ...CATEGORIES].map(cat => (
            <button key={cat} onClick={() => setFilterCat(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterCat === cat
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}>
              {cat} ({catCounts[cat] ?? 0})
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
                <th className="text-left px-4 py-3 text-slate-500 font-medium w-16">{t('products.image')}</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium cursor-pointer select-none hover:text-slate-700"
                  onClick={() => toggleSort('name')}>
                  {t('common.name')} <SortIcon col="name" sortKey={sortKey} sortDir={sortDir} />
                </th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium cursor-pointer select-none hover:text-slate-700"
                  onClick={() => toggleSort('category')}>
                  {t('products.category')} <SortIcon col="category" sortKey={sortKey} sortDir={sortDir} />
                </th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium cursor-pointer select-none hover:text-slate-700"
                  onClick={() => toggleSort('price')}>
                  {t('products.price')} <SortIcon col="price" sortKey={sortKey} sortDir={sortDir} />
                </th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium cursor-pointer select-none hover:text-slate-700"
                  onClick={() => toggleSort('status')}>
                  {t('common.status')} <SortIcon col="status" sortKey={sortKey} sortDir={sortDir} />
                </th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
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
                      <div className="flex items-center flex-wrap gap-1">
                        <button onClick={() => toggleAvailable(p)}
                          className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                            p.is_available
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}>
                          {p.is_available ? 'Available' : 'Hidden'}
                        </button>
                        <StockBadge servings={stockMap[p.id]} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => openEdit(p)}
                        className="text-indigo-600 hover:text-indigo-800 font-medium mr-4">{t('common.edit')}</button>
                      <button onClick={() => del(p.id)}
                        className="text-red-500 hover:text-red-700 font-medium">{t('common.delete')}</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="px-6 py-12 text-center text-slate-400">
              {search || filterCat !== 'All' ? 'No products match your search' : 'No products yet'}
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold text-slate-800 mb-4">
              {form.id ? t('products.edit') : t('products.new')}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">{t('common.name')}</label>
                <input
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  value={form.name ?? ''}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={t('products.placeholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">{t('products.price')}</label>
                <input
                  type="number"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  value={form.price ?? ''}
                  onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))}
                  placeholder="20000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">{t('products.category')}</label>
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
                <label className="block text-sm font-medium text-slate-600 mb-2">{t('products.image')}</label>
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
                  📷 {imagePreview ? t('products.change_image') : t('products.upload_image')}
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
                <label htmlFor="available" className="text-sm text-slate-600">{t('products.available_pos')}</label>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setModal(false)}
                className="flex-1 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50">
                {t('common.cancel')}
              </button>
              <button onClick={save} disabled={saving}
                className="flex-1 py-2 bg-indigo-600 rounded-lg text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
                {saving ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
