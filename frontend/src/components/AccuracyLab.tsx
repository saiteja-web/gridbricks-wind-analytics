import React, { useEffect, useState } from 'react';
import {
  ComposedChart,
  Line,
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { fetchAccuracyEvaluation, type AccuracyEvaluationResponse } from '../api/client';
import { KPICard } from './KPICard';

export const AccuracyLab: React.FC = () => {
  const [cutoffHour, setCutoffHour] = useState<number>(11);
  const [resolutionMode, setResolutionMode] = useState<
    'half_hourly_interpolated' | 'hourly_exact'
  >('half_hourly_interpolated');
  const [data, setData] = useState<AccuracyEvaluationResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

useEffect(() => {
    let cancelled = false;
    const loadEvaluation = async () => {
      try {
        const res = await fetchAccuracyEvaluation(cutoffHour, resolutionMode);
        if (!cancelled) {
          setData(res);
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setLoading(false);
      }
    };
    loadEvaluation();
    return () => {
      cancelled = true;
    };
  }, [cutoffHour, resolutionMode]);
  
  if (loading || !data) {
    return <div className="p-8 text-slate-400">Running January 2026 Quantitative Evaluation...</div>;
  }

  const { kpis } = data;
  const maeReductionPct = Math.round(
    ((kpis.mae_mw - kpis.bias_corrected_mae_mw) / kpis.mae_mw) * 100
  );

  // Downsample 1,488 slots slightly by 2x for ultra-snappy full-month brush rendering if needed
  const dailySampledSeries = data.timeseries.filter((_, idx) => idx % 2 === 0).map((d) => ({
    ...d,
    shortTime: d.startTime.slice(5, 16).replace('T', ' '),
  }));

  return (
    <div className="space-y-6">
      {/* Executive Domain Insight Banner */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
        <div className="font-semibold text-amber-300">
          Key Quantitative Finding (January 2026 Backtest — {kpis.total_slots.toLocaleString()} Settlement Periods):
        </div>
        <p className="mt-1 text-xs leading-relaxed text-slate-300">
          At the 11:00 UTC Day-Ahead gate closure, raw Elexon <code>WINDFOR</code> exhibits a{' '}
          <strong className="text-white">+{kpis.mean_bias_mw.toLocaleString()} MW systematic over-forecast bias</strong>{' '}
          against metered <code>FUELHH</code> outturn (driven by transmission curtailment and embedded metering differences).
          Applying rolling bias-correction reduces Mean Absolute Error from{' '}
          <strong className="text-rose-300">{kpis.mae_mw.toLocaleString()} MW</strong> to{' '}
          <strong className="text-emerald-300">{kpis.bias_corrected_mae_mw.toLocaleString()} MW (-{maeReductionPct}%)</strong>{' '}
          and cuts P95 unhedged thermal shortfall risk from{' '}
          <strong className="text-rose-300">{kpis.p95_deficit_mw.toLocaleString()} MW</strong> to{' '}
          <strong className="text-emerald-300">{kpis.bias_corrected_p95_deficit_mw.toLocaleString()} MW</strong>.
        </p>
      </div>

      {/* Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/80 p-4">
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-xs text-slate-400">
              Day-Ahead Decision Cutoff Hour (UTC)
            </label>
            <select
              value={cutoffHour}
              onChange={(e) => setCutoffHour(Number(e.target.value))}
              className="mt-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white"
            >
              {[6, 8, 9, 10, 11, 12, 14, 16, 18].map((h) => (
                <option key={h} value={h}>
                  D-1 at {h.toString().padStart(2, '0')}:00 UTC {h === 11 ? '(UK Auction Gate)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400">
              Timestamp Alignment Mode (30m FUELHH vs 60m WINDFOR)
            </label>
            <select
              value={resolutionMode}
              onChange={(e) =>
                setResolutionMode(
                  e.target.value as 'half_hourly_interpolated' | 'hourly_exact'
                )
              }
              className="mt-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white"
            >
              <option value="half_hourly_interpolated">
                48 Half-Hourly Periods (Linearly Interpolated :30 slots)
              </option>
              <option value="hourly_exact">
                24 Hourly Periods (Exact Timestamp Matches Only)
              </option>
            </select>
          </div>
        </div>
        <div className="text-right text-xs text-slate-400">
          Evaluation Scope: <strong>Jan 2026 Day-Ahead Decisions</strong> ({data.start_date} to {data.end_date})
        </div>
      </div>

      {/* Quantitative KPI Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KPICard
          title="Raw MAE / Bias-Corrected"
          value={`${kpis.mae_mw.toLocaleString()} MW`}
          subtitle={`Drops to ${kpis.bias_corrected_mae_mw.toLocaleString()} MW (-${maeReductionPct}%) after bias correction`}
          badge={`NMAE: ${kpis.nmae_pct}%`}
          badgeTone="amber"
        />
        <KPICard
          title="RMSE (Tail Error Penalty)"
          value={`${kpis.rmse_mw.toLocaleString()} MW`}
          subtitle={`Bias-corrected RMSE: ${kpis.bias_corrected_rmse_mw.toLocaleString()} MW`}
          badge="L2 Loss"
          badgeTone="rose"
        />
        <KPICard
          title="Mean Forecast Bias (MBE)"
          value={`+${kpis.mean_bias_mw.toLocaleString()} MW`}
          subtitle="Forecast - Actual (Systematic over-prediction)"
          badge="Over-Forecast"
          badgeTone="rose"
        />
        <KPICard
          title="P95 Wind Deficit (Raw)"
          value={`${kpis.p95_deficit_mw.toLocaleString()} MW`}
          subtitle={`Max observed deficit: ${kpis.max_deficit_mw.toLocaleString()} MW`}
          badge="95% Risk VaR"
          badgeTone="amber"
        />
        <KPICard
          title="P95 Deficit (Bias-Corrected)"
          value={`${kpis.bias_corrected_p95_deficit_mw.toLocaleString()} MW`}
          subtitle="Recommended dynamic thermal reserve buffer"
          badge="Optimized Buffer"
          badgeTone="emerald"
        />
      </div>

      {/* Full Month Forecast vs Actuals & Deficit Bars */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
        <h3 className="text-base font-semibold text-white">
          January 2026 Full-Month Day-Ahead Forecast vs. Actual Generation & Shortfall Error
        </h3>
        <p className="mb-4 text-xs text-slate-400">
          Positive error bars (amber/red) denote periods where actual wind fell short of the Day-Ahead forecast, requiring supplementary thermal balancing.
        </p>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={dailySampledSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="shortTime" stroke="#94a3b8" tick={{ fontSize: 10 }} minTickGap={45} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} unit=" MW" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <ReferenceLine y={0} stroke="#475569" />
              <Line
                type="monotone"
                dataKey="forecast_mw"
                name="Raw Day-Ahead Forecast (MW)"
                stroke="#f59e0b"
                strokeWidth={1.5}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="bias_corrected_forecast_mw"
                name="Bias-Corrected Forecast (MW)"
                stroke="#10b981"
                strokeWidth={1.5}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="actual_mw"
                name="Actual Metered Generation (FUELHH MW)"
                stroke="#38bdf8"
                strokeWidth={2}
                dot={false}
              />
              <Bar
                dataKey="deficit_mw"
                name="Wind Shortfall / Unplanned Thermal Need (MW)"
                fill="#f43f5e"
                fillOpacity={0.35}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom 2-Column Analytical Breakdown: Horizon Decay & Diurnal Risk */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
          <h3 className="text-sm font-semibold text-white">
            Forecast Error by Lead-Time Horizon (All 19,032 Revisions)
          </h3>
          <p className="mb-4 text-xs text-slate-400">
            Quantifies how forecast MAE degrades from Intraday (0–12h) to Day-Ahead auction horizons (12–36h) and Two-Day Ahead (36–48h).
          </p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.horizon_decay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="horizon_bucket" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} unit=" MW" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="mae_mw" name="Mean Absolute Error (MW)" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="rmse_mw" name="RMSE (MW)" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
          <h3 className="text-sm font-semibold text-white">
            Diurnal Error Profile by Hour of Day (UTC)
          </h3>
          <p className="mb-4 text-xs text-slate-400">
            Highlights P95 wind deficit risk across UK evening peak demand hours (16:00–20:00 UTC) when thermal balancing is most expensive.
          </p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.hourly_profile}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="hour_utc" stroke="#94a3b8" tick={{ fontSize: 11 }} unit=":00" />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} unit=" MW" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="mae_mw" name="Hourly MAE (MW)" fill="#10b981" fillOpacity={0.5} />
                <Line
                  type="monotone"
                  dataKey="p95_deficit_mw"
                  name="P95 Shortfall Buffer Required (MW)"
                  stroke="#f43f5e"
                  strokeWidth={2}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};