import { useEffect, useRef, useState } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function MetricCard({ label, value, sub, accent }) {
  return (
    <div className={`rounded-xl p-5 bg-slate-800 border ${accent ? 'border-red-500/40' : 'border-slate-700'}`}>
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${accent ? 'text-red-400' : 'text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  )
}

function TxRow({ tx, isNew }) {
  return (
    <div className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm
      ${tx.flagged ? 'bg-red-950/60 border border-red-500/30' : 'bg-slate-800/60 border border-slate-700/30'}
      ${isNew ? 'slide-in' : ''}`}>
      <div className="flex items-center gap-2 min-w-0">
        {tx.flagged && (
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </span>
        )}
        <span className="font-mono text-slate-400 truncate">{tx.transaction_id.slice(0, 8)}</span>
      </div>
      <span className="text-slate-300 w-20 text-right">${Number(tx.amount).toFixed(2)}</span>
      <span className={`w-16 text-right font-mono ${tx.flagged ? 'text-red-400 font-bold' : 'text-slate-400'}`}>
        {Number(tx.fraud_score).toFixed(4)}
      </span>
      <span className={`text-xs px-2 py-0.5 rounded-full ml-1 ${tx.flagged ? 'bg-red-500/20 text-red-300' : 'bg-green-900/30 text-green-400'}`}>
        {tx.flagged ? 'FRAUD' : 'OK'}
      </span>
    </div>
  )
}

function AlertRow({ alert }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-lg text-sm bg-red-950/70 border border-red-500/40 slide-in">
      <div className="flex items-center gap-2 min-w-0">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
        </span>
        <span className="font-mono text-red-300 truncate">{alert.transaction_id.slice(0, 8)}</span>
      </div>
      <span className="text-slate-200 w-20 text-right font-semibold">${Number(alert.amount).toFixed(2)}</span>
      <span className="text-red-400 font-bold font-mono w-16 text-right">{Number(alert.fraud_score).toFixed(4)}</span>
    </div>
  )
}

export default function App() {
  const [metrics, setMetrics]         = useState(null)
  const [transactions, setTransactions] = useState([])
  const [alerts, setAlerts]           = useState([])
  const [connected, setConnected]     = useState(false)
  const prevTxIds = useRef(new Set())

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [mRes, tRes, aRes] = await Promise.all([
          fetch(`${API}/metrics`),
          fetch(`${API}/transactions/recent?limit=50`),
          fetch(`${API}/transactions/fraud?limit=20`),
        ])
        const [m, t, a] = await Promise.all([mRes.json(), tRes.json(), aRes.json()])
        setMetrics(m)
        setTransactions(t.transactions || [])
        setAlerts(a.alerts || [])
        setConnected(true)
      } catch {
        setConnected(false)
      }
    }

    fetchAll()
    const id = setInterval(fetchAll, 1000)
    return () => clearInterval(id)
  }, [])

  const newIds = new Set(transactions.slice(0, 5).map(t => t.transaction_id))

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Fraud Detection</h1>
          <p className="text-slate-400 text-sm mt-0.5">Real-time XGBoost inference pipeline</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className={`h-2 w-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`} />
          <span className={connected ? 'text-green-400' : 'text-red-400'}>
            {connected ? 'Live' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard
          label="Total Processed"
          value={metrics ? metrics.total_processed.toLocaleString() : '—'}
          sub="transactions scored"
        />
        <MetricCard
          label="Flagged"
          value={metrics ? metrics.total_flagged.toLocaleString() : '—'}
          sub={`threshold > 0.85`}
          accent={metrics?.total_flagged > 0}
        />
        <MetricCard
          label="Fraud Rate"
          value={metrics ? `${metrics.fraud_rate_pct.toFixed(3)}%` : '—'}
          sub="of all transactions"
          accent={metrics?.fraud_rate_pct > 0.1}
        />
        <MetricCard
          label="Avg Score"
          value={metrics ? metrics.avg_fraud_score.toFixed(4) : '—'}
          sub="mean fraud probability"
        />
      </div>

      {/* Feed + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Live feed */}
        <div className="lg:col-span-2 bg-slate-900 rounded-xl border border-slate-700 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
            <h2 className="font-semibold text-white text-sm">Live Transaction Feed</h2>
            <span className="text-xs text-slate-500">{transactions.length} shown</span>
          </div>
          <div className="flex text-xs text-slate-500 px-3 py-1.5 border-b border-slate-800">
            <span className="flex-1">TX ID</span>
            <span className="w-20 text-right">Amount</span>
            <span className="w-16 text-right">Score</span>
            <span className="w-16 text-right">Status</span>
          </div>
          <div className="overflow-y-auto max-h-[520px] flex flex-col gap-1 p-2">
            {transactions.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-10">Waiting for transactions…</p>
            ) : (
              transactions.map(tx => (
                <TxRow key={tx.transaction_id} tx={tx} isNew={newIds.has(tx.transaction_id)} />
              ))
            )}
          </div>
        </div>

        {/* Fraud alerts */}
        <div className="bg-slate-900 rounded-xl border border-red-900/40 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-red-900/40">
            <h2 className="font-semibold text-red-400 text-sm">Fraud Alerts</h2>
            <span className="text-xs text-red-500/70">{alerts.length} recent</span>
          </div>
          <div className="flex text-xs text-slate-500 px-3 py-1.5 border-b border-slate-800">
            <span className="flex-1">TX ID</span>
            <span className="w-20 text-right">Amount</span>
            <span className="w-16 text-right">Score</span>
          </div>
          <div className="overflow-y-auto max-h-[520px] flex flex-col gap-1 p-2">
            {alerts.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-10">No fraud detected yet</p>
            ) : (
              alerts.map(a => <AlertRow key={a.transaction_id} alert={a} />)
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
