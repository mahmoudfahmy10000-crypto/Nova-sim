import React, { useState } from "react";
import { DATABASE_TABLES, TableElement } from "../architecture_doc";
import { Database, Key, Columns, ArrowRight, HelpCircle } from "lucide-react";

export default function DbExplorer() {
  const [selectedTable, setSelectedTable] = useState<string>("projects_metadata");

  const tableData = DATABASE_TABLES.find((t) => t.name === selectedTable) || DATABASE_TABLES[0];

  return (
    <div className="bg-slate-950 border border-slate-900 rounded-xl p-6 shadow-2xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 border-b border-slate-900 pb-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-500" />
            NovaSim Database Schema Explorer
          </h2>
          <p className="text-sm text-slate-400">
            Investigate the segmented storage design, tracing material cards, sensor metrics, and HDF5 indices.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Table Selector List */}
        <div className="lg:col-span-1 flex flex-col gap-2">
          <span className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-1 px-1">Logical Tables</span>
          {DATABASE_TABLES.map((t) => (
            <button
              key={t.name}
              onClick={() => setSelectedTable(t.name)}
              className={`p-3 text-left border rounded-lg transition-all duration-150 flex flex-col ${
                selectedTable === t.name
                  ? "bg-indigo-950/30 border-indigo-500 text-indigo-100 shadow-sm"
                  : "bg-slate-900/40 border-slate-900 hover:border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              <span className="text-sm font-semibold font-mono">{t.name}</span>
              <span className="text-[10px] text-slate-500 mt-1 uppercase font-mono">{t.type}</span>
            </button>
          ))}
        </div>

        {/* Selected Table details */}
        <div className="lg:col-span-3 bg-slate-900/25 border border-slate-900 rounded-lg p-5">
          <div className="border-b border-slate-900 pb-4 mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-100 font-mono flex items-center gap-2">
                <Columns className="w-4 h-4 text-emerald-400" />
                {tableData.name}
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">{tableData.description}</p>
            </div>
            <div className="mt-2 sm:mt-0 font-mono text-[10px] px-2.5 py-1 bg-slate-950 border border-slate-800 text-indigo-400 rounded-full self-start">
              {tableData.type}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-900 text-slate-500 font-mono">
                  <th className="py-2.5 px-3">Column Name</th>
                  <th className="py-2.5 px-3">Data Type</th>
                  <th className="py-2.5 px-3">Constraint</th>
                  <th className="py-2.5 px-3">Purpose</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/60">
                {tableData.columns.map((col) => (
                  <tr key={col.name} className="hover:bg-slate-900/20 transition-all font-mono">
                    <td className="py-3 px-3 text-emerald-400 font-semibold">{col.name}</td>
                    <td className="py-3 px-3 text-slate-300">{col.type}</td>
                    <td className="py-3 px-3">
                      {col.key ? (
                        <span className="flex items-center gap-1 text-[10px] text-amber-500 font-bold bg-amber-950/20 px-2 py-0.5 border border-amber-950 rounded">
                          <Key className="w-3 h-3" /> PK / Index
                        </span>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-400 font-sans leading-relaxed">{col.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table Relations Insight */}
          <div className="mt-6 border-t border-slate-900 pt-4 text-xs">
            <h4 className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-2">Relational Context</h4>
            <div className="bg-slate-950 p-3 rounded border border-slate-900 flex items-start gap-2 text-slate-400">
              <HelpCircle className="w-4 h-4 text-slate-500 mt-0.5" />
              <div className="leading-relaxed font-mono">
                {tableData.name === "projects_metadata" && (
                  <span>
                    Linked via foreign key maps directly to physical <code className="text-indigo-400">telemetry_sensors</code> tables inside memory arrays during running time steps.
                  </span>
                )}
                {tableData.name === "telemetry_sensors" && (
                  <span>
                    Designed for ultra-high ingestion writes (exceeding 20,000 logs/sec). Employs partition chuck limits to auto-expire telemetry older than 90 days.
                  </span>
                )}
                {tableData.name === "binary_chunks" && (
                  <span>
                    Acts as the high-speed index pointer to map float64 spatial states on disk within the custom <code className="text-amber-400">.nsim</code> binary containers.
                  </span>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
