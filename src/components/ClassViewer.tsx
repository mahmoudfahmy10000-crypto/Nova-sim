import React, { useState } from "react";
import { CORE_CLASSES, ClassElement } from "../architecture_doc";
import { Code, Settings, Link, FolderGit, Cpu, Layers } from "lucide-react";

export default function ClassViewer() {
  const [selectedClass, setSelectedClass] = useState<string>("SimulationCoordinator");

  const classData = CORE_CLASSES.find((c) => c.name === selectedClass) || CORE_CLASSES[0];

  return (
    <div className="bg-slate-950 border border-slate-900 rounded-xl p-6 shadow-2xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 border-b border-slate-900 pb-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
            <Code className="w-5 h-5 text-emerald-500" />
            Core Software Class & Interface Tree
          </h2>
          <p className="text-sm text-slate-400">
            Explore the core class designs, interfaces, and memory-aligned structures of NovaSim AI.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Class selector */}
        <div className="lg:col-span-1 flex flex-col gap-2">
          <span className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-1 px-1">Class Registry</span>
          {CORE_CLASSES.map((c) => (
            <button
              key={c.name}
              onClick={() => setSelectedClass(c.name)}
              className={`p-3 text-left border rounded-lg transition-all duration-150 flex flex-col ${
                selectedClass === c.name
                  ? "bg-emerald-950/20 border-emerald-500 text-emerald-100 shadow-sm"
                  : "bg-slate-900/40 border-slate-900 hover:border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              <span className="text-sm font-semibold font-mono">{c.name}</span>
              <span className="text-[10px] text-slate-500 mt-1 uppercase font-mono">{c.type}</span>
            </button>
          ))}
        </div>

        {/* Details pane */}
        <div className="lg:col-span-3 bg-slate-900/25 border border-slate-900 rounded-lg p-6">
          <div className="border-b border-slate-900 pb-4 mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-emerald-400 bg-emerald-950/30 border border-emerald-900 px-2 py-0.5 rounded capitalize">
                  {classData.type}
                </span>
                <h3 className="text-lg font-bold text-slate-100 font-mono">{classData.name}</h3>
              </div>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed font-sans">{classData.description}</p>
            </div>
            <div className="font-mono text-[10px] text-slate-500">
              C++23 / Rust Edition 2024
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Methods */}
            <div className="bg-slate-950 p-4 border border-slate-900 rounded-lg">
              <h4 className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                <Settings className="w-4 h-4 text-emerald-500" />
                Methods & API Interface
              </h4>
              <div className="flex flex-col gap-2">
                {classData.methods.map((m) => (
                  <div
                    key={m}
                    className="p-2 font-mono text-xs bg-slate-900/50 border border-slate-800/60 rounded text-slate-200 overflow-x-auto whitespace-nowrap"
                  >
                    {m}
                  </div>
                ))}
              </div>
            </div>

            {/* Relations */}
            <div className="bg-slate-950 p-4 border border-slate-900 rounded-lg flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                  <Link className="w-4 h-4 text-indigo-500" />
                  Structural Relations
                </h4>
                <div className="flex flex-col gap-2">
                  {classData.relations.map((rel) => {
                    const exists = CORE_CLASSES.some((c) => c.name === rel);
                    return (
                      <div
                        key={rel}
                        onClick={() => exists && setSelectedClass(rel)}
                        className={`p-2 font-mono text-xs rounded border flex items-center gap-2 ${
                          exists
                            ? "bg-indigo-950/20 border-indigo-900 text-indigo-300 hover:bg-indigo-950/40 cursor-pointer"
                            : "bg-slate-900/30 border-slate-800 text-slate-500"
                        }`}
                      >
                        <Layers className="w-3.5 h-3.5" />
                        {rel}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 border-t border-slate-900 pt-3 text-[10px] font-mono text-slate-600">
                Interfaces enforce modular coupling bounds, preventing microsecond simulation thread locks during execution loops.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
