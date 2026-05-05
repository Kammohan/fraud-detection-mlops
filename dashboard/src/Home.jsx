import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// ── Animated counter ──────────────────────────────────────────────────────────
function useCountUp(target, duration = 1800) {
  const [value, setValue] = useState(0)
  const animated = useRef(false)

  useEffect(() => {
    if (!target) return
    if (animated.current) {
      setValue(target)
      return
    }
    animated.current = true
    const start = Date.now()
    const timer = setInterval(() => {
      const p = Math.min((Date.now() - start) / duration, 1)
      setValue(Math.floor((1 - Math.pow(1 - p, 3)) * target))
      if (p >= 1) clearInterval(timer)
    }, 16)
    return () => clearInterval(timer)
  }, [target])
  return value
}

// ── Intersection observer hook ────────────────────────────────────────────────
function useVisible(id, threshold = 0.15) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = document.querySelector(`[data-id="${id}"]`)
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true) }, { threshold })
    obs.observe(el)
    return () => obs.disconnect()
  }, [id])
  return visible
}

// ── Data ──────────────────────────────────────────────────────────────────────
const PIPELINE = [
  {
    step: '01', name: 'Data Producer', tech: 'Python · confluent-kafka',
    color: 'from-violet-500 to-purple-600', border: 'border-violet-500/30', dot: 'bg-violet-500',
    description: 'Reads 284,807 real credit card transactions from the Kaggle dataset and streams them into Kafka at exactly 50 transactions per second — simulating live point-of-sale activity across a card network.',
    bullets: ['284k transactions · 0.17% fraud rate', '50 tx/sec sustained throughput', 'Loops continuously · graceful SIGTERM shutdown'],
  },
  {
    step: '02', name: 'Apache Kafka', tech: 'KRaft mode · Confluent image',
    color: 'from-blue-500 to-cyan-500', border: 'border-blue-500/30', dot: 'bg-blue-500',
    description: 'Single-broker Kafka running in KRaft mode — self-managed metadata, no Zookeeper dependency. The live-transactions topic has 3 partitions, decoupling the producer from the inference engine entirely.',
    bullets: ['KRaft mode — Zookeeper-free, modern', '3 partitions · replication factor 1', 'Durable message log · consumer group offset tracking'],
  },
  {
    step: '03', name: 'Inference Engine', tech: 'FastAPI · XGBoost · psycopg2',
    color: 'from-emerald-500 to-green-500', border: 'border-emerald-500/30', dot: 'bg-emerald-500',
    description: 'Kafka consumer that loads a pre-trained XGBoost model at startup. Each message is deserialized, features are scaled, and the model outputs a fraud probability in real time. Transactions above 0.85 are flagged.',
    bullets: ['XGBoost gradient boosted ensemble', 'scale_pos_weight=577 corrects 577:1 class imbalance', 'FastAPI serves metrics + audit queries to dashboard'],
  },
  {
    step: '04', name: 'PostgreSQL', tech: 'Postgres 16 · named Docker volume',
    color: 'from-sky-500 to-blue-600', border: 'border-sky-500/30', dot: 'bg-sky-500',
    description: 'Append-only audit ledger storing every scored transaction with its fraud probability, flag status, and timestamp. Persists across container restarts. Required in production FinTech for regulatory compliance.',
    bullets: ['Full audit trail — every model decision logged', 'Persists across restarts via named volume', 'Stores: tx_id, amount, fraud_score, flagged, timestamp'],
  },
  {
    step: '05', name: 'React Dashboard', tech: 'React 18 · Vite · Recharts · Tailwind',
    color: 'from-rose-500 to-pink-600', border: 'border-rose-500/30', dot: 'bg-rose-500',
    description: 'Live monitoring dashboard polling the FastAPI every second. Shows transaction volume over time, fraud score distribution across all scored transactions, real-time alerts, and model performance metadata.',
    bullets: ['1-second REST polling — no WebSocket complexity', 'Recharts area + bar charts for ML insights', 'Score distribution visualizes model confidence separation'],
  },
]

const MODEL_METRICS = [
  { label: 'ROC-AUC',   value: '0.9747', desc: 'Area under the receiver operating characteristic curve. Measures separability between fraud and legitimate transactions across all thresholds.' },
  { label: 'Precision', value: '78%',    desc: 'Of all transactions flagged as fraud, 78% were actual fraud. High precision reduces false alarms that waste investigator time.' },
  { label: 'Recall',    value: '84%',    desc: 'Of all real fraud cases, 84% were caught. High recall is critical — missing fraud is worse than a false alarm in most risk models.' },
  { label: 'F1 Score',  value: '0.81',   desc: 'Harmonic mean of precision and recall. More meaningful than accuracy on this 577:1 imbalanced dataset where accuracy is misleading.' },
  { label: 'Threshold', value: '0.85',   desc: 'Decision boundary tuned above the default 0.5 to minimize false positives. Reflects the real-world cost asymmetry: false alarms erode customer trust.' },
  { label: 'Class Ratio', value: '577:1', desc: 'Only 492 fraud cases in 284,807 transactions. Handled via XGBoost\'s scale_pos_weight parameter — equivalent to oversampling the minority class.' },
]

const STACK = [
  { name: 'Apache Kafka', role: 'Event Streaming', desc: 'Industry-standard distributed message broker. KRaft mode (no Zookeeper) is the modern architecture used in production deployments.' },
  { name: 'XGBoost', role: 'ML Model', desc: 'Gradient boosted trees trained on the Kaggle credit card fraud dataset. scale_pos_weight handles the 577:1 class imbalance that breaks naive models.' },
  { name: 'FastAPI', role: 'Inference API', desc: 'Async Python API. The Kafka consumer runs in a background thread while FastAPI handles HTTP — both in the same process, no extra infrastructure.' },
  { name: 'PostgreSQL', role: 'Audit Ledger', desc: 'Append-only store for every scored transaction. Named Docker volume ensures data persists across container restarts and redeployments.' },
  { name: 'Docker Compose', role: 'Orchestration', desc: 'Health checks and depends_on conditions guarantee correct startup order. All five services start with a single command.' },
  { name: 'Recharts', role: 'Visualization', desc: 'Real-time score distribution chart exposes the model\'s bimodal output — most transactions cluster near 0, fraud clusters near 1.0.' },
]

// ── Components ────────────────────────────────────────────────────────────────
function LiveStat({ label, rawValue, format = v => v.toLocaleString(), sub }) {
  const counted = useCountUp(rawValue)
  return (
    <div className="text-center">
      <div className="text-4xl md:text-5xl font-bold text-white tabular-nums">
        {rawValue ? format(counted) : '—'}
      </div>
      <div className="text-slate-400 text-sm mt-2">{label}</div>
      {sub && <div className="text-slate-600 text-xs mt-0.5">{sub}</div>}
    </div>
  )
}

function PipelineStep({ item, index }) {
  const visible = useVisible(`step-${index}`)
  return (
    <div
      data-id={`step-${index}`}
      className={`relative flex gap-5 transition-all duration-700 ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'}`}
      style={{ transitionDelay: `${index * 70}ms` }}
    >
      <div className={`shrink-0 h-12 w-12 rounded-full bg-gradient-to-br ${item.color} flex items-center justify-center text-white font-bold text-sm shadow-lg z-10`}>
        {item.step}
      </div>
      <div className={`flex-1 rounded-2xl border ${item.border} bg-slate-900/50 p-5 hover:bg-slate-900/80 transition-colors`}>
        <div className="flex flex-wrap items-baseline gap-3 mb-2">
          <h3 className="text-white font-semibold text-base">{item.name}</h3>
          <span className="text-xs font-mono text-slate-500">{item.tech}</span>
        </div>
        <p className="text-slate-400 text-sm leading-relaxed mb-3">{item.description}</p>
        <div className="flex flex-wrap gap-2">
          {item.bullets.map(b => (
            <span key={b} className={`text-xs px-3 py-1 rounded-full bg-slate-800 border ${item.border} text-slate-300`}>{b}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

function ModelMetricCard({ item, index }) {
  const visible = useVisible(`metric-${index}`)
  return (
    <div
      data-id={`metric-${index}`}
      className={`rounded-2xl border border-slate-800 bg-slate-900/50 p-5 hover:border-slate-600 transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'}`}
      style={{ transitionDelay: `${index * 60}ms` }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">{item.label}</span>
        <span className="text-2xl font-bold text-emerald-400">{item.value}</span>
      </div>
      <p className="text-slate-500 text-xs leading-relaxed">{item.desc}</p>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Home() {
  const navigate = useNavigate()
  const [metrics, setMetrics] = useState(null)

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch(`${API}/metrics`)
        setMetrics(await res.json())
      } catch {}
    }
    fetch_()
    const id = setInterval(fetch_, 2000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">

      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
            <span className="font-bold text-white text-sm">FraudDetect</span>
            <span className="text-slate-600 text-sm hidden sm:inline">· MLOps Pipeline</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="https://github.com/Kammohan/fraud-detection-mlops" target="_blank" rel="noreferrer"
              className="text-sm text-slate-400 hover:text-white transition-colors hidden sm:inline">
              GitHub
            </a>
            <button onClick={() => navigate('/dashboard')}
              className="text-sm bg-white text-slate-950 font-bold px-4 py-1.5 rounded-full hover:bg-slate-200 transition-colors">
              Live Dashboard →
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-36 pb-24 px-6 max-w-6xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-slate-800/60 border border-slate-700 rounded-full px-4 py-1.5 text-xs text-slate-400 mb-8">
          <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
          5-container system · processing live transactions now
        </div>

        <h1 className="text-5xl md:text-7xl font-bold text-white leading-[1.05] tracking-tight max-w-4xl">
          Real-Time{' '}
          <span className="bg-gradient-to-r from-violet-400 via-blue-400 to-emerald-400 bg-clip-text text-transparent">
            Fraud Detection
          </span>
          <br />MLOps Pipeline
        </h1>

        <p className="mt-6 text-lg text-slate-400 max-w-2xl leading-relaxed">
          A production-grade microservices system that scores credit card transactions for fraud
          in real time using Kafka event streaming and an XGBoost gradient boosted model —
          built to mirror how FinTech fraud teams operate at scale.
        </p>

        <div className="flex flex-wrap gap-3 mt-10">
          <button onClick={() => navigate('/dashboard')}
            className="bg-white text-slate-950 font-bold px-6 py-3 rounded-xl hover:bg-slate-100 transition-colors text-sm">
            View Live Dashboard →
          </button>
          <a href="https://github.com/Kammohan/fraud-detection-mlops" target="_blank" rel="noreferrer"
            className="border border-slate-700 text-slate-300 font-medium px-6 py-3 rounded-xl hover:border-slate-500 hover:text-white transition-colors text-sm">
            View on GitHub
          </a>
        </div>

        {/* Live stats with count-up */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 border border-slate-800 rounded-2xl px-8 py-10 bg-slate-900/40">
          <LiveStat label="Transactions Scored" rawValue={metrics?.total_processed} />
          <LiveStat label="Fraud Cases Flagged" rawValue={metrics?.total_flagged} />
          <LiveStat label="Fraud Rate" rawValue={metrics?.fraud_rate_pct} format={v => `${v.toFixed(3)}%`} sub="dataset avg: 0.173%" />
          <LiveStat label="Model ROC-AUC" rawValue={0.9747} format={v => v.toFixed(4)} sub="on 20% held-out test set" />
        </div>
      </section>

      {/* Pipeline */}
      <section className="py-24 px-6 max-w-6xl mx-auto border-t border-slate-800">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">How It Works</p>
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">The pipeline, container by container</h2>
        <p className="text-slate-400 mb-12 max-w-xl text-sm leading-relaxed">
          Each service has exactly one responsibility. They communicate through Kafka (events) and HTTP (queries) — loosely coupled, independently restartable.
        </p>
        <div className="relative flex flex-col gap-5">
          <div className="absolute left-6 top-10 bottom-10 w-px bg-gradient-to-b from-violet-500/30 via-emerald-500/30 to-rose-500/30 hidden md:block" />
          {PIPELINE.map((item, i) => <PipelineStep key={item.step} item={item} index={i} />)}
        </div>
      </section>

      {/* Data flow */}
      <section className="py-24 px-6 max-w-6xl mx-auto border-t border-slate-800">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Architecture</p>
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-10">End-to-end data flow</h2>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 md:p-8 overflow-x-auto">
          <div className="flex items-center gap-2 min-w-[700px]">
            {[
              { label: 'creditcard.csv', sub: '284k rows', color: 'bg-slate-700' },
              { label: 'Producer',       sub: '50 tx/sec', color: 'bg-violet-600' },
              { label: 'Kafka',          sub: 'live-transactions', color: 'bg-blue-600' },
              { label: 'Inference',      sub: 'XGBoost scoring', color: 'bg-emerald-600' },
              { label: 'PostgreSQL',     sub: 'audit ledger', color: 'bg-sky-600' },
              { label: 'Dashboard',      sub: 'React · 1s poll', color: 'bg-rose-600' },
            ].map((n, i, arr) => (
              <div key={n.label} className="flex items-center gap-2 flex-1 min-w-0">
                <div className={`${n.color} rounded-xl px-3 py-3 flex-1 text-center`}>
                  <div className="text-white font-semibold text-xs md:text-sm">{n.label}</div>
                  <div className="text-white/50 text-xs mt-0.5 hidden md:block">{n.sub}</div>
                </div>
                {i < arr.length - 1 && <span className="text-slate-600 shrink-0">→</span>}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5 text-xs text-slate-400 min-w-[700px]">
            <div className="bg-slate-800/50 rounded-lg p-3">
              <p className="text-slate-300 font-semibold mb-1">Producer → Kafka</p>
              Each row serialized to JSON, keyed by UUID. Sent over <span className="font-mono text-slate-400">PLAINTEXT_INTERNAL://kafka:29092</span> on the Docker bridge network.
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <p className="text-slate-300 font-semibold mb-1">Kafka → Inference</p>
              Consumer group <span className="font-mono text-slate-400">inference-engine</span> polls messages. Each is deserialized, features scaled, then passed to <span className="font-mono text-slate-400">model.predict_proba()</span>.
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <p className="text-slate-300 font-semibold mb-1">Inference → Dashboard</p>
              Dashboard GETs <span className="font-mono text-slate-400">/metrics</span>, <span className="font-mono text-slate-400">/metrics/history</span>, <span className="font-mono text-slate-400">/metrics/distribution</span> every second via FastAPI.
            </div>
          </div>
        </div>
      </section>

      {/* Model performance */}
      <section className="py-24 px-6 max-w-6xl mx-auto border-t border-slate-800">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">ML Model</p>
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">Model performance & design decisions</h2>
        <p className="text-slate-400 mb-10 max-w-2xl text-sm leading-relaxed">
          Trained on the Kaggle Credit Card Fraud dataset. The core challenge is extreme class imbalance —
          accuracy alone is meaningless when 99.83% of transactions are legitimate. Every metric and design
          choice below addresses that directly.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {MODEL_METRICS.map((item, i) => <ModelMetricCard key={item.label} item={item} index={i} />)}
        </div>
        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/40 px-6 py-5 text-sm text-slate-400 leading-relaxed">
          <span className="text-slate-300 font-semibold">Features: </span>
          V1–V28 are principal components from PCA applied to the original transaction data — anonymized for privacy.
          Time (seconds from first transaction) and Amount are the only raw features. Amount is standardized with
          <span className="font-mono text-slate-300"> StandardScaler</span> before inference to match training distribution.
        </div>
      </section>

      {/* Tech stack */}
      <section className="py-24 px-6 max-w-6xl mx-auto border-t border-slate-800">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Tech Stack</p>
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">Built with production tools</h2>
        <p className="text-slate-400 mb-10 max-w-xl text-sm">Every technology here mirrors what real ML platform and FinTech engineering teams use at scale.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {STACK.map((item, i) => (
            <div key={item.name}
              data-id={`stack-${i}`}
              className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 hover:border-slate-600 transition-colors">
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-white font-semibold">{item.name}</span>
                <span className="text-xs font-mono text-slate-500">{item.role}</span>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 max-w-6xl mx-auto border-t border-slate-800 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Everything is running right now</h2>
        <p className="text-slate-400 mb-3 max-w-lg mx-auto text-sm">
          Every number on the dashboard is a real transaction that went through the model.
          The score distribution shows the model's actual output — not mocked data.
        </p>
        <p className="text-slate-600 text-xs mb-8">
          {metrics ? `${metrics.total_processed.toLocaleString()} transactions scored · ${metrics.total_flagged} fraud cases detected` : ''}
        </p>
        <button onClick={() => navigate('/dashboard')}
          className="bg-white text-slate-950 font-bold px-8 py-4 rounded-xl hover:bg-slate-100 transition-colors text-sm">
          Open Live Dashboard →
        </button>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-xs text-slate-600">
          <span>Fraud Detection MLOps Pipeline</span>
          <a href="https://github.com/Kammohan/fraud-detection-mlops" target="_blank" rel="noreferrer"
            className="hover:text-slate-400 transition-colors">
            github.com/Kammohan/fraud-detection-mlops
          </a>
        </div>
      </footer>

    </div>
  )
}
