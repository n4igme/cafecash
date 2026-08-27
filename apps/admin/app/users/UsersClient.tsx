'use client'
import { useEffect, useState } from 'react'
import PocketBase from 'pocketbase'

const API_URL = process.env.NEXT_PUBLIC_API_URL!

interface User {
  id: string
  email: string
  name: string
  created: string
}

const EMPTY = { email: '', name: '', password: '', passwordConfirm: '' }

export default function UsersClient({ token }: { token: string | null }) {
  const [pb] = useState(() => {
    const client = new PocketBase(API_URL)
    client.autoCancellation(false)
    if (token) client.authStore.save(token, null)
    return client
  })

  const [users,   setUsers]   = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [modal,   setModal]   = useState<'add' | 'edit' | null>(null)
  const [form,    setForm]    = useState(EMPTY)
  const [editId,  setEditId]  = useState<string | null>(null)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const data = await pb.collection('users').getFullList<User>({ sort: 'created' })
    setUsers(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openAdd = () => {
    setForm(EMPTY); setEditId(null); setError(null); setModal('add')
  }

  const openEdit = (u: User) => {
    setForm({ email: u.email, name: u.name, password: '', passwordConfirm: '' })
    setEditId(u.id); setError(null); setModal('edit')
  }

  const save = async () => {
    if (!form.email) return setError('Email is required.')
    if (modal === 'add') {
      if (!form.password) return setError('Password is required.')
      if (form.password !== form.passwordConfirm) return setError('Passwords do not match.')
      if (form.password.length < 8) return setError('Password must be at least 8 characters.')
    }
    if (modal === 'edit' && form.password && form.password !== form.passwordConfirm) {
      return setError('Passwords do not match.')
    }

    setSaving(true); setError(null)
    try {
      if (modal === 'add') {
        await pb.collection('users').create({
          email: form.email,
          name:  form.name,
          password: form.password,
          passwordConfirm: form.passwordConfirm,
        })
      } else if (editId) {
        const payload: Record<string, string> = { email: form.email, name: form.name }
        if (form.password) {
          payload.password = form.password
          payload.passwordConfirm = form.passwordConfirm
        }
        await pb.collection('users').update(editId, payload)
      }
      setModal(null)
      load()
    } catch (e: any) {
      setError(e?.response?.message ?? e?.message ?? 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  const del = async (id: string, email: string) => {
    if (!confirm(`Delete user ${email}? This cannot be undone.`)) return
    await pb.collection('users').delete(id)
    load()
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Users</h2>
          <p className="text-sm text-slate-400 mt-1">Admin dashboard users — all have full access</p>
        </div>
        <button onClick={openAdd}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors">
          + Add User
        </button>
      </div>

      {loading ? (
        <div className="text-slate-400 text-center py-20">Loading...</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Email</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Name</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Created</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-6 py-3 font-medium text-slate-800">{u.email}</td>
                  <td className="px-6 py-3 text-slate-500">{u.name || '—'}</td>
                  <td className="px-6 py-3 text-slate-400 text-xs">
                    {u.created ? new Date(u.created).toLocaleDateString('id-ID', {
                      day: '2-digit', month: 'short', year: 'numeric',
                    }) : '—'}
                  </td>
                  <td className="px-6 py-3">
                    <button onClick={() => openEdit(u)}
                      className="text-indigo-600 hover:text-indigo-800 font-medium mr-4">
                      Edit
                    </button>
                    <button onClick={() => del(u.id, u.email)}
                      className="text-red-500 hover:text-red-700 font-medium">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <div className="px-6 py-12 text-center text-slate-400">No users yet</div>
          )}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold text-slate-800 mb-4">
              {modal === 'add' ? 'New User' : 'Edit User'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Email</label>
                <input type="email"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="admin@cafecash.pos"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Name</label>
                <input type="text"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Admin"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Password {modal === 'edit' && <span className="text-slate-400 font-normal">(leave blank to keep current)</span>}
                </label>
                <input type="password"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Min 8 characters"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Confirm Password</label>
                <input type="password"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  value={form.passwordConfirm}
                  onChange={e => setForm(f => ({ ...f, passwordConfirm: e.target.value }))}
                  placeholder="Repeat password"
                />
              </div>
              {error && (
                <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg px-4 py-3">
                  {error}
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setModal(null)}
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
