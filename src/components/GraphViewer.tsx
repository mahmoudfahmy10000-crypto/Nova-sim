import React, { useState } from "react";
import { PIPELINE_NODES, NodeElement } from "../architecture_doc";
import { Network, ArrowRight, Layers, Cpu, Database, CpuIcon, HelpCircle } from "lucide-react";

export default function GraphViewer() {
  const [selectedNodeId, setSelectedNodeId] = useState<string>("core-solver-cpp");

  const selectedNode = PIPELINE_NODES.find((n) => n.id === selectedNodeId) || PIPELINE_NODES[0];

  const getIcon = (type: string) => {
    switch (type) {
      case "client":
        return <Layers className="w-5 h-5 text-emerald-400" />;
      case "layer":
        return <Network className="w-5 h-5 text-indigo-400" />;
      case "module":
        return <Cpu className="w-5 h-5 text-amber-400" />;
      case "hardware":
        return <CpuIcon className="w-5 h-5 text-rose-400" />;
      case "database":
        return <Database className="w-5 h-5 text-blue-400" />;
      default:
        return <HelpCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getBgColor = (id: string) => {
    if (id === selectedNodeId) {
      return "border-emerald-500 bg-emerald-950/40 text-emerald-100 shadow-[0_0_12px_rgba(16,185,129,0.2)]";
    }
    return "border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:bg-slate-900";
  };

  return (
    <div className="bg-slate-950 border border-slate-900 rounded-xl p-6 shadow-2xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 border-b border-slate-900 pb-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
            <Network className="w-5 h-5 text-emerald-500" />
            Interactive Dependency Pipeline
          </h2>
          <p className="text-sm text-slate-400">
            Click on any module node to inspect its architectural purpose and downstream dependencies.
          </p>
        </div>
        <div className="mt-2 md:mt-0 flex gap-4 text-xs font-mono text-slate-500">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Client/UI
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span> Orchestrator
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Solver Module
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Graph Representation */}
        <div className="lg:col-span-2 bg-slate-900/40 border border-slate-900 rounded-lg p-4 flex flex-col justify-between relative min-h-[400px]">
          {/* Layer Header Grid */}
          <div className="absolute inset-0 grid grid-cols-3 pointer-events-none opacity-[0.03] border-x border-slate-500 divide-x divide-slate-500">
            <div></div>
            <div></div>
            <div></div>
          </div>

          <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
            {/* Column 1: Client & Data Boundaries */}
            <div className="flex flex-col gap-4 justify-center">
              <div className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-2 text-center border-b border-slate-900 pb-1">
                Ingress / Viewport
              </div>
              {PIPELINE_NODES.filter((n) => ["client", "database"].includes(n.type)).map((node) => (
                <button
                  key={node.id}
                  onClick={() => setSelectedNodeId(node.id)}
                  className={`w-full text-left p-3.5 border rounded-lg transition-all duration-200 flex items-start gap-3 ${getBgColor(
                    node.id
                  )}`}
                >
                  <div className="mt-0.5">{getIcon(node.type)}</div>
                  <div>
                    <div className="font-medium text-xs md:text-sm">{node.label}</div>
                    <div className="text-[10px] text-slate-500 font-mono capitalize">{node.type}</div>
                  </div>
                </button>
              ))}
            </div>

            {/* Column 2: Core Orchestration & Logic */}
            <div className="flex flex-col gap-4 justify-center">
              <div className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-2 text-center border-b border-slate-900 pb-1">
                Orchestration Layer
              </div>
              {PIPELINE_NODES.filter((n) => n.type === "layer").map((node) => (
                <button
                  key={node.id}
                  onClick={() => setSelectedNodeId(node.id)}
                  className={`w-full text-left p-3.5 border rounded-lg transition-all duration-200 flex items-start gap-3 ${getBgColor(
                    node.id
                  )}`}
                >
                  <div className="mt-0.5">{getIcon(node.type)}</div>
                  <div>
                    <div className="font-medium text-xs md:text-sm">{node.label}</div>
                    <div className="text-[10px] text-slate-500 font-mono capitalize">{node.type}</div>
                  </div>
                </button>
              ))}
            </div>

            {/* Column 3: Heavy Computation & Hardware */}
            <div className="flex flex-col gap-4 justify-center">
              <div className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-2 text-center border-b border-slate-900 pb-1">
                Compute Engine
              </div>
              {PIPELINE_NODES.filter((n) => ["module", "hardware"].includes(n.type)).map((node) => (
                <button
                  key={node.id}
                  onClick={() => setSelectedNodeId(node.id)}
                  className={`w-full text-left p-3.5 border rounded-lg transition-all duration-200 flex items-start gap-3 ${getBgColor(
                    node.id
                  )}`}
                >
                  <div className="mt-0.5">{getIcon(node.type)}</div>
                  <div>
                    <div className="font-medium text-xs md:text-sm">{node.label}</div>
                    <div className="text-[10px] text-slate-500 font-mono capitalize">{node.type}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Selected Node Details */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              {getIcon(selectedNode.type)}
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 capitalize">
                {selectedNode.type}
              </span>
            </div>
            <h3 className="text-lg font-semibold text-slate-100 mb-2">{selectedNode.label}</h3>
            <p className="text-sm text-slate-300 leading-relaxed mb-4">{selectedNode.description}</p>

            {selectedNode.dependencies.length > 0 ? (
              <div>
                <h4 className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-2">
                  Direct Dependencies (Downstream)
                </h4>
                <div className="flex flex-col gap-2">
                  {selectedNode.dependencies.map((depId) => {
                    const dep = PIPELINE_NODES.find((n) => n.id === depId);
                    return dep ? (
                      <div
                        key={depId}
                        onClick={() => setSelectedNodeId(depId)}
                        className="flex items-center gap-2 text-xs font-mono bg-slate-950/80 hover:bg-slate-950 p-2 border border-slate-800 hover:border-slate-700 text-emerald-400 cursor-pointer rounded transition-all"
                      >
                        <ArrowRight className="w-3 h-3 text-slate-500" />
                        {dep.label}
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            ) : (
              <div className="text-xs font-mono text-slate-500 italic mt-4">
                No external simulation dependencies. Operates as a leaf hardware/sandbox state.
              </div>
            )}
          </div>

          <div className="mt-6 border-t border-slate-800 pt-4">
            <h4 className="text-xs font-mono text-slate-500 uppercase mb-2">Architectural Standard</h4>
            <div className="text-xs text-slate-400 leading-relaxed font-mono">
              Inter-module bindings must be isolated using C++ namespace bounds or Rust boundary FFI structs. Avoid global locks.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
