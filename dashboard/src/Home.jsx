import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const PIPELINE = [
  {
    step: '01',
    name: 'Data Producer',
    tech: 'Python · confluent-kafka',
    color: 'from-violet-500 to-purple-600',
    border: 'border-violet-500/30',
    glow: 'shadow-violet-500/20',
    description: 'Streams 284,807 real credit card transactions from the Kaggle fraud dataset into Kafka at exactly 50 transactions per second — simulating live point-of-sale activity.',
    bullets: ['284k transactions, 0.17% fraud rate', '50 tx/sec sustained throughput', 'Graceful shutdown + CSV loop'],
  },
  {
    step: '02',
    name: 'Apache Kafka',
    tech: 'KRaft mode · No Zookeeper',
    color: 'from-blue-500 to-cyan-500',
    border: 'border-blue-500/30',
    glow: 'shadow-blue-500/20',
    description: 'Single-broker Kafka running in KRaft mode (self-managed, no Zookeeper). Routes every transaction message through the live-transactions topic with 3 partitions for parallelism.',
    bullets: ['KRaft mode — modern, no Zookeeper', '3 partitions · replication factor 1', 'Decouples producer from inference'],
  },
  {
    step: '03',
    name: 'Inference Engine',
    tech: 'FastAPI · XGBoost · Python',
    color: 'from-emerald-500 to-green-500',
    border: 'border-emerald-500/30',
    glow: 'shadow-emerald-500/20',
    description: 'Kafka consumer that loads a pre-trained XGBoost model at startup. Scores each transaction for fraud probability in real time, flags anything above 0.85, and persists every result.',
    bullets: ['XGBoost — ROC-AUC 0.9747', 'scale_pos_weight handles class imbalance', 'REST API for dashboard queries'],
  },
  {
    step: '04',
    name: 'PostgreSQL',
    tech: 'Postgres 16 · psycopg2',
    color: 'from-sky-500 to-blue-600',
    border: 'border-sky-500/30',
    glow: 'shadow-sky-500/20',
    description: 'Append-only audit ledger storing every scored transaction. Provides the compliance trail required in production FinTech systems — every decision is recorded with a timestamp.',
    bullets: ['Full audit trail — every transaction', 'Stores: amount, score, flagged, timestamp', 'Queried by FastAPI for dashboard'],
  },
  {
    step: '05',
    name: 'React Dashboard',
    tech: 'React · Vite · Tailwind CSS',
    color: 'from-rose-500 to-pink-600',
    border: 'border-rose-500/30',
    glow: 'shadow-rose-500/20',
    description: 'Live dashboard polling the FastAPI every second. Shows the full transaction feed, fraud alerts with pulse animations, and running metrics — all updating in real time.',
    bullets: ['1-second polling via REST', 'Fraud alerts with live pulse animation', 'Metrics: rate, score, flagged count'],
  },
]

const STACK = [
  { name: 'Apache Kafka', role: 'Message Broker', desc: 'Industry-standard event streaming. Used by LinkedIn, Uber, and every major bank for real-time data pipelines.' },
  { name: 'XGBoost', role: 'ML Model', desc: 'Gradient boosted trees. Trained with scale_pos_weight to handle 577:1 class imbalance. ROC-AUC 0.9747 on held-out test set.' },
  { name: 'FastAPI', role: 'Inference API', desc: 'Async Python API serving predictions and dashboard queries. Kafka consumer runs in a background thread alongside the HTTP server.' },
  { name: 'PostgreSQL', role: 'Audit Database', desc: 'Relational store for every scored transaction. Compliance requirement in FinTech — every model decision must be logged and queryable.' },
  { name: 'Docker Compose', role: 'Orchestration', desc: 'Five containers wired with health checks and depends_on so the stack boots in the correct order every time with a single command.' },
  { name: 'React + Vite', role: 'Dashboard', desc: 'Lightweight frontend polling the API every second. No WebSockets needed — REST polling is sufficient and simpler to operate.' },
]

function StatCard({ label, value, live }) {
  return (
    <div className="text-center">
      <div className={`text-4xl font-bold text-white tabular-nums ${live ? 'text-green-400' : ''}`}>{value}</div>
      <div className="text-slate-400 text-sm mt-1">{label}</div>
    </div>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const [metrics, setMetrics] = useState(null)
  const [visible, setVisible] = useState(new Set())

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch(`${API}/metrics`)
        setMetrics(await res.json())
      } catch {}
    }
    fetchMetrics()
    const id = setInterval(fetchMetrics, 2000)
    return () => clearInterval(id)
  }, [])

  // Intersection observer for scroll-in animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) setVisible(v => new Set([...v, e.target.dataset.id]))
      }),
      { threshold: 0.15 }
    )
    document.querySelectorAll('[data-id]').forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">

      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
            <span className="font-semibold text-white text-sm tracking-tight">FraudDetect</span>
            <span className="text-slate-600 text-sm">· MLOps Pipeline</span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/Kammohan/fraud-detection-mlops"
              target="_blank"
              rel="noreferrer"
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              GitHub
            </a>
            <button
              onClick={() => navigate('/dashboard')}
              className="text-sm bg-white text-slate-950 font-semibold px-4 py-1.5 rounded-full hover:bg-slate-200 transition-colors"
            >
              Live Dashboard →
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-36 pb-24 px-6 max-w-6xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-slate-800/60 border border-slate-700 rounded-full px-4 py-1.5 text-xs text-slate-400 mb-8">
          <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
          5-container system running live
        </div>

        <h1 className="text-5xl md:text-7xl font-bold text-white leading-tight tracking-tight max-w-4xl">
          Real-Time{' '}
          <span className="bg-gradient-to-r from-violet-400 via-blue-400 to-emerald-400 bg-clip-text text-transparent">
            Fraud Detection
          </span>
          <br />MLOps Pipeline
        </h1>

        <p className="mt-6 text-lg text-slate-400 max-w-2xl leading-relaxed">
          A production-grade microservices system that detects credit card fraud in real time.
          Kafka streams 50 transactions per second through an XGBoost model, flags anomalies,
          writes every decision to PostgreSQL, and surfaces everything on a live dashboard.
        </p>

        <div className="flex flex-wrap gap-4 mt-10">
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-white text-slate-950 font-semibold px-6 py-3 rounded-xl hover:bg-slate-100 transition-colors text-sm"
          >
            View Live Dashboard →
          </button>
          <a
            href="https://github.com/Kammohan/fraud-detection-mlops"
            target="_blank"
            rel="noreferrer"
            className="border border-slate-700 text-slate-300 font-medium px-6 py-3 rounded-xl hover:border-slate-500 hover:text-white transition-colors text-sm"
          >
            View on GitHub
          </a>
        </div>

        {/* Live metrics strip */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 border border-slate-800 rounded-2xl px-8 py-8 bg-slate-900/40">
          <StatCard
            label="Transactions Scored"
            value={metrics ? metrics.total_processed.toLocaleString() : '—'}
            live
          />
          <StatCard
            label="Fraud Cases Flagged"
            value={metrics ? metrics.total_flagged.toLocaleString() : '—'}
          />
          <StatCard
            label="Fraud Rate"
            value={metrics ? `${metrics.fraud_rate_pct.toFixed(3)}%` : '—'}
          />
          <StatCard
            label="Model ROC-AUC"
            value="0.9747"
          />
        </div>
      </section>

      {/* Pipeline walkthrough */}
      <section className="py-24 px-6 max-w-6xl mx-auto">
        <div className="mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">How It Works</p>
          <h2 className="text-3xl md:text-4xl font-bold text-white">The pipeline, step by step</h2>
          <p className="text-slate-400 mt-3 max-w-xl">
            Each container has one job. They communicate only through Kafka and HTTP — loosely coupled, independently deployable.
          </p>
        </div>

        <div className="relative">
          {/* Vertical connector line */}
          <div className="absolute left-[27px] top-10 bottom-10 w-px bg-gradient-to-b from-violet-500/40 via-emerald-500/40 to-rose-500/40 hidden md:block" />

          <div className="flex flex-col gap-6">
            {PIPELINE.map((item, i) => (
              <div
                key={item.step}
                data-id={`step-${i}`}
                className={`relative flex gap-6 transition-all duration-700 ${
                  visible.has(`step-${i}`) ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-6'
                }`}
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                {/* Step number bubble */}
                <div className={`shrink-0 h-14 w-14 rounded-full bg-gradient-to-br ${item.color} flex items-center justify-center text-white font-bold text-sm shadow-lg ${item.glow} z-10`}>
                  {item.step}
                </div>

                {/* Card */}
                <div className={`flex-1 rounded-2xl border ${item.border} bg-slate-900/60 p-6 hover:bg-slate-900/80 transition-colors`}>
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                    <div>
                      <h3 className="text-white font-semibold text-lg">{item.name}</h3>
                      <span className="text-xs text-slate-500 font-mono">{item.tech}</span>
                    </div>
                  </div>
                  <p className="text-slate-400 text-sm leading-relaxed mb-4">{item.description}</p>
                  <ul className="flex flex-wrap gap-2">
                    {item.bullets.map(b => (
                      <li key={b} className={`text-xs px-3 py-1 rounded-full bg-slate-800 border ${item.border} text-slate-300`}>
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Data flow diagram */}
      <section className="py-24 px-6 max-w-6xl mx-auto border-t border-slate-800">
        <div className="mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Architecture</p>
          <h2 className="text-3xl md:text-4xl font-bold text-white">Data flow</h2>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 overflow-x-auto">
          <div className="flex items-center justify-between gap-2 min-w-[640px]">
            {[
              { label: 'creditcard.csv', sub: '284k rows', color: 'bg-slate-700' },
              { label: 'Producer', sub: '50 tx/sec', color: 'bg-violet-600' },
              { label: 'Kafka', sub: 'live-transactions', color: 'bg-blue-600' },
              { label: 'Inference', sub: 'XGBoost scoring', color: 'bg-emerald-600' },
              { label: 'PostgreSQL', sub: 'audit ledger', color: 'bg-sky-600' },
              { label: 'Dashboard', sub: 'React · 1s poll', color: 'bg-rose-600' },
            ].map((node, i, arr) => (
              <div key={node.label} className="flex items-center gap-2 flex-1">
                <div className="flex-1 flex flex-col items-center">
                  <div className={`${node.color} rounded-xl px-4 py-3 w-full text-center`}>
                    <div className="text-white font-semibold text-sm">{node.label}</div>
                    <div className="text-white/60 text-xs mt-0.5">{node.sub}</div>
                  </div>
                </div>
                {i < arr.length - 1 && (
                  <div className="text-slate-500 text-lg shrink-0">→</div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-6 grid grid-cols-3 gap-4 text-xs text-slate-400 min-w-[640px]">
            <div className="bg-slate-800/50 rounded-lg p-3">
              <span className="text-slate-300 font-medium">Producer → Kafka</span><br />
              JSON messages over PLAINTEXT_INTERNAL:29092 on the Docker bridge network
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <span className="text-slate-300 font-medium">Kafka → Inference</span><br />
              Consumer group "inference-engine" pulls messages, scores each row with XGBoost
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <span className="text-slate-300 font-medium">Inference → Dashboard</span><br />
              Dashboard GETs /metrics + /transactions/recent every 1 second via FastAPI
            </div>
          </div>
        </div>
      </section>

      {/* Tech stack */}
      <section className="py-24 px-6 max-w-6xl mx-auto border-t border-slate-800">
        <div className="mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Tech Stack</p>
          <h2 className="text-3xl md:text-4xl font-bold text-white">Built with production tools</h2>
          <p className="text-slate-400 mt-3 max-w-xl">
            Every technology here mirrors what real FinTech and ML platform teams use at scale.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {STACK.map((item, i) => (
            <div
              key={item.name}
              data-id={`stack-${i}`}
              className={`rounded-2xl border border-slate-800 bg-slate-900/40 p-6 hover:border-slate-600 transition-all duration-500 ${
                visible.has(`stack-${i}`) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
              style={{ transitionDelay: `${i * 60}ms` }}
            >
              <div className="text-white font-semibold mb-1">{item.name}</div>
              <div className="text-xs text-slate-500 font-mono mb-3">{item.role}</div>
              <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 max-w-6xl mx-auto border-t border-slate-800 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">See it running live</h2>
        <p className="text-slate-400 mb-8 max-w-lg mx-auto">
          The pipeline is active right now. Every number on the dashboard is a real transaction that went through the model.
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          className="bg-white text-slate-950 font-semibold px-8 py-4 rounded-xl hover:bg-slate-100 transition-colors text-sm"
        >
          Open Live Dashboard →
        </button>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-xs text-slate-600">
          <span>Fraud Detection MLOps Pipeline</span>
          <a
            href="https://github.com/Kammohan/fraud-detection-mlops"
            target="_blank"
            rel="noreferrer"
            className="hover:text-slate-400 transition-colors"
          >
            github.com/Kammohan/fraud-detection-mlops
          </a>
        </div>
      </footer>
    </div>
  )
}
