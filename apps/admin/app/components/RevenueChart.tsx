'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

interface DayData {
  day: string   // e.g. "Mon"
  revenue: number
  orders: number
}

const formatRupiah = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

export default function RevenueChart({ data }: { data: DayData[] }) {
  if (!data.length) return null

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-800">Revenue — Last 7 Days</h3>
        <span className="text-xs text-slate-400">paid orders only</span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            formatter={(value: number) => [formatRupiah(value), 'Revenue']}
            labelStyle={{ color: '#1e293b', fontWeight: 600 }}
            contentStyle={{
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
