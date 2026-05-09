import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ResponsiveContainer,
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  ReferenceLine,
} from 'recharts'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// ── Tooltip helpers ────────────────────────────────────────────────────────────
const ChartTip = ({ active, payload, labelKey, labelPrefix = '', lines }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs space-y-1">
      <p className="text-slate-400">{labelPrefix}{payload[0]?.payload?.[labelKey]}</p>
      {lines.map(({ key, color, label }) => {
        const v = payload.find(p => p.dataKey === key)?.value
        return v !== undefined
          ? <p key={key} style={{ color }}>{label}: <span className="font-semibold">{typeof v === 'number' ? v.toFixed(4) : v}</span></p>
          : null
      })}
    </div>
  )
}

// ── Section header ─────────────────────────────────────────────────────────────
function SectionTitle({ title, sub }) {
  return (
    <div className="mb-4">
      <p className="text-sm font-semibold text-white">{title}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Metric pill ────────────────────────────────────────────────────────────────
function MetricPill({ label, value, color = 'text-emerald-400' }) {
  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-3 text-center">
      <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  )
}

// ── Confusion matrix cell ──────────────────────────────────────────────────────
function CMCell({ label, count, sub, bg, text }) {
  return (
    <div className={`rounded-xl ${bg} border p-4 flex flex-col items-center justify-center text-center gap-1`}>
      <span className={`text-3xl font-bold tabular-nums ${text}`}>{count?.toLocaleString()}</span>
      <span className={`text-sm font-semibold ${text}`}>{label}</span>
      <span className="text-xs text-slate-400 leading-snug max-w-[120px]">{sub}</span>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Model() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/model/metrics`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500 text-sm">
        Loading model metrics…
      </div>
    )
  }

  if (!data || !data.eval_metrics) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        <p className="text-slate-400 text-sm">Model metrics not available — run <code className="font-mono text-slate-300 bg-slate-800 px-2 py-0.5 rounded">train.py</code> first.</p>
        <button onClick={() => navigate('/')} className="text-xs text-slate-600 hover:text-slate-400 transition-colors">← Back</button>
      </div>
    )
  }

  const { training_info, eval_metrics, confusion_matrix: cm, roc_curve, pr_curve, learning_curve, feature_importance, score_distribution } = data

  // Build chart datasets
  const learningData = learning_curve.rounds.map((r, i) => ({
    round: r,
    train: learning_curve.train_aucpr[i],
    test:  learning_curve.test_aucpr[i],
  }))

  const rocData = roc_curve.fpr.map((fpr, i) => ({ fpr, tpr: roc_curve.tpr[i] }))

  const prData = pr_curve.recall.map((rec, i) => ({ recall: rec, precision: pr_curve.precision[i] }))

  const importanceData = [...feature_importance].reverse()

  // Score distribution histogram (20 bins from 0 to 1)
  const bins = Array.from({ length: 20 }, (_, i) => ({ bin: `${(i * 0.05).toFixed(2)}`, fraud: 0, legit: 0 }))
  score_distribution.fraud.forEach(s => {
    const i = Math.min(Math.floor(s * 20), 19)
    bins[i].fraud++
  })
  score_distribution.legit_sample.forEach(s => {
    const i = Math.min(Math.floor(s * 20), 19)
    bins[i].legit++
  })

  return (
    <div className="min-h-screen bg-slate-950 p-5 max-w-screen-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <button onClick={() => navigate('/')} className="text-xs text-slate-600 hover:text-slate-400 transition-colors">← Overview</button>
            <button onClick={() => navigate('/dashboard')} className="text-xs text-slate-600 hover:text-slate-400 transition-colors">Live Dashboard →</button>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Model Training Insights</h1>
          <p className="text-slate-500 text-xs mt-0.5">XGBoost · Trained on {training_info?.n_train?.toLocaleString()} transactions · {training_info?.n_estimators} boosting rounds</p>
        </div>
        <div className="hidden md:flex flex-col items-end gap-1">
          <span className="text-xs text-slate-600">Test set · {training_info?.n_test?.toLocaleString()} transactions</span>
          <span className="text-xs text-slate-600">{training_info?.n_fraud_test} fraud cases ({((training_info?.n_fraud_test / training_info?.n_test) * 100).toFixed(3)}%)</span>
        </div>
      </div>

      {/* Key metrics strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <MetricPill label="ROC-AUC"      value={eval_metrics.roc_auc}                             color="text-emerald-400" />
        <MetricPill label="Avg Precision" value={eval_metrics.avg_precision}                       color="text-emerald-400" />
        <MetricPill label="Precision"     value={`${(eval_metrics.precision * 100).toFixed(1)}%`}  color="text-blue-400" />
        <MetricPill label="Recall"        value={`${(eval_metrics.recall * 100).toFixed(1)}%`}     color="text-blue-400" />
        <MetricPill label="F1 Score"      value={eval_metrics.f1}                                  color="text-violet-400" />
        <MetricPill label="Threshold"     value={training_info?.threshold}                         color="text-orange-400" />
      </div>

      {/* Learning curve + ROC curve */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

        {/* Learning curve */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <SectionTitle
            title="Learning Curve"
            sub="Area under Precision-Recall curve per boosting round — how the model improves as it adds each tree"
          />
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={learningData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="round" tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} label={{ value: 'Boosting Round', position: 'insideBottom', offset: -2, fill: '#475569', fontSize: 10 }} />
              <YAxis domain={[0, 1]} tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTip labelKey="round" labelPrefix="Round " lines={[{ key: 'train', color: '#60a5fa', label: 'Train AUCPR' }, { key: 'test', color: '#34d399', label: 'Test AUCPR' }]} />} />
              <Legend formatter={v => <span style={{ color: '#94a3b8', fontSize: 11 }}>{v === 'train' ? 'Train' : 'Test'}</span>} />
              <Line type="monotone" dataKey="train" stroke="#60a5fa" strokeWidth={2} dot={false} name="train" />
              <Line type="monotone" dataKey="test"  stroke="#34d399" strokeWidth={2} dot={false} name="test" />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs text-slate-600 mt-2">
            Train and test curves converging without diverging = the model generalizes well and is not overfitting.
          </p>
        </div>

        {/* ROC curve */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <SectionTitle
            title={`ROC Curve · AUC = ${eval_metrics.roc_auc}`}
            sub="True positive rate vs false positive rate at every possible threshold — higher area = better separation"
          />
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={rocData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="fpr" type="number" domain={[0, 1]} tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} label={{ value: 'False Positive Rate', position: 'insideBottom', offset: -2, fill: '#475569', fontSize: 10 }} />
              <YAxis domain={[0, 1]} tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTip labelKey="fpr" labelPrefix="FPR: " lines={[{ key: 'tpr', color: '#a78bfa', label: 'TPR' }]} />} />
              <ReferenceLine x={0} y={0} stroke="#334155" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="tpr" stroke="#a78bfa" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs text-slate-600 mt-2">
            A random classifier follows the diagonal. This model hugs the top-left corner — near-perfect separation.
          </p>
        </div>
      </div>

      {/* PR curve + Confusion matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

        {/* PR curve */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <SectionTitle
            title={`Precision-Recall Curve · AP = ${eval_metrics.avg_precision}`}
            sub="How precision trades off against recall — critical metric for imbalanced datasets where ROC can be misleading"
          />
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={prData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="recall" type="number" domain={[0, 1]} tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} label={{ value: 'Recall', position: 'insideBottom', offset: -2, fill: '#475569', fontSize: 10 }} />
              <YAxis domain={[0, 1]} tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTip labelKey="recall" labelPrefix="Recall: " lines={[{ key: 'precision', color: '#fb923c', label: 'Precision' }]} />} />
              <Line type="monotone" dataKey="precision" stroke="#fb923c" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs text-slate-600 mt-2">
            Avg precision (AP) = {eval_metrics.avg_precision} — significantly above the {((training_info?.n_fraud_test / training_info?.n_test)).toFixed(4)} baseline a random classifier would achieve.
          </p>
        </div>

        {/* Confusion matrix */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <SectionTitle
            title={`Confusion Matrix · threshold = ${training_info?.threshold}`}
            sub="Model predictions vs ground truth on the 20% held-out test set"
          />
          <div className="grid grid-cols-2 gap-3 mt-2">
            <CMCell
              label="True Positive"
              count={cm.tp}
              sub="Fraud correctly caught"
              bg="bg-emerald-950/60 border-emerald-500/30"
              text="text-emerald-400"
            />
            <CMCell
              label="False Positive"
              count={cm.fp}
              sub="Legitimate transactions flagged as fraud"
              bg="bg-orange-950/40 border-orange-500/20"
              text="text-orange-400"
            />
            <CMCell
              label="False Negative"
              count={cm.fn}
              sub="Fraud cases missed by the model"
              bg="bg-red-950/50 border-red-500/30"
              text="text-red-400"
            />
            <CMCell
              label="True Negative"
              count={cm.tn}
              sub="Legitimate transactions correctly cleared"
              bg="bg-slate-800/60 border-slate-700/40"
              text="text-slate-300"
            />
          </div>
          <p className="text-xs text-slate-600 mt-3">
            Precision = TP/(TP+FP) = {cm.tp}/{cm.tp + cm.fp} = {(cm.tp / (cm.tp + cm.fp) * 100).toFixed(1)}% ·
            Recall = TP/(TP+FN) = {cm.tp}/{cm.tp + cm.fn} = {(cm.tp / (cm.tp + cm.fn) * 100).toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Feature importance */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 mb-4">
        <SectionTitle
          title="Feature Importance (Top 20)"
          sub="XGBoost gain importance — how much each feature contributes to reducing loss across all trees"
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={importanceData} layout="vertical" margin={{ top: 4, right: 16, left: 20, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => v.toFixed(2)} />
              <YAxis type="category" dataKey="feature" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  return (
                    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs">
                      <p className="text-slate-300 font-semibold">{payload[0]?.payload?.feature}</p>
                      <p className="text-emerald-400">importance: {payload[0]?.value?.toFixed(6)}</p>
                    </div>
                  )
                }}
              />
              <Bar dataKey="importance" fill="#34d399" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>

          <div className="flex flex-col justify-center gap-3">
            <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-4 text-sm text-slate-400 leading-relaxed">
              <p className="text-white font-semibold mb-2">Why V14 dominates</p>
              <p>
                V1–V28 are PCA components extracted by the dataset publisher (a European bank) from the original
                transaction features before public release, to protect cardholder privacy. The component that maps
                to <span className="text-white font-medium">V14</span> happens to encode a combination of the original
                features that is highly predictive of fraud — possibly transaction velocity, merchant category, or
                geographic distance between recent transactions.
              </p>
            </div>
            <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-4 text-sm text-slate-400 leading-relaxed">
              <p className="text-white font-semibold mb-2">Top features</p>
              <div className="space-y-1">
                {feature_importance.slice(0, 5).map((f, i) => (
                  <div key={f.feature} className="flex items-center justify-between">
                    <span className="font-mono text-slate-300 text-xs">{i + 1}. {f.feature}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(f.importance / feature_importance[0].importance) * 100}%` }} />
                      </div>
                      <span className="text-xs text-slate-500 w-14 text-right font-mono">{(f.importance * 100).toFixed(2)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Score distribution */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
        <SectionTitle
          title="Score Distribution on Test Set"
          sub="Fraud probability output from the model — fraud cases should cluster near 1.0, legitimate near 0.0"
        />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={bins} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="bin" tick={{ fill: '#475569', fontSize: 9 }} tickLine={false} axisLine={false} label={{ value: 'Fraud Score', position: 'insideBottom', offset: -2, fill: '#475569', fontSize: 10 }} />
                <YAxis tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => v > 999 ? `${(v/1000).toFixed(0)}k` : v} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    return (
                      <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs space-y-1">
                        <p className="text-slate-400">Score {payload[0]?.payload?.bin}–{(parseFloat(payload[0]?.payload?.bin) + 0.05).toFixed(2)}</p>
                        <p className="text-red-400">Fraud: {payload.find(p => p.dataKey === 'fraud')?.value ?? 0}</p>
                        <p className="text-emerald-400">Legit (sample): {payload.find(p => p.dataKey === 'legit')?.value ?? 0}</p>
                      </div>
                    )
                  }}
                />
                <Legend formatter={v => <span style={{ color: '#94a3b8', fontSize: 11 }}>{v === 'fraud' ? 'Fraud cases' : 'Legit sample (500)'}</span>} />
                <Bar dataKey="legit"  fill="#34d399" opacity={0.7} radius={[3, 3, 0, 0]} name="legit" stackId="a" />
                <Bar dataKey="fraud"  fill="#ef4444" opacity={0.9} radius={[3, 3, 0, 0]} name="fraud" stackId="b" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-col gap-3 justify-center">
            <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-4 text-sm text-slate-400 leading-relaxed">
              <p className="text-white font-semibold mb-2">Bimodal separation</p>
              <p>
                A well-trained model on imbalanced data shows a bimodal score distribution:
                the vast majority of transactions score near <span className="text-emerald-400 font-medium">0.0</span> (legitimate),
                while confirmed fraud cases cluster near <span className="text-red-400 font-medium">1.0</span>.
                The gap between the clusters reflects the model's confidence in its predictions.
              </p>
            </div>
            <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-4">
              <div className="flex justify-between text-xs mb-2">
                <span className="text-slate-500">Fraud cases scored</span>
                <span className="text-red-400 font-semibold">{score_distribution.fraud.length}</span>
              </div>
              <div className="flex justify-between text-xs mb-2">
                <span className="text-slate-500">Legit cases (sample)</span>
                <span className="text-emerald-400 font-semibold">{score_distribution.legit_sample.length}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Decision threshold</span>
                <span className="text-orange-400 font-semibold">{training_info?.threshold}</span>
              </div>
            </div>
          </div>
        </div>
        <p className="text-xs text-slate-600 mt-3">
          Legit scores are downsampled to 500 for visualization (full test set: {(training_info?.n_test - training_info?.n_fraud_test)?.toLocaleString()} legitimate transactions).
        </p>
      </div>

    </div>
  )
}
