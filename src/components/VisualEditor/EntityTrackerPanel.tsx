import React, { useState } from "react";
import { SimEntity, SimNode, ResourceState } from "../../core/simulation/types";
import {
  Search,
  Filter,
  Layers,
  History,
  Tag,
  Clock,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Sliders,
  Sparkles,
  Link2,
  Copy,
  FolderTree,
  Activity,
  Cpu,
  User
} from "lucide-react";

interface EntityTrackerPanelProps {
  entities: SimEntity[];
  nodes: SimNode[];
  resources?: Record<string, ResourceState>;
}

export default function EntityTrackerPanel({ entities, nodes, resources = {} }: EntityTrackerPanelProps) {
  const [activeSubTab, setActiveSubTab] = useState<"entities" | "resources">("entities");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  
  // Expanded item state maps
  const [expandedAttributes, setExpandedAttributes] = useState<Record<string, boolean>>({});
  const [expandedHistory, setExpandedHistory] = useState<Record<string, boolean>>({});
  const [expandedNested, setExpandedNested] = useState<Record<string, boolean>>({});

  // Helper to map node ID to human-readable name
  const getNodeName = (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    return node ? node.name : `Node: ${nodeId}`;
  };

  const toggleAttributes = (id: string) => {
    setExpandedAttributes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleHistory = (id: string) => {
    setExpandedHistory((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleNested = (id: string) => {
    setExpandedNested((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // 1. Statistics
  const totalCount = entities.length;
  const activeCount = entities.filter((e) => e.status !== "Completed").length;
  const completedCount = entities.filter((e) => e.status === "Completed").length;
  const vipCount = entities.filter((e) => e.type === "VIP").length;

  // 2. Filtration Logic
  const filteredEntities = entities.filter((entity) => {
    // Search query matches name, ID, labels, attributes or location
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      q === "" ||
      entity.id.toLowerCase().includes(q) ||
      entity.name.toLowerCase().includes(q) ||
      entity.type.toLowerCase().includes(q) ||
      (entity.labels && entity.labels.some((l) => l.toLowerCase().includes(q))) ||
      (entity.status && entity.status.toLowerCase().includes(q)) ||
      getNodeName(entity.currentLocationId).toLowerCase().includes(q);

    // Status filter
    const matchesStatus =
      statusFilter === "all" || entity.status.toLowerCase() === statusFilter.toLowerCase();

    // Type filter
    const matchesType =
      typeFilter === "all" || entity.type.toLowerCase() === typeFilter.toLowerCase();

    // Priority filter
    let matchesPriority = true;
    if (priorityFilter !== "all") {
      const prioNum = parseInt(priorityFilter, 10);
      matchesPriority = entity.priority === prioNum;
    }

    return matchesSearch && matchesStatus && matchesType && matchesPriority;
  });

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Sub tabs inside the side panel */}
      <div className="flex bg-slate-900/60 p-1 rounded-lg border border-slate-800 shrink-0 select-none">
        <button
          onClick={() => setActiveSubTab("entities")}
          className={`flex-1 py-1 px-2 rounded font-mono text-[9px] font-bold uppercase transition-colors cursor-pointer text-center ${
            activeSubTab === "entities"
              ? "bg-indigo-600/80 text-white"
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          Entities ({entities.length})
        </button>
        <button
          onClick={() => setActiveSubTab("resources")}
          className={`flex-1 py-1 px-2 rounded font-mono text-[9px] font-bold uppercase transition-colors cursor-pointer text-center ${
            activeSubTab === "resources"
              ? "bg-indigo-600/80 text-white"
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          Resource Pools ({Object.keys(resources).length})
        </button>
      </div>

      {activeSubTab === "entities" && (
        <>
          {/* Real-time KPI Stats Row */}
          <div className="grid grid-cols-2 gap-2 shrink-0">
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-900 flex flex-col justify-between">
              <span className="text-[8px] font-mono font-bold text-slate-500 uppercase tracking-wider">TRACKED</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-lg font-mono font-bold text-slate-200">{totalCount}</span>
                <span className="text-[8px] font-mono text-indigo-400">total</span>
              </div>
            </div>
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-900 flex flex-col justify-between">
              <span className="text-[8px] font-mono font-bold text-emerald-500 uppercase tracking-wider">COMPLETED</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-lg font-mono font-bold text-emerald-400">{completedCount}</span>
                <span className="text-[8px] font-mono text-slate-500">units</span>
              </div>
            </div>
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-900 flex flex-col justify-between">
              <span className="text-[8px] font-mono font-bold text-sky-400 uppercase tracking-wider">ACTIVE SYSTEM</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-lg font-mono font-bold text-sky-400">{activeCount}</span>
                <span className="text-[8px] font-mono text-slate-500">in-transit</span>
              </div>
            </div>
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-900 flex flex-col justify-between">
              <span className="text-[8px] font-mono font-bold text-amber-500 uppercase tracking-wider">VIP PRIORITY</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-lg font-mono font-bold text-amber-500">{vipCount}</span>
                <span className="text-[8px] font-mono text-slate-500">high-prio</span>
              </div>
            </div>
          </div>

          {/* Control Box: Search, Filters, Inputs */}
          <div className="bg-slate-900/40 border border-slate-900 p-3 rounded-xl space-y-2.5 shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search entities, labels, nodes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 pl-8 pr-3 py-2 text-xs font-mono rounded-lg border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500 placeholder:text-slate-600"
              />
            </div>

            {/* Quick Filters Grid */}
            <div className="grid grid-cols-3 gap-1.5 text-[9px] font-mono">
              <div>
                <label className="text-slate-500 block mb-1">TYPE</label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full bg-slate-950 text-slate-300 py-1 px-1.5 rounded border border-slate-880 focus:outline-none focus:border-indigo-500"
                >
                  <option value="all">All Types</option>
                  <option value="Standard">Standard</option>
                  <option value="VIP">VIP</option>
                  <option value="Express">Express</option>
                  <option value="Heavy">Heavy</option>
                </select>
              </div>

              <div>
                <label className="text-slate-500 block mb-1">STATUS</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full bg-slate-950 text-slate-300 py-1 px-1.5 rounded border border-slate-880 focus:outline-none focus:border-indigo-500"
                >
                  <option value="all">All States</option>
                  <option value="Arrived">Arrived</option>
                  <option value="Queued">Queued</option>
                  <option value="InService">In Service</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              <div>
                <label className="text-slate-500 block mb-1">PRIO</label>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="w-full bg-slate-950 text-slate-300 py-1 px-1.5 rounded border border-slate-880 focus:outline-none focus:border-indigo-500"
                >
                  <option value="all">All Prio</option>
                  <option value="1">1 (Low)</option>
                  <option value="2">2 (Med)</option>
                  <option value="3">3 (High)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Result Cards Lists */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 max-h-[600px] scrollbar-thin">
            {filteredEntities.map((entity) => {
              const isCompleted = entity.status === "Completed";
              const isQueued = entity.status === "Queued";
              const isInService = entity.status === "InService";

              const statusColorClass = isCompleted
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : isQueued
                ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                : isInService
                ? "bg-sky-500/10 border-sky-500/30 text-sky-400"
                : "bg-slate-500/10 border-slate-500/30 text-slate-400";

              return (
                <div
                  key={entity.id}
                  className="bg-slate-900/45 border border-slate-900 rounded-xl p-3 hover:border-slate-800 transition-colors space-y-2.5 relative overflow-hidden"
                >
                  {/* Colored left bar indicator */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1"
                    style={{ backgroundColor: entity.color }}
                  />

                  {/* Header Info */}
                  <div className="flex items-center justify-between pl-1">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono font-bold text-slate-200">
                          {entity.id}
                        </span>
                        {entity.parentEntityId && (
                          <span className="text-[8px] font-mono text-indigo-400 flex items-center gap-0.5" title={`Split from parent: ${entity.parentEntityId}`}>
                            <Copy className="w-2.5 h-2.5" />
                            cloned
                          </span>
                        )}
                      </div>
                      <h4 className="text-[11px] font-bold text-slate-300 font-sans tracking-wide">
                        {entity.name}
                      </h4>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`text-[8px] font-mono px-2 py-0.5 rounded-full border ${statusColorClass}`}>
                        {entity.status.toUpperCase()}
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="text-[8px] font-mono text-slate-500">PRIO:</span>
                        <span className={`text-[9px] font-mono font-bold ${entity.priority >= 3 ? 'text-amber-500' : entity.priority === 2 ? 'text-indigo-400' : 'text-slate-400'}`}>
                          {entity.priority}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Tag/Labels List */}
                  {entity.labels && entity.labels.length > 0 && (
                    <div className="flex flex-wrap gap-1 pl-1">
                      {entity.labels.map((label, lIdx) => (
                        <span
                          key={lIdx}
                          className="text-[8px] font-mono bg-slate-950 hover:bg-slate-900 text-slate-400 px-1.5 py-0.5 rounded border border-slate-850 flex items-center gap-1 shrink-0"
                        >
                          <Tag className="w-2 h-2 text-indigo-500" />
                          {label}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Location indicator */}
                  <div className="bg-slate-950/80 px-2 py-1 rounded border border-slate-850 flex items-center justify-between text-[9px] font-mono pl-1 ml-1">
                    <span className="text-slate-500">CURRENT POSITION</span>
                    <span className="text-slate-300 font-bold">
                      {getNodeName(entity.currentLocationId)}
                    </span>
                  </div>

                  {/* Actions row for collapsing details */}
                  <div className="flex items-center gap-2 pl-1 pt-1 border-t border-slate-900">
                    {/* Attributes toggle */}
                    <button
                      onClick={() => toggleAttributes(entity.id)}
                      className="flex items-center gap-1 text-[9px] font-mono text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {expandedAttributes[entity.id] ? (
                        <ChevronDown className="w-3 h-3 text-indigo-400" />
                      ) : (
                        <ChevronRight className="w-3 h-3" />
                      )}
                      <span>Attributes</span>
                    </button>

                    {/* History list toggle */}
                    <button
                      onClick={() => toggleHistory(entity.id)}
                      className="flex items-center gap-1 text-[9px] font-mono text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {expandedHistory[entity.id] ? (
                        <ChevronDown className="w-3 h-3 text-indigo-400" />
                      ) : (
                        <ChevronRight className="w-3 h-3" />
                      )}
                      <span>History ({entity.history?.length || 0})</span>
                    </button>

                    {/* Nested entities toggle */}
                    {entity.batchedEntities && entity.batchedEntities.length > 0 && (
                      <button
                        onClick={() => toggleNested(entity.id)}
                        className="flex items-center gap-1 text-[9px] font-mono text-indigo-400 hover:text-indigo-300 transition-colors ml-auto"
                      >
                        <FolderTree className="w-3.5 h-3.5" />
                        <span>Contents ({entity.batchedEntities.length})</span>
                      </button>
                    )}
                  </div>

                  {/* Collapsed Section: Attributes */}
                  {expandedAttributes[entity.id] && (
                    <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-855 space-y-1 ml-1 text-[9px] font-mono animate-fade-in">
                      <div className="flex items-center justify-between pb-1 border-b border-slate-900 text-slate-500">
                        <span>PROPERTY</span>
                        <span>VALUE</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Creation Time</span>
                        <span className="text-indigo-400">{entity.creationTime.toFixed(2)}s</span>
                      </div>
                      {entity.attributes &&
                        Object.entries(entity.attributes).map(([key, val]) => (
                          <div key={key} className="flex justify-between">
                            <span className="text-slate-600">{key}</span>
                            <span className="text-emerald-400 font-bold">
                              {typeof val === "object" ? JSON.stringify(val) : String(val)}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Collapsed Section: Nested Combined entities */}
                  {expandedNested[entity.id] && entity.batchedEntities && (
                    <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-855/60 ml-1 space-y-2 animate-fade-in">
                      <span className="text-[8px] font-mono font-bold text-indigo-400 uppercase tracking-wider block">
                        Nested Assembled Components
                      </span>
                      <div className="space-y-1.5">
                        {entity.batchedEntities.map((sub) => (
                          <div
                            key={sub.id}
                            className="flex items-center justify-between text-[9px] font-mono bg-slate-900/60 p-1 rounded px-1.5 border border-slate-855/50"
                          >
                            <div className="flex items-center gap-1.5">
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: sub.color }}
                              />
                              <span className="text-slate-300 font-bold">{sub.id}</span>
                              <span className="text-slate-500">{sub.name}</span>
                            </div>
                            <span className="text-indigo-400 text-[8px] uppercase">{sub.type}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Collapsed Section: Real-time History Audit Timeline */}
                  {expandedHistory[entity.id] && (
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-855 space-y-3.5 ml-1 animate-fade-in">
                      <span className="text-[8px] font-mono font-bold text-slate-500 uppercase tracking-wider block">
                        Real-time History Audit Trail
                      </span>
                      <div className="relative pl-3.5 border-l border-slate-855 space-y-3.5">
                        {entity.history && entity.history.length > 0 ? (
                          entity.history.map((hist, histIdx) => (
                            <div key={histIdx} className="relative text-[9px] font-mono leading-normal">
                              {/* Timeline dot */}
                              <div className="absolute -left-[18.5px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-500 border-2 border-slate-950" />
                              
                              <div className="flex items-baseline justify-between gap-2 text-[8px] text-slate-500 font-bold mb-0.5">
                                <span className="text-indigo-400 bg-indigo-950/40 px-1 rounded">
                                  T={hist.time.toFixed(2)}s
                                </span>
                                <span>{hist.nodeName}</span>
                              </div>
                              
                              <div className="text-slate-300">
                                <span className="text-emerald-400 font-semibold uppercase mr-1">
                                  [{hist.status}]
                                </span>
                                {hist.description}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-slate-600 italic text-[9px]">No historical state changes recorded.</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {filteredEntities.length === 0 && (
              <div className="text-slate-600 text-center py-12 font-mono text-[10px] italic">
                No entities matching search criteria. Start simulation to generate entities.
              </div>
            )}
          </div>
        </>
      )}

      {activeSubTab === "resources" && (
        <div className="flex-1 flex flex-col space-y-4 overflow-y-auto max-h-[650px] pr-1">
          {Object.entries(resources).map(([resId, res]) => {
            const hasUnits = res.units && res.units.length > 0;
            return (
              <div
                key={resId}
                className="bg-slate-900/45 border border-slate-900 rounded-xl p-3 hover:border-slate-800 transition-colors space-y-2.5"
              >
                {/* Header info */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded bg-indigo-950/40 border border-indigo-900/30">
                      {res.resourceType === "Machine" ? (
                        <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                      ) : (
                        <User className="w-3.5 h-3.5 text-indigo-400" />
                      )}
                    </div>
                    <div>
                      <span className="text-[8px] font-mono font-bold text-indigo-400 uppercase">
                        {res.resourceType || "Worker"}
                      </span>
                      <h4 className="text-[11px] font-bold text-slate-300 mt-0.5">{res.name}</h4>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-mono font-bold text-emerald-400">
                      {(res.utilization * 100).toFixed(0)}%
                    </span>
                    <span className="text-[7.5px] font-mono text-slate-500 block uppercase tracking-wider">UTILIZATION</span>
                  </div>
                </div>

                {/* Pool summary bars */}
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-855 space-y-1.5 text-[9px] font-mono">
                  <div className="flex justify-between text-slate-500 text-[8px] font-bold">
                    <span>CAPACITY POOL</span>
                    <span>{res.occupiedCount} / {res.capacity} BUSY</span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-indigo-500 h-full transition-all duration-300"
                      style={{ width: `${Math.min(100, (res.occupiedCount / res.capacity) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Schedule & Breakdown overview icons */}
                <div className="flex flex-wrap gap-1">
                  <span className={`text-[7.5px] font-mono px-1.5 py-0.5 rounded border ${res.shiftEnabled ? 'bg-indigo-950/20 border-indigo-900/30 text-indigo-400' : 'bg-slate-950 border-slate-900 text-slate-600'}`}>
                    SHIFTS: {res.shiftEnabled ? `${res.shiftStart}-${res.shiftEnd}s` : 'OFF'}
                  </span>
                  <span className={`text-[7.5px] font-mono px-1.5 py-0.5 rounded border ${res.breakEnabled ? 'bg-amber-950/20 border-amber-900/30 text-amber-400' : 'bg-slate-950 border-slate-900 text-slate-600'}`}>
                    BREAKS: {res.breakEnabled ? `${res.breakStart}-${res.breakEnd}s` : 'OFF'}
                  </span>
                  <span className={`text-[7.5px] font-mono px-1.5 py-0.5 rounded border ${res.failureEnabled ? 'bg-red-950/20 border-red-900/30 text-red-400' : 'bg-slate-950 border-slate-900 text-slate-600'}`}>
                    FAILURES: {res.failureEnabled ? `MTBF ${res.failureMTBF}s` : 'OFF'}
                  </span>
                  <span className={`text-[7.5px] font-mono px-1.5 py-0.5 rounded border ${res.maintenanceEnabled ? 'bg-purple-950/20 border-purple-900/30 text-purple-400' : 'bg-slate-950 border-slate-900 text-slate-600'}`}>
                    PREVENTIVE: {res.maintenanceEnabled ? `${res.maintenanceInterval}s` : 'OFF'}
                  </span>
                </div>

                {/* Individual units tracker */}
                {hasUnits && (
                  <div className="space-y-1 pt-1.5 border-t border-slate-900/60">
                    <span className="text-[8px] font-mono font-bold text-slate-500 uppercase tracking-wider block">
                      Individual Unitary States:
                    </span>
                    <div className="space-y-1">
                      {res.units?.map((unit, uIdx) => {
                        let statusColor = "text-slate-400 bg-slate-950 border-slate-900";
                        if (unit.state === "Busy") statusColor = "text-indigo-400 bg-indigo-950/40 border-indigo-900/30";
                        else if (unit.state === "OnBreak") statusColor = "text-amber-400 bg-amber-950/40 border-amber-900/30";
                        else if (unit.state === "Breakdown") statusColor = "text-red-400 bg-red-950/40 border-red-900/30";
                        else if (unit.state === "UnderMaintenance") statusColor = "text-purple-400 bg-purple-950/40 border-purple-900/30";
                        else if (unit.state === "OffShift") statusColor = "text-slate-600 bg-slate-950 border-slate-900";

                        return (
                          <div
                            key={uIdx}
                            className="flex items-center justify-between text-[9px] font-mono bg-slate-950/50 p-1 px-2 rounded border border-slate-855/60"
                          >
                            <span className="text-slate-300 font-bold">{unit.name}</span>
                            <div className="flex items-center gap-1.5">
                              {unit.assignedEntityId && (
                                <span className="text-[8px] text-slate-500 font-mono">
                                  Hold: <span className="text-indigo-400">{unit.assignedEntityId}</span>
                                </span>
                              )}
                              <span className={`text-[7px] uppercase font-bold px-1.5 py-0.2 rounded border ${statusColor}`}>
                                {unit.state}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {Object.keys(resources).length === 0 && (
            <div className="text-slate-600 text-center py-12 font-mono text-[10px] italic">
              No active resource pools loaded. Add resource nodes to monitor schedules and breakdowns.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
