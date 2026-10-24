import React, { useEffect, useState, useMemo } from 'react';
import {
  ComposedChart,
  Line,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { fetchDayAheadDesk, type DayAheadDeskResponse } from '../api/client';
import { KPICard } from '../components/KPICard';
import { ShieldAlert, CheckCircle2 } from 'lucide-react';

export const DayAheadDesk: React.FC = () => {
  const [decisionDate, setDecisionDate] = useState<string>('2026-01-14');
  const [cutoffHour, setCutoffHour] = useState<number>(11);
  const [useBiasCorrection, setUseBiasCorrection] = useState<boolean>(true);
  const [showActualOutturn, setShowActualOutturn] = useState<boolean>(true);
  const [targetPortfolioLoadMw, setTargetPortfolioLoadMw] = useState<number>(16000);
  const [data, setData] = useState<DayAheadDeskResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

 useEffect(() => {
    if (!decisionDate || !/^2026-01-(0[1-9]|[12][0-9]|3[01])$/.test(decisionDate)) return;
    let cancelled = false;
    const loadDesk = async () => {
      try {
        const res = await fetchDayAheadDesk(decisionDate, cutoffHour);
        if (!cancelled) {
          setData(res);
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setLoading(false);
      }
    };
    loadDesk();
    return () => {
      cancelled = true;
    };
  }, [decisionDate, cutoffHour]);

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.slots.map((s) => {
      const activeForecast = useBiasCorrection
        ? s.bias_corrected_forecast_mw
        : s.decision_forecast_mw;
      const thermalToBuy = Math.max(0, Math.round(targetPortfolioLoadMw - activeForecast));
      const timeLabel = new Date(s.startTime).toISOString().slice(11, 16);
      return {
        ...s,
        timeLabel: `${timeLabel} (SP${s.settlementPeriod})`,
        active_forecast_mw: activeForecast,
        thermal_procurement_mw: thermalToBuy,
      };
    });
  }, [data, useBiasCorrection, targetPortfolioLoadMw]);

  if (loading || !data) {
    return <div className="p-8 text-slate-400">Loading Day-Ahead Procurement Desk...</div>;
  }

  const activeMeanWind = useBiasCorrection
    ? data.summary.bias_corrected_mean_mw
    : data.summary.expected_wind_mean_mw;

  const avgThermalNeeded = Math.max(0, Math.round(targetPortfolioLoadMw - activeMeanWind));

  return (
    <div className="space-y-6">
      {/* Trader Control Bar */}
      <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-800 bg-slate-900/90 p-4 md:grid-cols-4">
        <div>
          <label className="block text-xs font-medium text-slate-400">
            Decision Date (Day D-1 in Jan 2026)
          </label>
          <div className="mt-1 flex items-center gap-1.5">
            <button
              type="button"
              disabled={decisionDate <= '2026-01-01'}
              onClick={() => {
                const day = parseInt(decisionDate.slice(-2), 10);
                if (day > 1) {
                  setDecisionDate(`2026-01-${String(day - 1).padStart(2, '0')}`);
                }
              }}
              className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-40"
              title="Previous Day"
            >
              ◀
            </button>

            <select
              value={decisionDate}
              onChange={(e) => setDecisionDate(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm font-medium text-white focus:border-sky-500 focus:outline-none"
            >
              {Array.from({ length: 31 }, (_, i) => {
                const dayStr = String(i + 1).padStart(2, '0');
                const dateVal = `2026-01-${dayStr}`;
                return (
                  <option key={dateVal} value={dateVal}>
                    Jan {dayStr}, 2026 (Decision D-1)
                  </option>
                );
              })}
            </select>

            <button
              type="button"
              disabled={decisionDate >= '2026-01-31'}
              onClick={() => {
                const day = parseInt(decisionDate.slice(-2), 10);
                if (day < 31) {
                  setDecisionDate(`2026-01-${String(day + 1).padStart(2, '0')}`);
                }
              }}
              className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-40"
              title="Next Day"
            >
              ▶
            </button>
          </div>
          <span className="mt-1 block text-[11px] text-sky-400">
            Purchasing for Delivery Date: <strong>{data.delivery_date}</strong>
          </span>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400">
            Day-Ahead Gate Closure: <strong>{cutoffHour}:00 UTC</strong>
          </label>
          <input
            type="range"
            min={6}
            max={18}
            value={cutoffHour}
            onChange={(e) => setCutoffHour(Number(e.target.value))}
            className="mt-2 w-full accent-sky-500"
          />
          <span className="block text-[11px] text-slate-400">
            UK EPEX/N2EX Day-Ahead Auction closes at 11:00 UTC
          </span>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400">
            Simulated Demand Load Target: <strong>{targetPortfolioLoadMw.toLocaleString()} MW</strong>
          </label>
          <input
            type="range"
            min={8000}
            max={25000}
            step={500}
            value={targetPortfolioLoadMw}
            onChange={(e) => setTargetPortfolioLoadMw(Number(e.target.value))}
            className="mt-2 w-full accent-amber-500"
          />
          <span className="block text-[11px] text-slate-400">
            Adjust to see required Day-Ahead thermal top-up
          </span>
        </div>

        <div className="flex flex-col justify-center gap-2 border-l border-slate-800 pl-4">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-200">
            <input
              type="checkbox"
              checked={useBiasCorrection}
              onChange={(e) => setUseBiasCorrection(e.target.checked)}
              className="rounded accent-emerald-500"
            />
            <span>Apply Systematic Bias Correction (-1.8 GW)</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-200">
            <input
              type="checkbox"
              checked={showActualOutturn}
              onChange={(e) => setShowActualOutturn(e.target.checked)}
              className="rounded accent-sky-500"
            />
            <span>Overlay Next-Day Actual Outturn (Backtest)</span>
          </label>
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Day-Ahead Wind Forecast (Mean)"
          value={`${activeMeanWind.toLocaleString()} MW`}
          subtitle={
            useBiasCorrection
              ? `Bias-adjusted from ${data.summary.expected_wind_mean_mw.toLocaleString()} MW raw WINDFOR`
              : 'Raw Elexon WINDFOR as of gate closure'
          }
          badge={useBiasCorrection ? 'Bias-Corrected' : 'Raw WINDFOR'}
          badgeTone={useBiasCorrection ? 'emerald' : 'amber'}
        />
        <KPICard
          title="Conservative P10 Wind Floor"
          value={`${Math.max(
            0,
            Math.round(activeMeanWind - data.summary.recommended_thermal_buffer_mw)
          ).toLocaleString()} MW`}
          subtitle={`Accounts for P90 historical shortfall buffer (${data.summary.recommended_thermal_buffer_mw.toLocaleString()} MW)`}
          badge="90% Confidence"
          badgeTone="sky"
        />
        <KPICard
          title="Rec. Day-Ahead Thermal Purchase"
          value={`${avgThermalNeeded.toLocaleString()} MW`}
          subtitle={`Non-wind power to procure for ${targetPortfolioLoadMw.toLocaleString()} MW target load`}
          badge="Actionable Bid"
          badgeTone="amber"
        />
        <KPICard
          title="Actual Delivery Outturn (FUELHH)"
          value={`${data.summary.actual_wind_mean_mw.toLocaleString()} MW`}
          subtitle={`Max single-period wind deficit: ${data.summary.day_max_deficit_mw.toLocaleString()} MW`}
          badge="Post-Delivery Audit"
          badgeTone="rose"
        />
      </div>

      {/* Main Chart: Forecast vs Confidence Band vs Actuals */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-white">
              48 Settlement Period Wind Generation Forecast & Uncertainty Band ({data.delivery_date})
            </h3>
            <p className="text-xs text-slate-400">
              Point-in-time view locked at {decisionDate} {cutoffHour}:00 UTC (Zero look-ahead leakage). Shaded band represents P10–P90 historical error range.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-1.5 text-xs text-slate-300">
            {useBiasCorrection ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            ) : (
              <ShieldAlert className="h-4 w-4 text-amber-400" />
            )}
            <span>
              {useBiasCorrection
                ? 'Curtailment & Metering Bias Correction Active'
                : 'Warning: Raw WINDFOR over-forecasts FUELHH by +1,804 MW on average'}
            </span>
          </div>
        </div>

        <div className="h-96 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="timeLabel" stroke="#94a3b8" tick={{ fontSize: 11 }} interval={3} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} unit=" MW" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Area
                type="monotone"
                dataKey="p90_band_mw"
                name="P90 Upper Bound (MW)"
                stroke="none"
                fill="#0284c7"
                fillOpacity={0.12}
              />
              <Area
                type="monotone"
                dataKey="p10_band_mw"
                name="P10 Safe Floor (MW)"
                stroke="#38bdf8"
                strokeDasharray="4 4"
                fill="#090d16"
                fillOpacity={0.6}
              />
              <Line
                type="monotone"
                dataKey="active_forecast_mw"
                name={
                  useBiasCorrection
                    ? 'Bias-Corrected Day-Ahead Forecast (MW)'
                    : 'Raw Day-Ahead Forecast (MW)'
                }
                stroke="#10b981"
                strokeWidth={2.5}
                dot={false}
              />
              {showActualOutturn && (
                <Line
                  type="monotone"
                  dataKey="actual_mw"
                  name="Actual Metered Wind (FUELHH MW)"
                  stroke="#f43f5e"
                  strokeWidth={2}
                  dot={false}
                />
              )}
              <Bar
                dataKey="thermal_procurement_mw"
                name="Required Thermal / Market Purchase (MW)"
                fill="#f59e0b"
                fillOpacity={0.25}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};