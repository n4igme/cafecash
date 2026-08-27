'use client'
import { useEffect, useState, useRef } from 'react'
import PocketBase from 'pocketbase'

const API_URL = process.env.NEXT_PUBLIC_API_URL!

interface Settings {
  id: string
  store_name: string
  logo_emoji: string
  logo: string
  qris_image: string
}

export default function SettingsClient({ token }: { token: string | null }) {
  const [pb] = useState(() => {
    const client = new PocketBase(API_URL)
    client.autoCancellation(false)
    if (token) client.authStore.save(token, null)
    return client
  })

  const [settings,     setSettings]     = useState<Settings | null>(null)
  const [storeName,    setStoreName]     = useState('')
  const [logoPreview,  setLogoPreview]   = useState<string | null>(null)
  const [qrisPreview,  setQrisPreview]   = useState<string | null>(null)
  const [saving,       setSaving]        = useState(false)
  const [saved,        setSaved]         = useState(false)
  const [loading,      setLoading]       = useState(true)
  const logoRef = useRef<HTMLInputElement>(null)
  const qrisRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    pb.collection('settings')
      .getFirstListItem<Settings>('')
      .then(record => {
        setSettings(record)
        setStoreName(record.store_name ?? '')
        if (record.logo) {
          setLogoPreview(`${API_URL}/api/files/settings/${record.id}/${record.logo}`)
        }
        if (record.qris_image) {
          setQrisPreview(`${API_URL}/api/files/settings/${record.id}/${record.qris_image}`)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true); setSaved(false)
    try {
      const formData = new FormData()
      formData.append('store_name', storeName)
      const logoFile = logoRef.current?.files?.[0]
      if (logoFile) formData.append('logo', logoFile)
      const qrisFile = qrisRef.current?.files?.[0]
      if (qrisFile) formData.append('qris_image', qrisFile)

      if (settings?.id) {
        const updated = await pb.collection('settings').update<Settings>(settings.id, formData)
        setSettings(updated)
        if (updated.logo)
          setLogoPreview(`${API_URL}/api/files/settings/${updated.id}/${updated.logo}`)
        if (updated.qris_image)
          setQrisPreview(`${API_URL}/api/files/settings/${updated.id}/${updated.qris_image}`)
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
          <p className="text-xs text-slate-400 mt-1">Displayed in sidebar and tablet POS header</p>
        </div>

        {/* Store logo */}
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-2">Store Logo</label>
          {logoPreview ? (
            <div className="mb-3 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoPreview} alt="logo preview"
                className="w-16 h-16 object-contain rounded-lg border border-slate-200 bg-slate-50 p-1" />
              <div className="text-sm text-slate-500">
                <p className="font-medium text-slate-700">{storeName || 'Your Store'}</p>
                <p className="text-xs text-slate-400">Preview of sidebar branding</p>
              </div>
            </div>
          ) : (
            <div className="mb-3 flex items-center gap-3">
              <div className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-slate-300 text-2xl">
                🏪
              </div>
              <p className="text-sm text-slate-400">No logo uploaded yet</p>
            </div>
          )}
          <input ref={logoRef} type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/x-icon"
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) setLogoPreview(URL.createObjectURL(f))
            }}
            className="hidden" id="logo-upload" />
          <label htmlFor="logo-upload"
            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200
                       rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50
                       cursor-pointer transition-colors">
            🖼️ {logoPreview ? 'Replace logo' : 'Upload logo'}
          </label>
          <p className="text-xs text-slate-400 mt-1">PNG, JPG, WebP, GIF, ICO · max 2MB · recommended 128×128px</p>
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
            <input ref={qrisRef} type="file" accept="image/png,image/jpeg,image/webp"
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) setQrisPreview(URL.createObjectURL(f))
              }}
              className="hidden" id="qris-upload" />
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
        Changes take effect immediately — no rebuild needed.
      </p>
    </div>
  )
}
