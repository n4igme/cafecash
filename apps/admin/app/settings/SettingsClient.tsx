'use client'
import { useEffect, useState, useRef } from 'react'
import PocketBase from 'pocketbase'

const API_URL = process.env.NEXT_PUBLIC_API_URL!

interface Settings {
  id: string
  store_name: string
  logo_emoji: string
  qris_image: string
}

export default function SettingsClient({ token }: { token: string | null }) {
  const [pb] = useState(() => {
    const client = new PocketBase(API_URL)
    client.autoCancellation(false)
    if (token) client.authStore.save(token, null)
    return client
  })

  const [settings,    setSettings]    = useState<Settings | null>(null)
  const [storeName,   setStoreName]   = useState('')
  const [logoEmoji,   setLogoEmoji]   = useState('☕')
  const [qrisPreview, setQrisPreview] = useState<string | null>(null)
  const [saving,      setSaving]      = useState(false)
  const [saved,       setSaved]       = useState(false)
  const [loading,     setLoading]     = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    pb.collection('settings')
      .getFirstListItem<Settings>('')
      .then(record => {
        setSettings(record)
        setStoreName(record.store_name ?? '')
        setLogoEmoji(record.logo_emoji || '☕')
        if (record.qris_image) {
          setQrisPreview(`${API_URL}/api/files/settings/${record.id}/${record.qris_image}`)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setQrisPreview(URL.createObjectURL(file))
  }

  const save = async () => {
    setSaving(true); setSaved(false)
    try {
      const formData = new FormData()
      formData.append('store_name',  storeName)
      formData.append('logo_emoji',  logoEmoji)
      const file = fileRef.current?.files?.[0]
      if (file) formData.append('qris_image', file)

      if (settings?.id) {
        const updated = await pb.collection('settings').update<Settings>(settings.id, formData)
        setSettings(updated)
      } else {
        const created = await pb.collection('settings').create<Settings>(formData)
        setSettings(created)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-8 text-slate-400 text-center py-20">Loading...</div>

  return (
    <div className="p-8 max-w-xl">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Settings</h2>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 space-y-6">

        {/* Store name */}
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Store Name</label>
          <input
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-indigo-400"
            value={storeName}
            onChange={e => setStoreName(e.target.value)}
            placeholder="e.g. Kopi Kita"
          />
          <p className="text-xs text-slate-400 mt-1">Displayed in the sidebar and tablet POS header</p>
        </div>

        {/* Logo emoji */}
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Logo Emoji</label>
          <div className="flex items-center gap-3">
            <span className="text-4xl">{logoEmoji || '☕'}</span>
            <input
              className="w-24 border border-slate-200 rounded-lg px-3 py-2 text-sm text-center
                         focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={logoEmoji}
              onChange={e => setLogoEmoji(e.target.value)}
              placeholder="☕"
              maxLength={4}
            />
          </div>
          <p className="text-xs text-slate-400 mt-1">Single emoji shown next to the store name</p>
        </div>

        {/* Preview */}
        <div className="bg-slate-50 rounded-lg px-4 py-3 flex items-center gap-2">
          <span className="text-lg">{logoEmoji || '☕'}</span>
          <span className="font-semibold text-slate-800 text-sm">{storeName || 'Your Store Name'}</span>
        </div>

        {/* QRIS image */}
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-2">QRIS Image</label>
          {qrisPreview && (
            <div className="mb-3 border border-slate-100 rounded-lg p-3 inline-block bg-slate-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrisPreview} alt="QRIS preview" className="w-48 h-48 object-contain" />
            </div>
          )}
          <div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp"
              onChange={handleFileChange} className="hidden" id="qris-upload" />
            <label htmlFor="qris-upload"
              className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200
                         rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50
                         cursor-pointer transition-colors">
              📷 {qrisPreview ? 'Replace QRIS image' : 'Upload QRIS image'}
            </label>
            <p className="text-xs text-slate-400 mt-1">PNG, JPG, or WebP · max 5MB</p>
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center gap-3 pt-2">
          <button onClick={save} disabled={saving}
            className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold
                       hover:bg-indigo-700 disabled:opacity-60 transition-colors">
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
          {saved && <span className="text-sm text-green-600 font-medium">✓ Saved</span>}
        </div>
      </div>

      <p className="text-xs text-slate-400 mt-4">
        Store name and logo update immediately — no rebuild needed.
      </p>
    </div>
  )
}
