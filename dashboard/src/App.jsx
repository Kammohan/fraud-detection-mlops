import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ResponsiveContainer, AreaChart, Area,
  BarChart, Bar, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60)  return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

const BUCKET_COLORS = [
  '#22c55e','#84cc16','#eab308','#f97316',
  '#ef4444','#dc2626','#b91c1c','#991b1b','#7f1d1d','#450a0a',
]

// ── Sub-components ────────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, accent, icon }) {
  return (
    <div className={`rounded-xl p-4 bg-slate-800/80 border ${accent ? 'border-red-500/50' : 'border-slate-700/60'} flex flex-col gap-1`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</span>
        <span className="text-slate-600 text-sm">{icon}</span>
      </div>
      <span className={`text-3xl font-bold tabular-nums ${accent ? 'text-red-400' : 'text-white'}`}>{value}</span>
      {sub && <span className="text-xs text-slate-500">{sub}</span>}
    </div>
  )
}

const VolumeTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs">
      <p className="text-slate-400 mb-1">{label}</p>
      <p className="text-blue-400">{payload[0]?.value?.toLocaleString()} transactions</p>
      {payload[1]?.value > 0 && <p className="text-red-400">{payload[1].value} flagged</p>}
    </div>
  )
}

const DistTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const bucket = payload[0]?.payload?.bucket
  const count  = payload[0]?.value
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs">
      <p className="text-slate-400">Score {bucket}–{(parseFloat(bucket) + 0.1).toFixed(1)}</p>
      <p className="text-white font-semibold">{count?.toLocaleString()} transactions</p>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function App() {
  const navigate = useNavigate()
  const [metrics,      setMetrics]      = useState(null)
  const [transactions, setTransactions] = useState([])
  const [alerts,       setAlerts]       = useState([])
  const [history,      setHistory]      = useState([])
  const [distribution, setDistribution] = useState([])
  const [connected,    setConnected]    = useState(false)

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [mR, tR, aR, hR, dR] = await Promise.all([
          fetch(`${API}/metrics`),
          fetch(`${API}/transactions/recent?limit=50`),
          fetch(`${API}/transactions/fraud?limit=20`),
          fetch(`${API}/metrics/history`),
          fetch(`${API}/metrics/distribution`),
        ])
        const [m, t, a, h, d] = await Promise.all([mR.json(), tR.json(), aR.json(), hR.json(), dR.json()])
        setMetrics(m)
        setTransactions(t.transactions || [])
        setAlerts(a.alerts || [])
        setHistory(h.history || [])
        setDistribution(d.distribution || [])
        setConnected(true)
      } catch {
        setConnected(false)
      }
    }
    fetchAll()
    const id = setInterval(fetchAll, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="min-h-screen bg-slate-950 p-5 max-w-screen-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <button onClick={() => navigate('/')} className="text-xs text-slate-600 hover:text-slate-400 transition-colors flex items-center gap-1">
              ← Overview
            </button>
            <button onClick={() => navigate('/model')} className="text-xs text-slate-600 hover:text-slate-400 transition-colors flex items-center gap-1">
              Model Insights →
            </button>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Live Inference Monitor</h1>
          <p className="text-slate-500 text-xs mt-0.5">XGBoost · 30 features · threshold 0.85 · 50 tx/sec</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className={`h-2 w-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`} />
          <span className={`text-sm font-medium ${connected ? 'text-green-400' : 'text-red-400'}`}>
            {connected ? 'Pipeline Active' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <MetricCard label="Transactions Scored" value={metrics?.total_processed.toLocaleString() ?? '—'} sub="all time" icon="⬡" />
        <MetricCard label="Fraud Flagged" value={metrics?.total_flagged.toLocaleString() ?? '—'} sub="score > 0.85" accent={metrics?.total_flagged > 0} icon="⚑" />
        <MetricCard label="Fraud Rate" value={metrics ? `${metrics.fraud_rate_pct.toFixed(3)}%` : '—'} sub="of all transactions" accent={metrics?.fraud_rate_pct > 0.1} icon="%" />
        <MetricCard label="Avg Fraud Score" value={metrics ? metrics.avg_fraud_score.toFixed(4) : '—'} sub="mean probability" icon="~" />
        <MetricCard label="Model ROC-AUC" value="0.9747" sub="on 20% test set" icon="◎" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">

        {/* Volume over time */}
        <div className="lg:col-span-2 bg-slate-900 rounded-xl border border-slate-800 p-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-white">Transaction Volume</p>
              <p className="text-xs text-slate-500 mt-0.5">Transactions per minute · last 20 min</p>
            </div>
            <span className="text-xs text-slate-600 bg-slate-800 px-2 py-1 rounded-full">live</span>
          </div>
          {history.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-slate-600 text-sm">Collecting data…</div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={history} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="fraudGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="minute" tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip content={<VolumeTooltip />} />
                <Area type="monotone" dataKey="count"   stroke="#3b82f6" fill="url(#volGrad)"   strokeWidth={2} dot={false} name="transactions" />
                <Area type="monotone" dataKey="flagged" stroke="#ef4444" fill="url(#fraudGrad)" strokeWidth={1.5} dot={false} name="flagged" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Score distribution */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <div className="mb-4">
            <p className="text-sm font-semibold text-white">Score Distribution</p>
            <p className="text-xs text-slate-500 mt-0.5">Fraud probability buckets · all transactions</p>
          </div>
          {distribution.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-slate-600 text-sm">Loading…</div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={distribution} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="bucket" tick={{ fill: '#475569', fontSize: 9 }} tickLine={false} axisLine={false} />
                <YAxis scale="log" domain={[1, 'auto']} allowDataOverflow tick={{ fill: '#475569', fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                <Tooltip content={<DistTooltip />} />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {distribution.map((_, i) => (
                    <Cell key={i} fill={BUCKET_COLORS[i] || '#450a0a'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
          <p className="text-xs text-slate-600 mt-2 text-center">Green = legitimate · Red = fraud</p>
        </div>
      </div>

      {/* Model metadata strip */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 px-5 py-3 mb-4 flex flex-wrap gap-x-8 gap-y-2 items-center">
        <div>
          <span className="text-xs text-slate-500 uppercase tracking-widest">Algorithm</span>
          <p className="text-sm font-semibold text-white mt-0.5">XGBoost · Gradient Boosted Ensemble</p>
        </div>
        <div className="w-px h-8 bg-slate-800 hidden md:block" />
        <div>
          <span className="text-xs text-slate-500 uppercase tracking-widest">Features</span>
          <p className="text-sm font-semibold text-white mt-0.5">30 · Time, V1–V28 (PCA), Amount</p>
        </div>
        <div className="w-px h-8 bg-slate-800 hidden md:block" />
        <div>
          <span className="text-xs text-slate-500 uppercase tracking-widest">Class Imbalance</span>
          <p className="text-sm font-semibold text-white mt-0.5">577 : 1 · corrected via scale_pos_weight</p>
        </div>
        <div className="w-px h-8 bg-slate-800 hidden md:block" />
        <div>
          <span className="text-xs text-slate-500 uppercase tracking-widest">Decision Threshold</span>
          <p className="text-sm font-semibold text-white mt-0.5">0.85 · calibrated to minimize false positives</p>
        </div>
        <div className="w-px h-8 bg-slate-800 hidden md:block" />
        <div className="flex gap-5">
          {[['Precision','78%'],['Recall','84%'],['F1','81%'],['ROC-AUC','0.9747']].map(([k,v]) => (
            <div key={k} className="text-center">
              <p className="text-xs text-slate-500">{k}</p>
              <p className="text-sm font-bold text-emerald-400">{v}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Feed + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Transaction feed */}
        <div className="lg:col-span-2 bg-slate-900 rounded-xl border border-slate-800 flex flex-col">
          <div className="px-4 pt-4 pb-3 border-b border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-white">Live Transaction Feed</p>
              <span className="text-xs text-slate-600">{transactions.length} most recent</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Every credit card transaction streamed from Kafka is scored by the XGBoost model in real time.
              The <span className="text-slate-300 font-medium">AI Risk Score</span> is the model's confidence (0–1) that the transaction is fraudulent.
              Anything above <span className="text-red-400 font-medium">0.85</span> is automatically flagged.
            </p>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 px-4 py-2 border-b border-slate-800/60 bg-slate-800/20">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Legitimate — score below 0.85
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
              Flagged as fraud — score above 0.85
            </div>
          </div>

          <div className="grid grid-cols-[1fr_90px_140px_70px_64px] text-xs text-slate-600 px-4 py-2 border-b border-slate-800/40">
            <span>Transaction ID</span>
            <span className="text-right">Amount</span>
            <span className="text-center">AI Risk Score</span>
            <span className="text-center">Result</span>
            <span className="text-right">Time</span>
          </div>

          <div className="overflow-y-auto max-h-[400px] flex flex-col gap-1 p-2">
            {transactions.length === 0 ? (
              <p className="text-slate-600 text-sm text-center py-10">Waiting for transactions…</p>
            ) : transactions.map(tx => {
              const score = Number(tx.fraud_score)
              const riskColor = tx.flagged ? 'text-red-400' : score > 0.5 ? 'text-orange-400' : 'text-slate-500'
              const barColor  = tx.flagged ? 'bg-red-500' : score > 0.5 ? 'bg-orange-400' : 'bg-emerald-500/40'
              return (
                <div key={tx.transaction_id}
                  className={`grid grid-cols-[1fr_90px_140px_70px_64px] items-center px-3 py-2 rounded-lg text-sm
                    ${tx.flagged
                      ? 'bg-red-950/50 border border-red-500/20'
                      : 'bg-slate-800/40 border border-transparent hover:border-slate-700/40'}`}>

                  <div className="flex items-center gap-2 min-w-0">
                    {tx.flagged && (
                      <span className="relative flex h-1.5 w-1.5 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                      </span>
                    )}
                    <span className="font-mono text-slate-400 truncate text-xs">TXN-{tx.transaction_id.slice(0, 8).toUpperCase()}</span>
                  </div>

                  <span className="text-slate-300 text-right text-xs font-medium">${Number(tx.amount).toFixed(2)}</span>

                  <div className="flex items-center gap-2 px-2">
                    <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${score * 100}%` }} />
                    </div>
                    <span className={`font-mono text-xs w-10 text-right shrink-0 ${riskColor}`}>{score.toFixed(3)}</span>
                  </div>

                  <span className={`text-center text-xs font-bold ${tx.flagged ? 'text-red-400' : 'text-emerald-500'}`}>
                    {tx.flagged ? 'FRAUD' : 'CLEAR'}
                  </span>
                  <span className="text-right text-xs text-slate-600">{timeAgo(tx.timestamp)}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Fraud alerts */}
        <div className="bg-slate-900 rounded-xl border border-red-900/30 flex flex-col">
          <div className="px-4 pt-4 pb-3 border-b border-red-900/30">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-red-400">Fraud Alerts</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${alerts.length > 0 ? 'bg-red-500/20 text-red-400' : 'text-slate-600'}`}>
                {alerts.length} detected
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Transactions where the model returned a fraud probability <span className="text-red-400 font-medium">above 0.85</span>.
              These would trigger a hold or manual review in a real card network.
            </p>
          </div>

          <div className="overflow-y-auto max-h-[460px] flex flex-col gap-2 p-2">
            {alerts.length === 0 ? (
              <p className="text-slate-600 text-sm text-center py-10">No fraud detected yet</p>
            ) : alerts.map(a => {
              const score = Number(a.fraud_score)
              const confidence = score >= 0.99 ? 'Extremely High' : score >= 0.95 ? 'Very High' : 'High'
              return (
                <div key={a.transaction_id} className="rounded-lg bg-red-950/60 border border-red-500/30 p-3 slide-in">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="relative flex h-2 w-2 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                      </span>
                      <span className="font-mono text-red-300 text-xs font-semibold">TXN-{a.transaction_id.slice(0,8).toUpperCase()}</span>
                    </div>
                    <span className="text-xs text-slate-500">{timeAgo(a.timestamp)}</span>
                  </div>

                  <div className="flex items-end justify-between mb-2">
                    <div>
                      <p className="text-xs text-slate-500 mb-0.5">Transaction Amount</p>
                      <p className="text-white font-bold text-lg">${Number(a.amount).toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500 mb-0.5">Model Confidence</p>
                      <p className="text-red-400 font-bold font-mono">{(score * 100).toFixed(1)}%</p>
                    </div>
                  </div>

                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mb-1.5">
                    <div className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full" style={{ width: `${score * 100}%` }} />
                  </div>
                  <p className="text-xs text-red-400/70">{confidence} confidence · auto-flagged for review</p>
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}
