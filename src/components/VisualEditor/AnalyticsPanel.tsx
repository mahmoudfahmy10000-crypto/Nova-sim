import React, { useState } from "react";
import { SimulationAnalytics, SimNode } from "../../core/simulation/types";
import {
  TrendingUp,
  Clock,
  Activity,
  AlertTriangle,
  Play,
  RotateCcw,
  Download,
  Copy,
  Check,
  Search,
  ArrowRight,
  TrendingDown,
  BarChart4,
  Server,
  Zap,
  CheckCircle2,
  ListFilter
} from "lucide-react";

interface AnalyticsPanelProps {
  analytics: SimulationAnalytics | null;
  nodes: SimNode[];
  onResetStatistics: () => void;
}

export default function AnalyticsPanel({ analytics, nodes, onResetStatistics }: AnalyticsPanelProps) {
  const [nodeSearchQuery, setNodeSearchQuery] = useState("");
  const [copiedExportUrl, setCopiedExportUrl] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  const handleReset = () => {
    if (window.confirm("Are you sure you want to reset all running statistics, queue lengths, and historical metrics? This cannot be undone.")) {
      onResetStatistics();
    }
  };

  const handleExportJSON = () => {
    if (!analytics) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(analytics, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `discrete_event_sim_analytics_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleCopyApiUrl = () => {
    const apiPath = `${window.location.protocol}//${window.location.host}/api/analytics/export`;
    navigator.clipboard.writeText(apiPath);
    setCopiedExportUrl(true);
    setTimeout(() => setCopiedExportUrl(false), 2000);
  };

  // Safe KPI defaults if analytics is null or empty
  const throughputRate = analytics?.throughputRate || 0;
  const totalCompleted = analytics?.totalCompleted || 0;
  const totalArrived = analytics?.totalArrived || 0;
  const currentWIP = analytics?.currentWIP || 0;
  const averageCycleTime = analytics?.averageCycleTime || 0;
  const maxCycleTime = analytics?.maxCycleTime || 0;
  const minCycleTime = analytics?.minCycleTime || 0;
  const averageWaitingTime = analytics?.averageWaitingTime || 0;
  const averageProcessingTime = analytics?.averageProcessingTime || 0;
  const bottlenecks = analytics?.bottlenecks || [];
  const nodeMetrics = analytics?.nodeMetrics || {};
  const timeSeries = analytics?.timeSeries || [];

  // Percentage Split of Cycle Time
  const totalNodeTimesSum = averageWaitingTime + averageProcessingTime;
  const waitPercent = totalNodeTimesSum > 0 ? (averageWaitingTime / totalNodeTimesSum) * 100 : 0;
  const processPercent = totalNodeTimesSum > 0 ? (averageProcessingTime / totalNodeTimesSum) * 100 : 0;

  // Filter nodes metric table
  const filteredNodeMetricsKeys = Object.keys(nodeMetrics).filter(key => {
    const metric = nodeMetrics[key];
    const q = nodeSearchQuery.toLowerCase().trim();
    return q === "" || metric.name.toLowerCase().includes(q) || metric.type.toLowerCase().includes(q);
  });

  // Render SVG Sparkline for TimeSeries (WIP & Throughput trends over time)
  const renderTrendChart = () => {
    if (timeSeries.length < 2) {
      return (
        <div className="h-36 flex flex-col items-center justify-center border border-slate-900 bg-slate-950/40 rounded-lg p-4 text-center">
          <Activity className="w-6 h-6 text-slate-700 animate-pulse mb-1" />
          <span className="text-[10px] font-mono text-slate-500 uppercase">Awaiting trend observations</span>
          <span className="text-[8px] font-mono text-slate-600 mt-0.5">Let simulation progress to collect data</span>
        </div>
      );
    }

    const width = 320;
    const height = 120;
    const padding = 15;

    // Find min and max for scaling
    const maxThroughput = Math.max(...timeSeries.map(p => p.throughput), 5);
    const maxWip = Math.max(...timeSeries.map(p => p.wip), 5);
    const maxVal = Math.max(maxThroughput, maxWip);
    const maxTime = Math.max(...timeSeries.map(p => p.time), 1);

    const getX = (t: number) => padding + (t / maxTime) * (width - padding * 2);
    const getY = (val: number) => height - padding - (val / maxVal) * (height - padding * 2);

    // Build SVG paths
    let throughputPoints = "";
    let wipPoints = "";
    let throughputAreaPoints = `${getX(0)},${getY(0)} `;

    timeSeries.forEach((pt) => {
      const x = getX(pt.time);
      const yTh = getY(pt.throughput);
      const yWip = getY(pt.wip);

      throughputPoints += `${x.toFixed(1)},${yTh.toFixed(1)} `;
      wipPoints += `${x.toFixed(1)},${yWip.toFixed(1)} `;
      throughputAreaPoints += `${x.toFixed(1)},${yTh.toFixed(1)} `;
    });

    throughputAreaPoints += `${getX(timeSeries[timeSeries.length - 1].time).toFixed(1)},${getY(0).toFixed(1)}`;

    return (
      <div className="border border-slate-900 bg-slate-950/40 rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-mono uppercase text-slate-400 font-bold flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
            Live Trend Analytics (T = {timeSeries[timeSeries.length - 1].time.toFixed(1)}s)
          </span>
          <div className="flex gap-2 text-[8px] font-mono">
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
              THROUGHPUT
            </span>
            <span className="flex items-center gap-1 text-indigo-400">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500"></span>
              WIP
            </span>
          </div>
        </div>

        <div className="relative">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible select-none">
            {/* Horizontal Grid lines */}
            <line x1={padding} y1={getY(0)} x2={width - padding} y2={getY(0)} stroke="#0f172a" strokeWidth="1" />
            <line x1={padding} y1={getY(maxVal / 2)} x2={width - padding} y2={getY(maxVal / 2)} stroke="#0f172a" strokeWidth="1" strokeDasharray="2,2" />
            <line x1={padding} y1={getY(maxVal)} x2={width - padding} y2={getY(maxVal)} stroke="#1e293b" strokeWidth="1" />

            {/* Throughput Shaded Area */}
            <polygon
              points={throughputAreaPoints}
              fill="url(#throughputGrad)"
              opacity="0.15"
            />

            {/* Throughput Line */}
            <polyline
              fill="none"
              stroke="#10b981"
              strokeWidth="2"
              points={throughputPoints}
            />

            {/* WIP Line */}
            <polyline
              fill="none"
              stroke="#6366f1"
              strokeWidth="1.5"
              strokeDasharray="1,1"
              points={wipPoints}
            />

            {/* Gradients */}
            <defs>
              <linearGradient id="throughputGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Y axis labels */}
            <text x={padding - 2} y={getY(maxVal) + 3} fill="#475569" fontSize="6" fontFamily="monospace" textAnchor="end">{Math.round(maxVal)}</text>
            <text x={padding - 2} y={getY(maxVal / 2) + 2} fill="#475569" fontSize="6" fontFamily="monospace" textAnchor="end">{Math.round(maxVal / 2)}</text>
            <text x={padding - 2} y={getY(0) + 1} fill="#475569" fontSize="6" fontFamily="monospace" textAnchor="end">0</text>

            {/* X axis endpoints */}
            <text x={padding} y={height - 2} fill="#475569" fontSize="6" fontFamily="monospace">0.0s</text>
            <text x={width - padding} y={height - 2} fill="#475569" fontSize="6" fontFamily="monospace" textAnchor="end">{maxTime.toFixed(1)}s</text>
          </svg>
        </div>
      </div>
    );
  };

  // Render SVG Utilization bar chart
  const renderUtilizationChart = () => {
    const usableNodeMetrics = Object.keys(nodeMetrics)
      .map(key => nodeMetrics[key])
      .filter(m => m.type === "processor" || m.type === "conveyor" || m.type === "transporter");

    if (usableNodeMetrics.length === 0) {
      return (
        <div className="h-32 flex flex-col items-center justify-center border border-slate-900 bg-slate-950/40 rounded-lg p-4 text-center">
          <BarChart4 className="w-6 h-6 text-slate-700 mb-1" />
          <span className="text-[10px] font-mono text-slate-500 uppercase">No processing nodes configured</span>
        </div>
      );
    }

    const width = 320;
    const barHeight = 14;
    const spacing = 6;
    const labelWidth = 60;
    const chartWidth = width - labelWidth - 20;
    const height = usableNodeMetrics.length * (barHeight + spacing) + 10;

    return (
      <div className="border border-slate-900 bg-slate-950/40 rounded-xl p-3 space-y-2">
        <span className="text-[9px] font-mono uppercase text-slate-400 font-bold flex items-center gap-1">
          <BarChart4 className="w-3.5 h-3.5 text-indigo-400" />
          Resource Utilization Levels (%)
        </span>

        <div className="overflow-visible select-none">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
            {usableNodeMetrics.map((node, idx) => {
              const y = idx * (barHeight + spacing) + 5;
              const barWidth = (node.utilization / 100) * chartWidth;
              
              // Gradient picker based on utilization level
              const color = node.utilization > 80 ? "#f43f5e" : node.utilization > 50 ? "#f97316" : "#6366f1";

              return (
                <g key={node.nodeId}>
                  {/* Node label */}
                  <text
                    x={labelWidth - 5}
                    y={y + barHeight / 2 + 3}
                    fill="#94a3b8"
                    fontSize="7"
                    fontFamily="monospace"
                    textAnchor="end"
                    className="truncate"
                  >
                    {node.name.length > 10 ? node.name.substring(0, 8) + ".." : node.name}
                  </text>

                  {/* Background track */}
                  <rect
                    x={labelWidth}
                    y={y}
                    width={chartWidth}
                    height={barHeight}
                    rx="3"
                    fill="#0f172a"
                  />

                  {/* Filled bar */}
                  <rect
                    x={labelWidth}
                    y={y}
                    width={Math.max(2, barWidth)}
                    height={barHeight}
                    rx="3"
                    fill={color}
                  />

                  {/* Value text indicator */}
                  <text
                    x={labelWidth + barWidth + 4}
                    y={y + barHeight / 2 + 3}
                    fill="#f1f5f9"
                    fontSize="6"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    {node.utilization.toFixed(1)}%
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header section */}
      <div className="flex items-center justify-between bg-slate-900/40 p-3 rounded-xl border border-slate-900 shrink-0 select-none">
        <div>
          <h2 className="text-xs font-mono font-bold text-slate-200 uppercase flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-indigo-400" />
            Live Analytics Engine
          </h2>
          <p className="text-[9px] font-mono text-slate-500 mt-0.5">High-fidelity metrics calculated in real-time</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title="Reset statistics collection counter"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleExportJSON}
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-indigo-400 transition-colors cursor-pointer"
            title="Export static JSON data snapshot"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* KPI Cards section */}
      <div className="grid grid-cols-2 gap-3 shrink-0">
        <div className="bg-slate-900/20 border border-slate-900/60 rounded-xl p-3 flex flex-col justify-between">
          <span className="text-[8px] font-mono uppercase text-slate-500 font-bold flex items-center gap-1">
            <Zap className="w-3 h-3 text-emerald-400" /> THROUGHPUT RATE
          </span>
          <span className="text-xl font-mono font-bold text-emerald-400 mt-2">
            {throughputRate.toFixed(3)} <span className="text-[10px] text-slate-500">/s</span>
          </span>
          <span className="text-[8px] font-mono text-slate-600 mt-1">Total completed: {totalCompleted}</span>
        </div>

        <div className="bg-slate-900/20 border border-slate-900/60 rounded-xl p-3 flex flex-col justify-between">
          <span className="text-[8px] font-mono uppercase text-slate-500 font-bold flex items-center gap-1">
            <Clock className="w-3 h-3 text-indigo-400" /> AVG CYCLE TIME
          </span>
          <span className="text-xl font-mono font-bold text-slate-200 mt-2">
            {averageCycleTime.toFixed(1)}<span className="text-[10px] text-slate-500">s</span>
          </span>
          <span className="text-[8px] font-mono text-slate-600 mt-1">
            Min: {minCycleTime.toFixed(1)}s / Max: {maxCycleTime.toFixed(1)}s
          </span>
        </div>
      </div>

      {/* Waiting vs Processing bar ratio breakdown */}
      <div className="bg-slate-900/20 border border-slate-900/60 rounded-xl p-3 space-y-2 shrink-0">
        <div className="flex items-center justify-between text-[8px] font-mono uppercase text-slate-500 font-bold">
          <span>CYCLE TIME SPLIT WEIGHT</span>
          <span className="text-[9px] text-slate-300">
            Wait {averageWaitingTime.toFixed(1)}s / Process {averageProcessingTime.toFixed(1)}s
          </span>
        </div>

        <div className="w-full h-3 rounded bg-slate-950 overflow-hidden flex">
          {totalNodeTimesSum > 0 ? (
            <>
              <div
                style={{ width: `${waitPercent}%` }}
                className="h-full bg-amber-500 transition-all duration-300"
                title={`Buffer Queue Waiting Time: ${waitPercent.toFixed(1)}%`}
              />
              <div
                style={{ width: `${processPercent}%` }}
                className="h-full bg-indigo-500 transition-all duration-300"
                title={`Active Machine Processing Time: ${processPercent.toFixed(1)}%`}
              />
            </>
          ) : (
            <div className="w-full h-full bg-slate-800" title="No events recorded yet" />
          )}
        </div>

        <div className="flex justify-between text-[7px] font-mono text-slate-600">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
            QUEUE DELAY ({waitPercent.toFixed(0)}%)
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500"></span>
            TRANSIT PROCESSING ({processPercent.toFixed(0)}%)
          </span>
        </div>
      </div>

      {/* Trend sparkline & util charts */}
      <div className="space-y-4 overflow-y-auto max-h-[220px] scrollbar-thin shrink-0 pr-1">
        {renderTrendChart()}
        {renderUtilizationChart()}
      </div>

      {/* Bottlenecks and warnings panel */}
      <div className="border border-slate-900 bg-slate-950/20 rounded-xl p-3 flex flex-col space-y-2 shrink-0">
        <span className="text-[9px] font-mono uppercase text-slate-400 font-bold flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
          SYSTEM BOTTLENECKS IDENTIFIED ({bottlenecks.length})
        </span>

        <div className="space-y-2 max-h-[110px] overflow-y-auto scrollbar-thin pr-1">
          {bottlenecks.map((b, idx) => (
            <div
              key={idx}
              className={`p-2 rounded-lg border text-[9px] font-mono flex items-start justify-between gap-2 ${
                b.score > 80
                  ? "bg-rose-950/20 border-rose-900/40 text-rose-300"
                  : "bg-amber-950/20 border-amber-900/40 text-amber-300"
              }`}
            >
              <div className="space-y-0.5">
                <span className="font-bold uppercase tracking-wider">{b.name}</span>
                <p className="text-[8px] text-slate-400">{b.reason}</p>
              </div>
              <div className="text-right">
                <span className="font-bold text-[10px]">{b.score} pts</span>
                <p className="text-[7px] text-slate-500 uppercase">SCORE</p>
              </div>
            </div>
          ))}

          {bottlenecks.length === 0 && (
            <div className="text-center p-4 border border-slate-900/50 rounded-lg bg-slate-900/10 text-slate-600 italic">
              No bottleneck alarms. Flow speeds are stable.
            </div>
          )}
        </div>
      </div>

      {/* REST EXPORT API QUICKBAR */}
      <div className="border border-slate-900 bg-slate-950/40 rounded-xl p-3 space-y-2 shrink-0 font-mono text-[9px] text-slate-400">
        <span className="text-slate-300 font-bold">API INTEGRATION SPECIFICATION</span>
        <p className="text-[8px] text-slate-500 leading-relaxed">
          The simulation metrics are accessible via secure RESTful APIs to integrate into external BI dashboards like Grafana or Google Sheets:
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleCopyApiUrl}
            className="flex-1 py-1 px-2 rounded bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-indigo-400 border border-slate-800 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {copiedExportUrl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>COPY EXPORT API PATH</span>
          </button>
        </div>
      </div>

      {/* Nodes Metrics List Table */}
      <div className="flex-1 flex flex-col border border-slate-900 bg-slate-950/20 rounded-xl overflow-hidden min-h-[160px]">
        <div className="p-2.5 border-b border-slate-900 flex items-center justify-between gap-2 shrink-0 select-none">
          <span className="text-[9px] font-mono uppercase text-slate-400 font-bold flex items-center gap-1">
            <ListFilter className="w-3 h-3 text-indigo-400" />
            Node-by-Node Metric breakdown
          </span>
          <div className="relative">
            <Search className="w-3 h-3 text-slate-600 absolute left-2 top-2" />
            <input
              type="text"
              placeholder="Search..."
              value={nodeSearchQuery}
              onChange={e => setNodeSearchQuery(e.target.value)}
              className="bg-slate-950 border border-slate-850 rounded px-1.5 py-1 pl-6 text-[9px] font-mono text-slate-300 placeholder-slate-600 outline-none focus:border-slate-700 w-32"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto scrollbar-thin">
          <table className="w-full text-left border-collapse text-[9px] font-mono">
            <thead>
              <tr className="border-b border-slate-900 bg-slate-950 text-slate-500 uppercase text-[8px]">
                <th className="p-2">Node Name</th>
                <th className="p-2 text-center">Entered</th>
                <th className="p-2 text-center">Completed</th>
                <th className="p-2 text-center">WIP</th>
                <th className="p-2 text-center">Avg Wait</th>
                <th className="p-2 text-center">Avg Proc</th>
                <th className="p-2 text-center">Util</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-950">
              {filteredNodeMetricsKeys.map(key => {
                const metric = nodeMetrics[key];
                return (
                  <tr key={key} className="hover:bg-slate-900/35 text-slate-300">
                    <td className="p-2 font-bold text-slate-200 truncate max-w-[80px]" title={metric.name}>
                      {metric.name}
                    </td>
                    <td className="p-2 text-center text-slate-400">{metric.totalEntered}</td>
                    <td className="p-2 text-center text-slate-400">{metric.totalCompleted}</td>
                    <td className="p-2 text-center text-indigo-400">{metric.currentWIP}</td>
                    <td className="p-2 text-center text-amber-500">{metric.averageWaitingTime.toFixed(1)}s</td>
                    <td className="p-2 text-center text-slate-400">
                      {metric.type === "queue" || metric.type === "sink" || metric.type === "source" ? "-" : `${metric.averageProcessingTime.toFixed(1)}s`}
                    </td>
                    <td className="p-2 text-center">
                      {metric.type === "queue" || metric.type === "sink" || metric.type === "source" ? (
                        <span className="text-slate-600">-</span>
                      ) : (
                        <span className={metric.utilization > 80 ? "text-rose-400 font-bold" : "text-emerald-400"}>
                          {metric.utilization.toFixed(0)}%
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredNodeMetricsKeys.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center p-4 text-slate-600 italic">
                    No matching node metrics found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
