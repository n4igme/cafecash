'use client'
import { useState } from 'react'
import PocketBase from 'pocketbase'

const API_URL = process.env.NEXT_PUBLIC_API_URL!

export default function RefundOrderButton({
  orderId,
  token,
}: {
  orderId: string
  token: string | null
}) {
  const [loading,    setLoading]    = useState(false)
  const [refunded,   setRefunded]   = useState(false)
  const [showReason, setShowReason] = useState(false)
  const [reason,     setReason]     = useState('')

  if (refunded) {
    return (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-600 text-center">
        Refunded
      </span>
    )
  }

  const doRefund = async () => {
    if (!reason.trim()) return
    setLoading(true)
    try {
      const pb = new PocketBase(API_URL)
      pb.autoCancellation(false)
      if (token) pb.authStore.save(token, null)
      await pb.collection('orders').update(orderId, {
        status: 'refunded',
        refund_reason: reason.trim(),
      })
      setRefunded(true)
      setShowReason(false)
    } finally {
      setLoading(false)
    }
  }

  if (showReason) {
    return (
      <div className="flex flex-col gap-1 min-w-[140px]">
        <input
          autoFocus
          className="border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-red-400"
          placeholder="Reason…"
          value={reason}
          onChange={e => setReason(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && doRefund()}
        />
        <div className="flex gap-1">
          <button
            onClick={() => setShowReason(false)}
            className="flex-1 py-1 text-xs border border-slate-200 rounded hover:bg-slate-50 text-slate-500">
            ✕
          </button>
          <button
            onClick={doRefund}
            disabled={loading || !reason.trim()}
            className="flex-1 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50">
            {loading ? '…' : 'Refund'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={() => setShowReason(true)}
      className="px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-500
                 hover:bg-red-100 hover:text-red-600 transition-colors text-center w-full">
      Refund
    </button>
  )
}
