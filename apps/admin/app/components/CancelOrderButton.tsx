'use client'
import { useState } from 'react'
import PocketBase from 'pocketbase'

const API_URL = process.env.NEXT_PUBLIC_API_URL!

export default function CancelOrderButton({
  orderId,
  status,
  token,
}: {
  orderId: string
  status: string
  token: string | null
}) {
  const [current, setCurrent] = useState(status)
  const [loading, setLoading] = useState(false)

  if (current === 'cancelled') {
    return (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-600">
        cancelled
      </span>
    )
  }

  const markPaid = async () => {
    setLoading(true)
    try {
      const pb = new PocketBase(API_URL)
      pb.autoCancellation(false)
      if (token) pb.authStore.save(token, null)
      await pb.collection('orders').update(orderId, { status: 'paid' })
      setCurrent('paid')
    } finally {
      setLoading(false)
    }
  }

  const cancel = async () => {
    if (!confirm('Cancel this order?')) return
    setLoading(true)
    try {
      const pb = new PocketBase(API_URL)
      pb.autoCancellation(false)
      if (token) pb.authStore.save(token, null)
      await pb.collection('orders').update(orderId, { status: 'cancelled' })
      setCurrent('cancelled')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
        current === 'paid'
          ? 'bg-green-100 text-green-700'
          : 'bg-yellow-100 text-yellow-700'
      }`}>
        {current}
      </span>
      {current === 'pending' && (
        <button
          onClick={markPaid}
          disabled={loading}
          className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700
                     hover:bg-green-200 disabled:opacity-50 transition-colors"
        >
          {loading ? '…' : '✓ paid'}
        </button>
      )}
      {current !== 'cancelled' && (
        <button
          onClick={cancel}
          disabled={loading}
          className="px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-500
                     hover:bg-red-100 hover:text-red-600 disabled:opacity-50 transition-colors"
        >
          {loading ? '…' : '✕'}
        </button>
      )}
    </div>
  )
}
