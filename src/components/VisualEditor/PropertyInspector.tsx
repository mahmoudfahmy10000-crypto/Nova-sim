import React, { useEffect, useState, useRef } from "react";
import { SimNode, NodeType, NodeProperties, SimConnection } from "../../core/simulation/types";
import {
  Sliders,
  Settings,
  Check,
  HelpCircle,
  Activity,
  Link2,
  RotateCw,
  Search,
  X,
  Trash2,
  Layout,
  Lock,
  Eye,
  EyeOff,
  Hash,
  Compass,
  Paintbrush,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  ChevronRight
} from "lucide-react";

interface PropertyInspectorProps {
  selectedNode: SimNode | null;
  selectedNodes?: SimNode[];
  selectedConnection?: SimConnection | null;
  selectedConnections?: SimConnection[];
  onUpdateProperties: (id: string, properties: Partial<NodeProperties>, name?: string) => void;
  onUpdateMultipleNodesProperties?: (ids: string[], properties: Partial<NodeProperties>, name?: string) => void;
  onUpdateConnectionProperties?: (id: string, properties: Partial<SimConnection>) => void;
  onUpdateMultipleConnectionsProperties?: (ids: string[], properties: Partial<SimConnection>) => void;
  utilizationStats?: {
    utilization: number;
    queueLength: number;
    occupiedCount: number;
  };
}

// Default property specifications for the standard node library
const DEFAULT_NODE_PROPERTIES: Partial<Record<NodeType, Partial<NodeProperties>>> = {
  source: { arrivalInterval: 10, distribution: "exponential", color: "#10b981", width: 140, height: 52, rotation: 0 },
  queue: { capacity: 9999, color: "#eab308", width: 140, height: 52, rotation: 0 },
  processor: { processingTime: 8, capacity: 1, distribution: "exponential", color: "#6366f1", width: 140, height: 52, rotation: 0 },
  sink: { color: "#ef4444", width: 140, height: 52, rotation: 0 },
  router: { routeProbability: 0.5, color: "#64748b", width: 140, height: 52, rotation: 0 },
  conveyor: { conveyorSpeed: 1.0, conveyorLength: 10, capacity: 10, color: "#06b6d4", width: 140, height: 52, rotation: 0 },
  resource: { resourceType: "Worker", quantity: 1, color: "#a855f7", width: 140, height: 52, rotation: 0 },
  transporter: { transporterSpeed: 2.0, transporterCapacity: 5, color: "#f97316", width: 140, height: 52, rotation: 0 },
  separator: { separatorType: "split", separatorSplitRatio: 0.5, color: "#ec4899", width: 140, height: 52, rotation: 0 },
  combiner: { combinerType: "batch", combinerBatchSize: 2, color: "#8b5cf6", width: 140, height: 52, rotation: 0 }
};

export default function PropertyInspector({
  selectedNode,
  selectedNodes = [],
  selectedConnection = null,
  selectedConnections = [],
  onUpdateProperties,
  onUpdateMultipleNodesProperties,
  onUpdateConnectionProperties,
  onUpdateMultipleConnectionsProperties,
  utilizationStats
}: PropertyInspectorProps) {
  // Search and Category states
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<"all" | "identity" | "geometry" | "simulation" | "visuals">("all");

  // Collapsible accordion group states
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    identity: true,
    geometry: true,
    simulation: true,
    visuals: true,
    connections: true
  });

  // Local editing validation error states
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Unified selections
  const activeNodes = selectedNodes.length > 0 ? selectedNodes : (selectedNode ? [selectedNode] : []);
  const activeConnections = selectedConnections.length > 0 ? selectedConnections : (selectedConnection ? [selectedConnection] : []);

  const isMultiNode = activeNodes.length > 1;
  const isMultiConn = activeConnections.length > 1;

  // Track focusing for Undo/Redo history snapshots
  const isTypingRef = useRef(false);

  const handleFieldFocus = () => {
    isTypingRef.current = true;
  };

  const handleFieldBlur = () => {
    isTypingRef.current = false;
  };

  // Toggle helper for accordion headers
  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  // Helper to extract a value across selected elements (shows Mixed "—" placeholder if they differ)
  const getUnifiedValue = <T,>(
    elements: T[],
    extractor: (el: T) => any,
    fallback: any = ""
  ): { value: any; isMixed: boolean } => {
    if (elements.length === 0) return { value: fallback, isMixed: false };
    const firstVal = extractor(elements[0]);
    const allSame = elements.every((el) => extractor(el) === firstVal);
    return {
      value: allSame ? (firstVal !== undefined ? firstVal : fallback) : "",
      isMixed: !allSame
    };
  };

  // Unify standard node fields
  const unifiedNodeName = getUnifiedValue(activeNodes, (n) => n.name);
  const unifiedNodeX = getUnifiedValue(activeNodes, (n) => n.x);
  const unifiedNodeY = getUnifiedValue(activeNodes, (n) => n.y);
  const unifiedNodeWidth = getUnifiedValue(activeNodes, (n) => n.properties.width ?? 140);
  const unifiedNodeHeight = getUnifiedValue(activeNodes, (n) => n.properties.height ?? 52);
  const unifiedNodeRotation = getUnifiedValue(activeNodes, (n) => n.properties.rotation ?? 0);
  const unifiedNodeColor = getUnifiedValue(activeNodes, (n) => n.properties.color ?? "#6366f1");
  const unifiedNodeLocked = getUnifiedValue(activeNodes, (n) => n.properties.isLocked ?? false);
  const unifiedNodeShowLabel = getUnifiedValue(activeNodes, (n) => n.properties.showLabel ?? true);
  const unifiedNodeShowStats = getUnifiedValue(activeNodes, (n) => n.properties.showStatsLabel ?? true);
  const unifiedNodeDescription = getUnifiedValue(activeNodes, (n) => (n.properties as any).description ?? "");

  // Unify simulation specific properties
  const unifiedArrivalInterval = getUnifiedValue(activeNodes, (n) => n.properties.arrivalInterval ?? 10);
  const unifiedProcessingTime = getUnifiedValue(activeNodes, (n) => n.properties.processingTime ?? 8);
  const unifiedCapacity = getUnifiedValue(activeNodes, (n) => n.properties.capacity ?? 1);
  const unifiedDistribution = getUnifiedValue(activeNodes, (n) => n.properties.distribution ?? "exponential");
  const unifiedRouteProbability = getUnifiedValue(activeNodes, (n) => n.properties.routeProbability ?? 0.5);

  const unifiedConveyorSpeed = getUnifiedValue(activeNodes, (n) => n.properties.conveyorSpeed ?? 1.0);
  const unifiedConveyorLength = getUnifiedValue(activeNodes, (n) => n.properties.conveyorLength ?? 10);
  const unifiedResourceType = getUnifiedValue(activeNodes, (n) => n.properties.resourceType ?? "Worker");
  const unifiedQuantity = getUnifiedValue(activeNodes, (n) => n.properties.quantity ?? 1);
  const unifiedTransporterSpeed = getUnifiedValue(activeNodes, (n) => n.properties.transporterSpeed ?? 2.0);
  const unifiedTransporterCapacity = getUnifiedValue(activeNodes, (n) => n.properties.transporterCapacity ?? 5);
  const unifiedSeparatorType = getUnifiedValue(activeNodes, (n) => n.properties.separatorType ?? "split");
  const unifiedSeparatorSplitRatio = getUnifiedValue(activeNodes, (n) => n.properties.separatorSplitRatio ?? 0.5);
  const unifiedCombinerType = getUnifiedValue(activeNodes, (n) => n.properties.combinerType ?? "batch");
  const unifiedCombinerBatchSize = getUnifiedValue(activeNodes, (n) => n.properties.combinerBatchSize ?? 2);

  // Unify Phase 10 Resource properties
  const unifiedShiftEnabled = getUnifiedValue(activeNodes, (n) => n.properties.shiftEnabled ?? true);
  const unifiedShiftStart = getUnifiedValue(activeNodes, (n) => n.properties.shiftStart ?? 0);
  const unifiedShiftEnd = getUnifiedValue(activeNodes, (n) => n.properties.shiftEnd ?? 400);
  const unifiedShiftCycle = getUnifiedValue(activeNodes, (n) => n.properties.shiftCycle ?? 500);

  const unifiedBreakEnabled = getUnifiedValue(activeNodes, (n) => n.properties.breakEnabled ?? false);
  const unifiedBreakStart = getUnifiedValue(activeNodes, (n) => n.properties.breakStart ?? 150);
  const unifiedBreakEnd = getUnifiedValue(activeNodes, (n) => n.properties.breakEnd ?? 185);
  const unifiedBreakCycle = getUnifiedValue(activeNodes, (n) => n.properties.breakCycle ?? 500);

  const unifiedFailureEnabled = getUnifiedValue(activeNodes, (n) => n.properties.failureEnabled ?? false);
  const unifiedFailureMTBF = getUnifiedValue(activeNodes, (n) => n.properties.failureMTBF ?? 200);
  const unifiedFailureMTTR = getUnifiedValue(activeNodes, (n) => n.properties.failureMTTR ?? 40);

  const unifiedMaintenanceEnabled = getUnifiedValue(activeNodes, (n) => n.properties.maintenanceEnabled ?? false);
  const unifiedMaintenanceInterval = getUnifiedValue(activeNodes, (n) => n.properties.maintenanceInterval ?? 300);
  const unifiedMaintenanceDuration = getUnifiedValue(activeNodes, (n) => n.properties.maintenanceDuration ?? 30);

  // Unify standard connection fields
  const unifiedConnLabel = getUnifiedValue(activeConnections, (c) => c.label ?? "");
  const unifiedConnWeight = getUnifiedValue(activeConnections, (c) => c.weight);
  const unifiedConnDelay = getUnifiedValue(activeConnections, (c) => c.delay);
  const unifiedConnColor = getUnifiedValue(activeConnections, (c) => c.color ?? "#475569");
  const unifiedConnStyle = getUnifiedValue(activeConnections, (c) => c.style ?? "bezier");
  const unifiedConnDashArray = getUnifiedValue(activeConnections, (c) => c.dashArray ?? "");

  // Detect types in multiple selection
  const nodeTypes = Array.from(new Set(activeNodes.map((n) => n.type)));
  const allNodesSameType = nodeTypes.length === 1;
  const commonType = allNodesSameType ? nodeTypes[0] : null;

  // Validation helper
  const validateField = (key: string, value: any, rules: { type: "number" | "text" | "color" | "probability"; min?: number; max?: number; required?: boolean }) => {
    let err = "";
    if (rules.required && (value === "" || value === undefined)) {
      err = "This field is required";
    } else if (rules.type === "number") {
      const num = Number(value);
      if (isNaN(num)) {
        err = "Must be a valid number";
      } else {
        if (rules.min !== undefined && num < rules.min) err = `Min value is ${rules.min}`;
        if (rules.max !== undefined && num > rules.max) err = `Max value is ${rules.max}`;
      }
    } else if (rules.type === "probability") {
      const num = Number(value);
      if (isNaN(num) || num < 0.0 || num > 1.0) {
        err = "Must be between 0.0 and 1.0";
      }
    } else if (rules.type === "color") {
      const hexRegex = /^#[0-9A-F]{6}$/i;
      if (!hexRegex.test(value)) {
        err = "Format: #RRGGBB";
      }
    }

    setErrors((prev) => {
      const next = { ...prev };
      if (err) next[key] = err;
      else delete next[key];
      return next;
    });

    return !err;
  };

  // Trigger property updates (either single or multi-selected objects)
  const triggerNodePropertyUpdate = (propKey: string, val: any, isName: boolean = false) => {
    if (activeNodes.length === 0) return;

    if (isMultiNode && onUpdateMultipleNodesProperties) {
      if (isName) {
        onUpdateMultipleNodesProperties(activeNodes.map((n) => n.id), {}, val);
      } else {
        onUpdateMultipleNodesProperties(activeNodes.map((n) => n.id), { [propKey]: val });
      }
    } else if (selectedNode) {
      if (isName) {
        onUpdateProperties(selectedNode.id, {}, val);
      } else {
        onUpdateProperties(selectedNode.id, { [propKey]: val });
      }
    }
  };

  const triggerConnectionPropertyUpdate = (propKey: string, val: any) => {
    if (activeConnections.length === 0) return;

    if (isMultiConn && onUpdateMultipleConnectionsProperties) {
      onUpdateMultipleConnectionsProperties(activeConnections.map((c) => c.id), { [propKey]: val });
    } else if (selectedConnection && onUpdateConnectionProperties) {
      onUpdateConnectionProperties(selectedConnection.id, { [propKey]: val });
    }
  };

  // Reset node to factory defaults
  const handleResetToDefaults = () => {
    if (activeNodes.length === 0) return;

    const targetType = commonType || activeNodes[0].type;
    const defaults = DEFAULT_NODE_PROPERTIES[targetType];

    if (isMultiNode && onUpdateMultipleNodesProperties) {
      onUpdateMultipleNodesProperties(activeNodes.map((n) => n.id), defaults);
    } else if (selectedNode) {
      onUpdateProperties(selectedNode.id, defaults);
    }
    setErrors({});
  };

  const handleResetConnectionToDefaults = () => {
    if (activeConnections.length === 0) return;
    const defaults: Partial<SimConnection> = {
      label: "",
      weight: undefined,
      delay: undefined,
      color: "#475569",
      style: "bezier",
      dashArray: ""
    };

    if (isMultiConn && onUpdateMultipleConnectionsProperties) {
      onUpdateMultipleConnectionsProperties(activeConnections.map((c) => c.id), defaults);
    } else if (selectedConnection && onUpdateConnectionProperties) {
      onUpdateConnectionProperties(selectedConnection.id, defaults);
    }
  };

  // Rendering Helper: determines if a property should be visible based on Search Query and Category Filter
  const isFieldVisible = (label: string, category: "identity" | "geometry" | "simulation" | "visuals") => {
    if (activeCategory !== "all" && activeCategory !== category) return false;
    if (!searchQuery) return true;
    return label.toLowerCase().includes(searchQuery.toLowerCase());
  };

  // Color Swatches
  const colorSwatches = [
    "#6366f1", // Indigo
    "#a855f7", // Purple
    "#ec4899", // Pink
    "#ef4444", // Red
    "#f97316", // Orange
    "#eab308", // Yellow
    "#10b981", // Emerald
    "#06b6d4", // Cyan
    "#3b82f6", // Sky
    "#64748b", // Slate
    "#1e293b", // Deep Navy
    "#475569"  // Dark Slate
  ];

  // Helper for rendering custom property labels with optional help/validation indicators
  const renderFieldHeader = (label: string, errorKey: string, description?: string) => {
    const errorMsg = errors[errorKey];
    return (
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[9px] font-mono text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
          {label}
          {description && (
            <HelpCircle className="w-3 h-3 text-slate-600 hover:text-slate-400 cursor-help" title={description} />
          )}
        </span>
        {errorMsg && (
          <span className="text-[8px] font-semibold font-mono text-red-400 flex items-center gap-1 bg-red-950/40 border border-red-900/30 px-1 rounded">
            <AlertCircle className="w-2.5 h-2.5" />
            {errorMsg}
          </span>
        )}
      </div>
    );
  };

  // If nothing is selected, display clear welcome panel
  if (activeNodes.length === 0 && activeConnections.length === 0) {
    return (
      <div className="flex flex-col h-full bg-slate-950/40 p-5 rounded-xl border border-slate-900/50 justify-center items-center text-center select-none py-14">
        <Sliders className="w-9 h-9 text-slate-700 stroke-1 animate-pulse" />
        <p className="text-xs font-mono text-slate-500 mt-4 uppercase tracking-wider font-bold">
          Inspector Offline
        </p>
        <p className="text-[10px] text-slate-600 font-mono mt-2 max-w-[200px] leading-relaxed">
          Select nodes, wires, or drag marquee over elements in the 2D schema workspace to access the Parameters Inspector.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-4 h-full">
      
      {/* Selection Stats and Main Header */}
      <div className="flex items-center justify-between border-b border-slate-900 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-indigo-950/40 border border-indigo-900/50 shrink-0">
            <Sliders className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-indigo-400">
              Schematic Inspector
            </span>
            <h2 className="text-xs font-bold text-slate-200 mt-0.5">
              {isMultiNode
                ? `MULTI-NODE EDITING (${activeNodes.length})`
                : isMultiConn
                ? `MULTI-WIRE EDITING (${activeConnections.length})`
                : activeNodes.length === 1
                ? `${activeNodes[0].type.toUpperCase()}: ${activeNodes[0].name}`
                : "CONNECTION INTERFACE"}
            </h2>
          </div>
        </div>
        
        {/* Quick Reset Button */}
        <button
          onClick={activeNodes.length > 0 ? handleResetToDefaults : handleResetConnectionToDefaults}
          className="p-1 px-1.5 hover:bg-slate-900 text-[8px] font-mono uppercase bg-slate-950 hover:text-slate-200 border border-slate-850 rounded text-slate-500 cursor-pointer transition-all flex items-center gap-1"
          title="Restore standard values of matching classes"
        >
          <RefreshCw className="w-2.5 h-2.5" />
          <span>Reset Class</span>
        </button>
      </div>

      {/* Toolbar Search & Category Tabs */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search parameter properties..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 text-slate-200 placeholder-slate-600 border border-slate-900 rounded-lg pl-8 pr-7 py-2 text-[10px] font-mono focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-2.5 p-0.5 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-900"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Tab Filters */}
        <div className="flex p-0.5 bg-slate-950 rounded-lg border border-slate-900 select-none overflow-x-auto scrollbar-none">
          {(["all", "identity", "geometry", "simulation", "visuals"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveCategory(tab)}
              className={`flex-1 text-center py-1 rounded text-[8px] font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap px-1.5 ${
                activeCategory === tab
                  ? "bg-slate-900 text-indigo-400 border border-slate-800"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Accordions & Parameter Fields Panel */}
      <div className="flex-1 space-y-3 pr-0.5">

        {/* === CONNECTION PANEL === */}
        {activeConnections.length > 0 && activeNodes.length === 0 && (
          <div className="space-y-3">
            
            {/* 1. Wire Identities */}
            {expandedGroups.connections && (
              <div className="bg-slate-900/10 border border-slate-900/50 rounded-xl p-3.5 space-y-3.5">
                
                {/* Src / Target Readonly info */}
                {!isMultiConn && (
                  <div className="grid grid-cols-2 gap-2 text-slate-400 select-text">
                    <div className="bg-slate-950/50 border border-slate-950 p-2 rounded">
                      <span className="text-[7px] font-mono uppercase text-slate-600 block">Source ID</span>
                      <span className="text-[9px] font-mono truncate block">{activeConnections[0].sourceId}</span>
                    </div>
                    <div className="bg-slate-950/50 border border-slate-950 p-2 rounded">
                      <span className="text-[7px] font-mono uppercase text-slate-600 block">Target ID</span>
                      <span className="text-[9px] font-mono truncate block">{activeConnections[0].targetId}</span>
                    </div>
                  </div>
                )}

                {/* Connection Label */}
                {isFieldVisible("Wire Label", "identity") && (
                  <div>
                    {renderFieldHeader("Wire Label / Route Tag", "connLabel", "Text label displayed adjacent to the route path")}
                    <input
                      type="text"
                      value={unifiedConnLabel.isMixed ? "" : unifiedConnLabel.value}
                      placeholder={unifiedConnLabel.isMixed ? "— Mixed values —" : "Enter descriptive label..."}
                      onFocus={handleFieldFocus}
                      onBlur={handleFieldBlur}
                      onChange={(e) => {
                        const val = e.target.value;
                        triggerConnectionPropertyUpdate("label", val);
                      }}
                      className={`w-full bg-slate-950 text-slate-200 border rounded pl-2.5 py-1.5 text-[10px] font-mono focus:outline-none transition-all ${
                        errors.connLabel ? "border-red-500" : "border-slate-900 focus:border-indigo-600"
                      }`}
                    />
                  </div>
                )}
              </div>
            )}

            {/* 2. Connection Routing Parameters */}
            {expandedGroups.simulation && (
              <div className="bg-slate-900/10 border border-slate-900/50 rounded-xl p-3.5 space-y-3.5">
                <div className="text-[10px] font-mono font-bold text-slate-400 mb-1 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-900 pb-1.5">
                  <Settings className="w-3.5 h-3.5 text-slate-500" />
                  Routing Parameters
                </div>

                {/* Transfer Weight */}
                {isFieldVisible("Routing Weight", "simulation") && (
                  <div>
                    {renderFieldHeader("Routing Weight (0.0 - 1.0)", "connWeight", "Custom proportional selection weight used by branching routing engines")}
                    <input
                      type="number"
                      step="0.1"
                      value={unifiedConnWeight.isMixed ? "" : (unifiedConnWeight.value ?? "")}
                      placeholder={unifiedConnWeight.isMixed ? "— Mixed values —" : "Unassigned (Equal weight)"}
                      onFocus={handleFieldFocus}
                      onBlur={handleFieldBlur}
                      onChange={(e) => {
                        const valStr = e.target.value;
                        if (valStr === "") {
                          triggerConnectionPropertyUpdate("weight", undefined);
                          return;
                        }
                        const val = parseFloat(valStr);
                        if (validateField("connWeight", val, { type: "probability" })) {
                          triggerConnectionPropertyUpdate("weight", val);
                        }
                      }}
                      className={`w-full bg-slate-950 text-slate-200 border rounded pl-2.5 py-1.5 text-[10px] font-mono focus:outline-none transition-all ${
                        errors.connWeight ? "border-red-500 animate-pulse" : "border-slate-900 focus:border-indigo-600"
                      }`}
                    />
                  </div>
                )}

                {/* Speed Delay */}
                {isFieldVisible("Transit Delay", "simulation") && (
                  <div>
                    {renderFieldHeader("Transit Delay (seconds)", "connDelay", "Absolute transfer wait duration added when entities traverse this connection wire")}
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={unifiedConnDelay.isMixed ? "" : (unifiedConnDelay.value ?? "")}
                      placeholder={unifiedConnDelay.isMixed ? "— Mixed values —" : "Instantaneous (0)"}
                      onFocus={handleFieldFocus}
                      onBlur={handleFieldBlur}
                      onChange={(e) => {
                        const valStr = e.target.value;
                        if (valStr === "") {
                          triggerConnectionPropertyUpdate("delay", undefined);
                          return;
                        }
                        const val = parseFloat(valStr);
                        if (validateField("connDelay", val, { type: "number", min: 0 })) {
                          triggerConnectionPropertyUpdate("delay", val);
                        }
                      }}
                      className={`w-full bg-slate-950 text-slate-200 border rounded pl-2.5 py-1.5 text-[10px] font-mono focus:outline-none transition-all ${
                        errors.connDelay ? "border-red-500 animate-pulse" : "border-slate-900 focus:border-indigo-600"
                      }`}
                    />
                  </div>
                )}
              </div>
            )}

            {/* 3. Connection Visual Style */}
            {expandedGroups.visuals && (
              <div className="bg-slate-900/10 border border-slate-900/50 rounded-xl p-3.5 space-y-3.5">
                <div className="text-[10px] font-mono font-bold text-slate-400 mb-1 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-900 pb-1.5">
                  <Paintbrush className="w-3.5 h-3.5 text-slate-500" />
                  Styling & Layout
                </div>

                {/* Wire Style / Path formulation */}
                {isFieldVisible("Wire Style", "visuals") && (
                  <div>
                    {renderFieldHeader("Wire Routing Formula", "connStyle", "Select path auto-routing layout formula")}
                    <select
                      value={unifiedConnStyle.isMixed ? "" : unifiedConnStyle.value}
                      onChange={(e) => {
                        const val = e.target.value;
                        triggerConnectionPropertyUpdate("style", val);
                      }}
                      className="w-full bg-slate-950 text-slate-200 border border-slate-900 rounded pl-2.5 py-1.5 text-[10px] font-mono focus:outline-none focus:border-indigo-600 cursor-pointer transition-all"
                    >
                      {unifiedConnStyle.isMixed && <option value="">— Mixed styles —</option>}
                      <option value="bezier">Cubic Bezier Spline</option>
                      <option value="orthogonal">Orthogonal Manhattan Pipe</option>
                      <option value="straight">Direct Linear Chord</option>
                    </select>
                  </div>
                )}

                {/* Line Dash array */}
                {isFieldVisible("Dash Pattern", "visuals") && (
                  <div>
                    {renderFieldHeader("Wire Dash Array Pattern", "connDash", "Specify custom SVG dash array gaps (e.g., '5, 5' or leave empty for solid)")}
                    <select
                      value={unifiedConnDashArray.isMixed ? "" : (unifiedConnDashArray.value || "solid")}
                      onChange={(e) => {
                        const val = e.target.value === "solid" ? "" : e.target.value;
                        triggerConnectionPropertyUpdate("dashArray", val);
                      }}
                      className="w-full bg-slate-950 text-slate-200 border border-slate-900 rounded pl-2.5 py-1.5 text-[10px] font-mono focus:outline-none focus:border-indigo-600 cursor-pointer transition-all animate-none"
                    >
                      {unifiedConnDashArray.isMixed && <option value="">— Mixed patterns —</option>}
                      <option value="solid">Solid Continuous Wire</option>
                      <option value="5,5">Standard Dashed (5px)</option>
                      <option value="2,2">Dotted Dense (2px)</option>
                      <option value="12,6,3,6">Dash-Dot Pattern</option>
                    </select>
                  </div>
                )}

                {/* Custom Color Grid Swatches */}
                {isFieldVisible("Wire Color", "visuals") && (
                  <div>
                    {renderFieldHeader("Wire Accent Palette", "connColor", "Set custom accent color for connection wires")}
                    <div className="grid grid-cols-6 gap-1.5 mb-2 select-none">
                      {colorSwatches.map((swatch) => (
                        <button
                          key={swatch}
                          onClick={() => triggerConnectionPropertyUpdate("color", swatch)}
                          className={`h-5 rounded border cursor-pointer transition-all hover:scale-110 shadow-sm ${
                            !unifiedConnColor.isMixed && unifiedConnColor.value.toLowerCase() === swatch.toLowerCase()
                              ? "border-slate-100 ring-1 ring-indigo-500 scale-105"
                              : "border-transparent"
                          }`}
                          style={{ backgroundColor: swatch }}
                        />
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={unifiedConnColor.isMixed ? "" : unifiedConnColor.value}
                        placeholder={unifiedConnColor.isMixed ? "— Mixed values —" : "#HEXCOLOR"}
                        onFocus={handleFieldFocus}
                        onBlur={handleFieldBlur}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (validateField("connColor", val, { type: "color", required: true })) {
                            triggerConnectionPropertyUpdate("color", val);
                          }
                        }}
                        className={`w-full bg-slate-950 text-slate-200 border rounded pl-2.5 py-1.5 text-[10px] font-mono focus:outline-none transition-all ${
                          errors.connColor ? "border-red-500" : "border-slate-900 focus:border-indigo-600"
                        }`}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* === NODE PANEL === */}
        {activeNodes.length > 0 && (
          <div className="space-y-3">

            {/* SECTION 1: Identity & Description Metadata */}
            {expandedGroups.identity && (
              <div className="bg-slate-900/10 border border-slate-900/50 rounded-xl p-3.5 space-y-3.5">
                <div
                  onClick={() => toggleGroup("identity")}
                  className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-400 cursor-pointer uppercase tracking-wider select-none"
                >
                  <span className="flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                    Identity & Metadata
                  </span>
                  {expandedGroups.identity ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </div>

                {expandedGroups.identity && (
                  <div className="space-y-3 pt-2">
                    
                    {/* Readonly Class and ID info */}
                    {!isMultiNode && (
                      <div className="grid grid-cols-2 gap-2 text-slate-400 select-text">
                        <div className="bg-slate-950/50 border border-slate-950 p-2 rounded">
                          <span className="text-[7px] font-mono uppercase text-slate-600 block">Class Type</span>
                          <span className="text-[9px] font-mono text-indigo-300 font-bold block">{activeNodes[0].type.toUpperCase()}</span>
                        </div>
                        <div className="bg-slate-950/50 border border-slate-950 p-2 rounded">
                          <span className="text-[7px] font-mono uppercase text-slate-600 block">Element ID</span>
                          <span className="text-[9px] font-mono truncate block" title={activeNodes[0].id}>{activeNodes[0].id}</span>
                        </div>
                      </div>
                    )}

                    {/* Editable Name */}
                    {isFieldVisible("Display Name", "identity") && (
                      <div>
                        {renderFieldHeader("Component Label Name", "nodeName", "Human-readable label shown underneath component")}
                        <input
                          type="text"
                          value={unifiedNodeName.isMixed ? "" : unifiedNodeName.value}
                          placeholder={unifiedNodeName.isMixed ? "— Mixed names —" : "Enter name..."}
                          onFocus={handleFieldFocus}
                          onBlur={handleFieldBlur}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (validateField("nodeName", val, { type: "text", required: true })) {
                              triggerNodePropertyUpdate("name", val, true);
                            }
                          }}
                          className={`w-full bg-slate-950 text-slate-200 border rounded pl-2.5 py-1.5 text-[10px] font-mono focus:outline-none transition-all ${
                            errors.nodeName ? "border-red-500" : "border-slate-900 focus:border-indigo-600"
                          }`}
                        />
                      </div>
                    )}

                    {/* Description Textbox */}
                    {isFieldVisible("Custom Description", "identity") && (
                      <div>
                        {renderFieldHeader("Process Description Notes", "nodeDesc", "Add operational notes or annotations")}
                        <textarea
                          rows={2}
                          value={unifiedNodeDescription.isMixed ? "" : unifiedNodeDescription.value}
                          placeholder={unifiedNodeDescription.isMixed ? "— Mixed descriptions —" : "Add custom operational notes..."}
                          onFocus={handleFieldFocus}
                          onBlur={handleFieldBlur}
                          onChange={(e) => {
                            const val = e.target.value;
                            triggerNodePropertyUpdate("description", val);
                          }}
                          className="w-full bg-slate-950 text-slate-200 border border-slate-900 rounded pl-2.5 pr-2.5 py-1.5 text-[10px] font-mono focus:outline-none focus:border-indigo-600 transition-all resize-y"
                        />
                      </div>
                    )}

                    {/* Operational switches */}
                    <div className="space-y-2 select-none border-t border-slate-900 pt-3">
                      
                      {/* Drag Lock toggle */}
                      {isFieldVisible("Lock Dragging", "identity") && (
                        <label className="flex items-center justify-between cursor-pointer group">
                          <span className="text-[9px] font-mono text-slate-400 group-hover:text-slate-300 flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5 text-slate-500" />
                            Lock Canvas dragging
                          </span>
                          <input
                            type="checkbox"
                            checked={unifiedNodeLocked.isMixed ? false : !!unifiedNodeLocked.value}
                            onChange={(e) => triggerNodePropertyUpdate("isLocked", e.target.checked)}
                            className="h-3.5 w-3.5 rounded border-slate-900 text-indigo-600 bg-slate-950 focus:ring-0 cursor-pointer"
                          />
                        </label>
                      )}

                      {/* Show Label toggle */}
                      {isFieldVisible("Show Label", "identity") && (
                        <label className="flex items-center justify-between cursor-pointer group">
                          <span className="text-[9px] font-mono text-slate-400 group-hover:text-slate-300 flex items-center gap-1.5">
                            {unifiedNodeShowLabel.value ? <Eye className="w-3.5 h-3.5 text-indigo-400" /> : <EyeOff className="w-3.5 h-3.5 text-slate-600" />}
                            Draw Title text label
                          </span>
                          <input
                            type="checkbox"
                            checked={unifiedNodeShowLabel.isMixed ? false : unifiedNodeShowLabel.value !== false}
                            onChange={(e) => triggerNodePropertyUpdate("showLabel", e.target.checked)}
                            className="h-3.5 w-3.5 rounded border-slate-900 text-indigo-600 bg-slate-950 focus:ring-0 cursor-pointer"
                          />
                        </label>
                      )}

                      {/* Show KPIs overlay toggle */}
                      {isFieldVisible("Show Stats Label", "identity") && (
                        <label className="flex items-center justify-between cursor-pointer group">
                          <span className="text-[9px] font-mono text-slate-400 group-hover:text-slate-300 flex items-center gap-1.5">
                            <Activity className="w-3.5 h-3.5 text-indigo-500" />
                            Draw Live Metrics overlays
                          </span>
                          <input
                            type="checkbox"
                            checked={unifiedNodeShowStats.isMixed ? false : unifiedNodeShowStats.value !== false}
                            onChange={(e) => triggerNodePropertyUpdate("showStatsLabel", e.target.checked)}
                            className="h-3.5 w-3.5 rounded border-slate-900 text-indigo-600 bg-slate-950 focus:ring-0 cursor-pointer"
                          />
                        </label>
                      )}
                    </div>

                  </div>
                )}
              </div>
            )}

            {/* SECTION 2: Geometry, Dimensions & Alignment */}
            {expandedGroups.geometry && (
              <div className="bg-slate-900/10 border border-slate-900/50 rounded-xl p-3.5 space-y-3.5">
                <div
                  onClick={() => toggleGroup("geometry")}
                  className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-400 cursor-pointer uppercase tracking-wider select-none"
                >
                  <span className="flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-emerald-400" />
                    Geometry & Coordinates
                  </span>
                  {expandedGroups.geometry ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </div>

                {expandedGroups.geometry && (
                  <div className="space-y-3 pt-2">
                    
                    {/* Position coordinates inputs */}
                    <div className="grid grid-cols-2 gap-2.5">
                      {isFieldVisible("X Position", "geometry") && (
                        <div>
                          {renderFieldHeader("Position X (px)", "posX")}
                          <input
                            type="number"
                            value={unifiedNodeX.isMixed ? "" : Math.round(unifiedNodeX.value)}
                            placeholder={unifiedNodeX.isMixed ? "—" : "X px"}
                            onFocus={handleFieldFocus}
                            onBlur={handleFieldBlur}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              if (!isNaN(val)) {
                                if (isMultiNode && onUpdateMultipleNodesProperties) {
                                  onUpdateMultipleNodesProperties(activeNodes.map((n) => n.id), {});
                                  // Update raw node attributes for dragging offsets if needed
                                } else if (selectedNode) {
                                  onUpdateProperties(selectedNode.id, {}, selectedNode.name);
                                  selectedNode.x = val; // Apply raw updates immediately
                                  triggerNodePropertyUpdate("dummy_update", Math.random());
                                }
                              }
                            }}
                            className="w-full bg-slate-950 text-slate-200 border border-slate-900 rounded pl-2.5 py-1.5 text-[10px] font-mono focus:outline-none focus:border-indigo-600 transition-all"
                          />
                        </div>
                      )}

                      {isFieldVisible("Y Position", "geometry") && (
                        <div>
                          {renderFieldHeader("Position Y (px)", "posY")}
                          <input
                            type="number"
                            value={unifiedNodeY.isMixed ? "" : Math.round(unifiedNodeY.value)}
                            placeholder={unifiedNodeY.isMixed ? "—" : "Y px"}
                            onFocus={handleFieldFocus}
                            onBlur={handleFieldBlur}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              if (!isNaN(val)) {
                                if (selectedNode) {
                                  selectedNode.y = val;
                                  triggerNodePropertyUpdate("dummy_update", Math.random());
                                }
                              }
                            }}
                            className="w-full bg-slate-950 text-slate-200 border border-slate-900 rounded pl-2.5 py-1.5 text-[10px] font-mono focus:outline-none focus:border-indigo-600 transition-all"
                          />
                        </div>
                      )}
                    </div>

                    {/* Width and Height dimensions */}
                    <div className="grid grid-cols-2 gap-2.5">
                      {isFieldVisible("Width", "geometry") && (
                        <div>
                          {renderFieldHeader("Width (80-500)", "nodeWidth")}
                          <input
                            type="number"
                            min="80"
                            max="500"
                            value={unifiedNodeWidth.isMixed ? "" : unifiedNodeWidth.value}
                            placeholder={unifiedNodeWidth.isMixed ? "—" : "Width px"}
                            onFocus={handleFieldFocus}
                            onBlur={handleFieldBlur}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              if (validateField("nodeWidth", val, { type: "number", min: 80, max: 500 })) {
                                triggerNodePropertyUpdate("width", val);
                              }
                            }}
                            className={`w-full bg-slate-950 text-slate-200 border rounded pl-2.5 py-1.5 text-[10px] font-mono focus:outline-none transition-all ${
                              errors.nodeWidth ? "border-red-500 animate-shake" : "border-slate-900 focus:border-indigo-600"
                            }`}
                          />
                        </div>
                      )}

                      {isFieldVisible("Height", "geometry") && (
                        <div>
                          {renderFieldHeader("Height (40-400)", "nodeHeight")}
                          <input
                            type="number"
                            min="40"
                            max="400"
                            value={unifiedNodeHeight.isMixed ? "" : unifiedNodeHeight.value}
                            placeholder={unifiedNodeHeight.isMixed ? "—" : "Height px"}
                            onFocus={handleFieldFocus}
                            onBlur={handleFieldBlur}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              if (validateField("nodeHeight", val, { type: "number", min: 40, max: 400 })) {
                                triggerNodePropertyUpdate("height", val);
                              }
                            }}
                            className={`w-full bg-slate-950 text-slate-200 border rounded pl-2.5 py-1.5 text-[10px] font-mono focus:outline-none transition-all ${
                              errors.nodeHeight ? "border-red-500 animate-shake" : "border-slate-900 focus:border-indigo-600"
                            }`}
                          />
                        </div>
                      )}
                    </div>

                    {/* Rotation Dial / Slider Input */}
                    {isFieldVisible("Rotation Angle", "geometry") && (
                      <div>
                        <div className="flex justify-between items-center">
                          {renderFieldHeader("Rotation Angle (°)", "nodeRotation", "Rotate component layout around its center point")}
                          {!unifiedNodeRotation.isMixed && (
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/40 px-1 rounded border border-emerald-900/20">
                              {unifiedNodeRotation.value}°
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 select-none">
                          <input
                            type="range"
                            min="0"
                            max="360"
                            step="15"
                            value={unifiedNodeRotation.isMixed ? 0 : unifiedNodeRotation.value}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              triggerNodePropertyUpdate("rotation", val);
                            }}
                            className="flex-1 accent-indigo-600 h-1 bg-slate-900 rounded-lg cursor-pointer"
                          />
                          <button
                            onClick={() => {
                              const curr = unifiedNodeRotation.isMixed ? 0 : unifiedNodeRotation.value;
                              triggerNodePropertyUpdate("rotation", (curr + 45) % 360);
                            }}
                            className="p-1 rounded bg-slate-950 border border-slate-900 hover:bg-slate-900 hover:border-slate-800"
                            title="Rotate 45° clockwise"
                          >
                            <RotateCw className="w-3.5 h-3.5 text-slate-400" />
                          </button>
                        </div>
                      </div>
                    )}

                  </div>
                )}
              </div>
            )}

            {/* SECTION 3: Simulation Parameters (Contextual by matching NodeType) */}
            {expandedGroups.simulation && (
              <div className="bg-slate-900/10 border border-slate-900/50 rounded-xl p-3.5 space-y-3.5">
                <div
                  onClick={() => toggleGroup("simulation")}
                  className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-400 cursor-pointer uppercase tracking-wider select-none"
                >
                  <span className="flex items-center gap-1.5">
                    <Settings className="w-3.5 h-3.5 text-indigo-400" />
                    Simulation parameters
                  </span>
                  {expandedGroups.simulation ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </div>

                {expandedGroups.simulation && (
                  <div className="space-y-3.5 pt-2">
                    
                    {!allNodesSameType && (
                      <div className="text-[9px] font-mono text-slate-500 italic bg-slate-950/20 p-2 rounded text-center border border-slate-900/20">
                        Mixed components selected. Filter parameters by clicking on a single component or matching classes.
                      </div>
                    )}

                    {allNodesSameType && (
                      <>
                        {/* 1. SOURCE CLASS */}
                        {commonType === "source" && (
                          <>
                            {isFieldVisible("Arrival Interval", "simulation") && (
                              <div>
                                {renderFieldHeader("Mean Arrival Interval (s)", "arrivalInterval", "Average seconds elapsed between subsequent creation events")}
                                <input
                                  type="number"
                                  min="0.1"
                                  step="0.5"
                                  value={unifiedArrivalInterval.isMixed ? "" : unifiedArrivalInterval.value}
                                  placeholder={unifiedArrivalInterval.isMixed ? "—" : "Mean seconds"}
                                  onFocus={handleFieldFocus}
                                  onBlur={handleFieldBlur}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    if (validateField("arrivalInterval", val, { type: "number", min: 0.1, max: 1000 })) {
                                      triggerNodePropertyUpdate("arrivalInterval", val);
                                    }
                                  }}
                                  className={`w-full bg-slate-950 text-slate-200 border rounded pl-2.5 py-1.5 text-[10px] font-mono focus:outline-none transition-all ${
                                    errors.arrivalInterval ? "border-red-500" : "border-slate-900 focus:border-indigo-600"
                                  }`}
                                />
                              </div>
                            )}

                            {isFieldVisible("Stochastic Distribution", "simulation") && (
                              <div>
                                {renderFieldHeader("Distribution Formula", "distribution", "Stochastic probability density function modeling arrival times")}
                                <select
                                  value={unifiedDistribution.isMixed ? "" : unifiedDistribution.value}
                                  onChange={(e) => triggerNodePropertyUpdate("distribution", e.target.value)}
                                  className="w-full bg-slate-950 text-slate-200 border border-slate-900 rounded pl-2.5 py-1.5 text-[10px] font-mono focus:outline-none focus:border-indigo-600 cursor-pointer"
                                >
                                  {unifiedDistribution.isMixed && <option value="">— Mixed —</option>}
                                  <option value="constant">Constant (Deterministic)</option>
                                  <option value="exponential">Exponential (Poisson process)</option>
                                  <option value="normal">Normal (Gaussian dispersion)</option>
                                </select>
                              </div>
                            )}
                          </>
                        )}

                        {/* 2. QUEUE CLASS */}
                        {commonType === "queue" && (
                          <>
                            {isFieldVisible("Buffer Capacity", "simulation") && (
                              <div>
                                {renderFieldHeader("Buffer Slot Capacity", "capacity", "Maximum allowed entities queued in wait list before blocking upstream")}
                                <input
                                  type="number"
                                  min="1"
                                  value={unifiedCapacity.isMixed ? "" : unifiedCapacity.value}
                                  placeholder={unifiedCapacity.isMixed ? "—" : "E.g. 1000"}
                                  onFocus={handleFieldFocus}
                                  onBlur={handleFieldBlur}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    if (validateField("capacity", val, { type: "number", min: 1, max: 1000000 })) {
                                      triggerNodePropertyUpdate("capacity", val);
                                    }
                                  }}
                                  className={`w-full bg-slate-950 text-slate-200 border rounded pl-2.5 py-1.5 text-[10px] font-mono focus:outline-none transition-all ${
                                    errors.capacity ? "border-red-500" : "border-slate-900 focus:border-indigo-600"
                                  }`}
                                />
                              </div>
                            )}
                          </>
                        )}

                        {/* 3. PROCESSOR CLASS */}
                        {commonType === "processor" && (
                          <>
                            {isFieldVisible("Processing Time", "simulation") && (
                              <div>
                                {renderFieldHeader("Mean Processing Duration (s)", "processingTime", "Average seconds required to complete operations on one item")}
                                <input
                                  type="number"
                                  min="0.01"
                                  step="0.5"
                                  value={unifiedProcessingTime.isMixed ? "" : unifiedProcessingTime.value}
                                  placeholder={unifiedProcessingTime.isMixed ? "—" : "Process seconds"}
                                  onFocus={handleFieldFocus}
                                  onBlur={handleFieldBlur}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    if (validateField("processingTime", val, { type: "number", min: 0.01, max: 1000 })) {
                                      triggerNodePropertyUpdate("processingTime", val);
                                    }
                                  }}
                                  className={`w-full bg-slate-950 text-slate-200 border rounded pl-2.5 py-1.5 text-[10px] font-mono focus:outline-none transition-all ${
                                    errors.processingTime ? "border-red-500" : "border-slate-900 focus:border-indigo-600"
                                  }`}
                                />
                              </div>
                            )}

                            {isFieldVisible("Machine Capacity", "simulation") && (
                              <div>
                                {renderFieldHeader("Parallel Job Capacity", "capacity", "Number of parallel processing stations / active job slots")}
                                <input
                                  type="number"
                                  min="1"
                                  value={unifiedCapacity.isMixed ? "" : unifiedCapacity.value}
                                  placeholder={unifiedCapacity.isMixed ? "—" : "Parallel slots"}
                                  onFocus={handleFieldFocus}
                                  onBlur={handleFieldBlur}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    if (validateField("capacity", val, { type: "number", min: 1, max: 1000 })) {
                                      triggerNodePropertyUpdate("capacity", val);
                                    }
                                  }}
                                  className={`w-full bg-slate-950 text-slate-200 border rounded pl-2.5 py-1.5 text-[10px] font-mono focus:outline-none transition-all ${
                                    errors.capacity ? "border-red-500" : "border-slate-900 focus:border-indigo-600"
                                  }`}
                                />
                              </div>
                            )}

                            {isFieldVisible("Stochastic Distribution", "simulation") && (
                              <div>
                                {renderFieldHeader("Duration Stochastic Distribution", "distribution", "Stochastic model for operational times")}
                                <select
                                  value={unifiedDistribution.isMixed ? "" : unifiedDistribution.value}
                                  onChange={(e) => triggerNodePropertyUpdate("distribution", e.target.value)}
                                  className="w-full bg-slate-950 text-slate-200 border border-slate-900 rounded pl-2.5 py-1.5 text-[10px] font-mono focus:outline-none focus:border-indigo-600 cursor-pointer"
                                >
                                  {unifiedDistribution.isMixed && <option value="">— Mixed —</option>}
                                  <option value="constant">Constant (Deterministic)</option>
                                  <option value="exponential">Exponential (Poisson decay)</option>
                                  <option value="normal">Normal (Standard bell curves)</option>
                                </select>
                              </div>
                            )}
                          </>
                        )}

                        {/* 4. ROUTER CLASS */}
                        {commonType === "router" && (
                          <>
                            {isFieldVisible("Routing Probability", "simulation") && (
                              <div>
                                {renderFieldHeader("Splitting Route Ratio", "routeProbability", "Proportional percentage of entities routed to secondary branch")}
                                <input
                                  type="number"
                                  min="0"
                                  max="1"
                                  step="0.05"
                                  value={unifiedRouteProbability.isMixed ? "" : unifiedRouteProbability.value}
                                  placeholder={unifiedRouteProbability.isMixed ? "—" : "0.5"}
                                  onFocus={handleFieldFocus}
                                  onBlur={handleFieldBlur}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    if (validateField("routeProbability", val, { type: "probability" })) {
                                      triggerNodePropertyUpdate("routeProbability", val);
                                    }
                                  }}
                                  className={`w-full bg-slate-950 text-slate-200 border rounded pl-2.5 py-1.5 text-[10px] font-mono focus:outline-none transition-all ${
                                    errors.routeProbability ? "border-red-500" : "border-slate-900 focus:border-indigo-600"
                                  }`}
                                />
                              </div>
                            )}
                          </>
                        )}

                        {/* 5. CONVEYOR CLASS */}
                        {commonType === "conveyor" && (
                          <>
                            {isFieldVisible("Conveyor Speed", "simulation") && (
                              <div>
                                {renderFieldHeader("Belt Speed (meters/second)", "conveyorSpeed", "Transit transport speed of items moving on the conveyor belt")}
                                <input
                                  type="number"
                                  min="0.1"
                                  step="0.1"
                                  value={unifiedConveyorSpeed.isMixed ? "" : unifiedConveyorSpeed.value}
                                  placeholder={unifiedConveyorSpeed.isMixed ? "—" : "Speed m/s"}
                                  onFocus={handleFieldFocus}
                                  onBlur={handleFieldBlur}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    if (validateField("conveyorSpeed", val, { type: "number", min: 0.1, max: 50 })) {
                                      triggerNodePropertyUpdate("conveyorSpeed", val);
                                    }
                                  }}
                                  className={`w-full bg-slate-950 text-slate-200 border rounded pl-2.5 py-1.5 text-[10px] font-mono focus:outline-none transition-all ${
                                    errors.conveyorSpeed ? "border-red-500" : "border-slate-900 focus:border-indigo-600"
                                  }`}
                                />
                              </div>
                            )}

                            {isFieldVisible("Conveyor Length", "simulation") && (
                              <div>
                                {renderFieldHeader("Belt Length (meters)", "conveyorLength", "Physical length of the conveyor track")}
                                <input
                                  type="number"
                                  min="1.0"
                                  step="0.5"
                                  value={unifiedConveyorLength.isMixed ? "" : unifiedConveyorLength.value}
                                  placeholder={unifiedConveyorLength.isMixed ? "—" : "Length meters"}
                                  onFocus={handleFieldFocus}
                                  onBlur={handleFieldBlur}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    if (validateField("conveyorLength", val, { type: "number", min: 1, max: 1000 })) {
                                      triggerNodePropertyUpdate("conveyorLength", val);
                                    }
                                  }}
                                  className={`w-full bg-slate-950 text-slate-200 border rounded pl-2.5 py-1.5 text-[10px] font-mono focus:outline-none transition-all ${
                                    errors.conveyorLength ? "border-red-500" : "border-slate-900 focus:border-indigo-600"
                                  }`}
                                />
                              </div>
                            )}

                            {isFieldVisible("Buffer Capacity", "simulation") && (
                              <div>
                                {renderFieldHeader("Belt Slots Capacity", "capacity", "Maximum allowed items concurrently on belt")}
                                <input
                                  type="number"
                                  min="1"
                                  value={unifiedCapacity.isMixed ? "" : unifiedCapacity.value}
                                  placeholder={unifiedCapacity.isMixed ? "—" : "Max items"}
                                  onFocus={handleFieldFocus}
                                  onBlur={handleFieldBlur}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    if (validateField("capacity", val, { type: "number", min: 1, max: 10000 })) {
                                      triggerNodePropertyUpdate("capacity", val);
                                    }
                                  }}
                                  className={`w-full bg-slate-950 text-slate-200 border rounded pl-2.5 py-1.5 text-[10px] font-mono focus:outline-none transition-all ${
                                    errors.capacity ? "border-red-500" : "border-slate-900 focus:border-indigo-600"
                                  }`}
                                />
                              </div>
                            )}
                          </>
                        )}

                            {/* 6. RESOURCE CLASS */}
                            {commonType === "resource" && (
                              <>
                                {isFieldVisible("Resource Type", "simulation") && (
                                  <div>
                                    {renderFieldHeader("Resource Class", "resourceType", "The operational class classification of this constraint")}
                                    <select
                                      value={unifiedResourceType.isMixed ? "" : unifiedResourceType.value}
                                      onChange={(e) => triggerNodePropertyUpdate("resourceType", e.target.value)}
                                      className="w-full bg-slate-950 text-slate-200 border border-slate-900 rounded pl-2.5 py-1.5 text-[10px] font-mono focus:outline-none focus:border-indigo-600 cursor-pointer"
                                    >
                                      {unifiedResourceType.isMixed && <option value="">— Mixed —</option>}
                                      <option value="Worker">Human Operator (Worker)</option>
                                      <option value="Tool">Mechanical Tooling (Tool)</option>
                                      <option value="Fixture">Alignment Fixture (Fixture)</option>
                                      <option value="Space">Floorspace bay (Space)</option>
                                    </select>
                                  </div>
                                )}

                                {isFieldVisible("Quantity", "simulation") && (
                                  <div>
                                    {renderFieldHeader("Available Quantity pool", "quantity", "Total operational inventory size available for constraint allocation")}
                                    <input
                                      type="number"
                                      min="1"
                                      value={unifiedQuantity.isMixed ? "" : unifiedQuantity.value}
                                      placeholder={unifiedQuantity.isMixed ? "—" : "1"}
                                      onFocus={handleFieldFocus}
                                      onBlur={handleFieldBlur}
                                      onChange={(e) => {
                                        const val = parseInt(e.target.value);
                                        if (validateField("quantity", val, { type: "number", min: 1, max: 1000 })) {
                                          triggerNodePropertyUpdate("quantity", val);
                                        }
                                      }}
                                      className={`w-full bg-slate-950 text-slate-200 border rounded pl-2.5 py-1.5 text-[10px] font-mono focus:outline-none transition-all ${
                                        errors.quantity ? "border-red-500" : "border-slate-900 focus:border-indigo-600"
                                      }`}
                                    />
                                  </div>
                                )}

                                {/* Shift Schedules */}
                                <div className="border-t border-slate-900 mt-3 pt-3 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider">Shift Schedule</span>
                                    <label className="flex items-center gap-1.5 cursor-pointer text-[10px] font-mono text-slate-300 select-none">
                                      <input
                                        type="checkbox"
                                        checked={unifiedShiftEnabled.isMixed ? false : unifiedShiftEnabled.value}
                                        onChange={(e) => triggerNodePropertyUpdate("shiftEnabled", e.target.checked)}
                                        className="rounded bg-slate-950 border-slate-900 text-indigo-600 focus:ring-0 focus:ring-offset-0 w-3 h-3 cursor-pointer"
                                      />
                                      Active
                                    </label>
                                  </div>
                                  
                                  {unifiedShiftEnabled.value && (
                                    <div className="grid grid-cols-3 gap-1.5">
                                      <div>
                                        {renderFieldHeader("Start (s)", "shiftStart", "Start time of shift relative to cycle")}
                                        <input
                                          type="number"
                                          min="0"
                                          value={unifiedShiftStart.isMixed ? "" : unifiedShiftStart.value}
                                          onChange={(e) => triggerNodePropertyUpdate("shiftStart", parseInt(e.target.value) || 0)}
                                          className="w-full bg-slate-950 text-slate-200 border border-slate-900 rounded pl-2 py-1 text-[9px] font-mono focus:outline-none"
                                        />
                                      </div>
                                      <div>
                                        {renderFieldHeader("End (s)", "shiftEnd", "End time of shift relative to cycle")}
                                        <input
                                          type="number"
                                          min="0"
                                          value={unifiedShiftEnd.isMixed ? "" : unifiedShiftEnd.value}
                                          onChange={(e) => triggerNodePropertyUpdate("shiftEnd", parseInt(e.target.value) || 0)}
                                          className="w-full bg-slate-950 text-slate-200 border border-slate-900 rounded pl-2 py-1 text-[9px] font-mono focus:outline-none"
                                        />
                                      </div>
                                      <div>
                                        {renderFieldHeader("Cycle (s)", "shiftCycle", "Shift cycle repetition interval")}
                                        <input
                                          type="number"
                                          min="10"
                                          value={unifiedShiftCycle.isMixed ? "" : unifiedShiftCycle.value}
                                          onChange={(e) => triggerNodePropertyUpdate("shiftCycle", parseInt(e.target.value) || 500)}
                                          className="w-full bg-slate-950 text-slate-200 border border-slate-900 rounded pl-2 py-1 text-[9px] font-mono focus:outline-none"
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Break Schedules */}
                                <div className="border-t border-slate-900 mt-2 pt-2 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider">Break Schedule</span>
                                    <label className="flex items-center gap-1.5 cursor-pointer text-[10px] font-mono text-slate-300 select-none">
                                      <input
                                        type="checkbox"
                                        checked={unifiedBreakEnabled.isMixed ? false : unifiedBreakEnabled.value}
                                        onChange={(e) => triggerNodePropertyUpdate("breakEnabled", e.target.checked)}
                                        className="rounded bg-slate-950 border-slate-900 text-indigo-600 focus:ring-0 focus:ring-offset-0 w-3 h-3 cursor-pointer"
                                      />
                                      Active
                                    </label>
                                  </div>
                                  
                                  {unifiedBreakEnabled.value && (
                                    <div className="grid grid-cols-3 gap-1.5">
                                      <div>
                                        {renderFieldHeader("Start (s)", "breakStart", "Start time of break relative to cycle")}
                                        <input
                                          type="number"
                                          min="0"
                                          value={unifiedBreakStart.isMixed ? "" : unifiedBreakStart.value}
                                          onChange={(e) => triggerNodePropertyUpdate("breakStart", parseInt(e.target.value) || 0)}
                                          className="w-full bg-slate-950 text-slate-200 border border-slate-900 rounded pl-2 py-1 text-[9px] font-mono focus:outline-none"
                                        />
                                      </div>
                                      <div>
                                        {renderFieldHeader("End (s)", "breakEnd", "End time of break relative to cycle")}
                                        <input
                                          type="number"
                                          min="0"
                                          value={unifiedBreakEnd.isMixed ? "" : unifiedBreakEnd.value}
                                          onChange={(e) => triggerNodePropertyUpdate("breakEnd", parseInt(e.target.value) || 0)}
                                          className="w-full bg-slate-950 text-slate-200 border border-slate-900 rounded pl-2 py-1 text-[9px] font-mono focus:outline-none"
                                        />
                                      </div>
                                      <div>
                                        {renderFieldHeader("Cycle (s)", "breakCycle", "Break cycle repetition interval")}
                                        <input
                                          type="number"
                                          min="10"
                                          value={unifiedBreakCycle.isMixed ? "" : unifiedBreakCycle.value}
                                          onChange={(e) => triggerNodePropertyUpdate("breakCycle", parseInt(e.target.value) || 500)}
                                          className="w-full bg-slate-950 text-slate-200 border border-slate-900 rounded pl-2 py-1 text-[9px] font-mono focus:outline-none"
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Failures / Breakdowns */}
                                <div className="border-t border-slate-900 mt-2 pt-2 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider">Breakdowns & Failures</span>
                                    <label className="flex items-center gap-1.5 cursor-pointer text-[10px] font-mono text-slate-300 select-none">
                                      <input
                                        type="checkbox"
                                        checked={unifiedFailureEnabled.isMixed ? false : unifiedFailureEnabled.value}
                                        onChange={(e) => triggerNodePropertyUpdate("failureEnabled", e.target.checked)}
                                        className="rounded bg-slate-950 border-slate-900 text-indigo-600 focus:ring-0 focus:ring-offset-0 w-3 h-3 cursor-pointer"
                                      />
                                      Active
                                    </label>
                                  </div>
                                  
                                  {unifiedFailureEnabled.value && (
                                    <div className="grid grid-cols-2 gap-1.5">
                                      <div>
                                        {renderFieldHeader("Mean MTBF (s)", "failureMTBF", "Mean Time Between Failures in seconds")}
                                        <input
                                          type="number"
                                          min="10"
                                          value={unifiedFailureMTBF.isMixed ? "" : unifiedFailureMTBF.value}
                                          onChange={(e) => triggerNodePropertyUpdate("failureMTBF", parseInt(e.target.value) || 10)}
                                          className="w-full bg-slate-950 text-slate-200 border border-slate-900 rounded pl-2 py-1 text-[9px] font-mono focus:outline-none"
                                        />
                                      </div>
                                      <div>
                                        {renderFieldHeader("Mean MTTR (s)", "failureMTTR", "Mean Time To Repair in seconds")}
                                        <input
                                          type="number"
                                          min="1"
                                          value={unifiedFailureMTTR.isMixed ? "" : unifiedFailureMTTR.value}
                                          onChange={(e) => triggerNodePropertyUpdate("failureMTTR", parseInt(e.target.value) || 1)}
                                          className="w-full bg-slate-950 text-slate-200 border border-slate-900 rounded pl-2 py-1 text-[9px] font-mono focus:outline-none"
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Scheduled Maintenance */}
                                <div className="border-t border-slate-900 mt-2 pt-2 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider">Preventive Maintenance</span>
                                    <label className="flex items-center gap-1.5 cursor-pointer text-[10px] font-mono text-slate-300 select-none">
                                      <input
                                        type="checkbox"
                                        checked={unifiedMaintenanceEnabled.isMixed ? false : unifiedMaintenanceEnabled.value}
                                        onChange={(e) => triggerNodePropertyUpdate("maintenanceEnabled", e.target.checked)}
                                        className="rounded bg-slate-950 border-slate-900 text-indigo-600 focus:ring-0 focus:ring-offset-0 w-3 h-3 cursor-pointer"
                                      />
                                      Active
                                    </label>
                                  </div>
                                  
                                  {unifiedMaintenanceEnabled.value && (
                                    <div className="grid grid-cols-2 gap-1.5">
                                      <div>
                                        {renderFieldHeader("Interval (s)", "maintenanceInterval", "Service frequency interval in seconds")}
                                        <input
                                          type="number"
                                          min="10"
                                          value={unifiedMaintenanceInterval.isMixed ? "" : unifiedMaintenanceInterval.value}
                                          onChange={(e) => triggerNodePropertyUpdate("maintenanceInterval", parseInt(e.target.value) || 10)}
                                          className="w-full bg-slate-950 text-slate-200 border border-slate-900 rounded pl-2 py-1 text-[9px] font-mono focus:outline-none"
                                        />
                                      </div>
                                      <div>
                                        {renderFieldHeader("Duration (s)", "maintenanceDuration", "Time in seconds to complete maintenance")}
                                        <input
                                          type="number"
                                          min="1"
                                          value={unifiedMaintenanceDuration.isMixed ? "" : unifiedMaintenanceDuration.value}
                                          onChange={(e) => triggerNodePropertyUpdate("maintenanceDuration", parseInt(e.target.value) || 1)}
                                          className="w-full bg-slate-950 text-slate-200 border border-slate-900 rounded pl-2 py-1 text-[9px] font-mono focus:outline-none"
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </>
                            )}

                        {/* 7. TRANSPORTER CLASS */}
                        {commonType === "transporter" && (
                          <>
                            {isFieldVisible("Transporter Speed", "simulation") && (
                              <div>
                                {renderFieldHeader("Vehicle Speed (m/s)", "transporterSpeed", "Movement speed of logistics automated guided vehicles")}
                                <input
                                  type="number"
                                  min="0.1"
                                  step="0.5"
                                  value={unifiedTransporterSpeed.isMixed ? "" : unifiedTransporterSpeed.value}
                                  placeholder={unifiedTransporterSpeed.isMixed ? "—" : "Speed m/s"}
                                  onFocus={handleFieldFocus}
                                  onBlur={handleFieldBlur}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    if (validateField("transporterSpeed", val, { type: "number", min: 0.1, max: 100 })) {
                                      triggerNodePropertyUpdate("transporterSpeed", val);
                                    }
                                  }}
                                  className={`w-full bg-slate-950 text-slate-200 border rounded pl-2.5 py-1.5 text-[10px] font-mono focus:outline-none transition-all ${
                                    errors.transporterSpeed ? "border-red-500" : "border-slate-900 focus:border-indigo-600"
                                  }`}
                                />
                              </div>
                            )}

                            {isFieldVisible("Load Capacity", "simulation") && (
                              <div>
                                {renderFieldHeader("Load Capacity slots", "transporterCapacity", "Maximum number of elements this logistic transporter carries per trip")}
                                <input
                                  type="number"
                                  min="1"
                                  value={unifiedTransporterCapacity.isMixed ? "" : unifiedTransporterCapacity.value}
                                  placeholder={unifiedTransporterCapacity.isMixed ? "—" : "Slot size"}
                                  onFocus={handleFieldFocus}
                                  onBlur={handleFieldBlur}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    if (validateField("transporterCapacity", val, { type: "number", min: 1, max: 100 })) {
                                      triggerNodePropertyUpdate("transporterCapacity", val);
                                    }
                                  }}
                                  className={`w-full bg-slate-950 text-slate-200 border rounded pl-2.5 py-1.5 text-[10px] font-mono focus:outline-none transition-all ${
                                    errors.transporterCapacity ? "border-red-500" : "border-slate-900 focus:border-indigo-600"
                                  }`}
                                />
                              </div>
                            )}
                          </>
                        )}

                        {/* 8. SEPARATOR CLASS */}
                        {commonType === "separator" && (
                          <>
                            {isFieldVisible("Separator Type", "simulation") && (
                              <div>
                                {renderFieldHeader("Splitting Separation mode", "separatorType", "Choose method to split batches or branch streams")}
                                <select
                                  value={unifiedSeparatorType.isMixed ? "" : unifiedSeparatorType.value}
                                  onChange={(e) => triggerNodePropertyUpdate("separatorType", e.target.value)}
                                  className="w-full bg-slate-950 text-slate-200 border border-slate-900 rounded pl-2.5 py-1.5 text-[10px] font-mono focus:outline-none focus:border-indigo-600 cursor-pointer"
                                >
                                  {unifiedSeparatorType.isMixed && <option value="">— Mixed —</option>}
                                  <option value="split">Proportional Splitting</option>
                                  <option value="batch-split">Disassemble batches</option>
                                </select>
                              </div>
                            )}

                            {isFieldVisible("Split Ratio", "simulation") && (
                              <div>
                                {renderFieldHeader("Splitting Ratio (0.0 - 1.0)", "separatorSplitRatio", "Proportional ratio split factor or batch division denominator")}
                                <input
                                  type="number"
                                  min="0"
                                  max="1"
                                  step="0.05"
                                  value={unifiedSeparatorSplitRatio.isMixed ? "" : unifiedSeparatorSplitRatio.value}
                                  placeholder={unifiedSeparatorSplitRatio.isMixed ? "—" : "Ratio factor (0.5)"}
                                  onFocus={handleFieldFocus}
                                  onBlur={handleFieldBlur}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    if (validateField("separatorSplitRatio", val, { type: "probability" })) {
                                      triggerNodePropertyUpdate("separatorSplitRatio", val);
                                    }
                                  }}
                                  className={`w-full bg-slate-950 text-slate-200 border rounded pl-2.5 py-1.5 text-[10px] font-mono focus:outline-none transition-all ${
                                    errors.separatorSplitRatio ? "border-red-500" : "border-slate-900 focus:border-indigo-600"
                                  }`}
                                />
                              </div>
                            )}
                          </>
                        )}

                        {/* 9. COMBINER CLASS */}
                        {commonType === "combiner" && (
                          <>
                            {isFieldVisible("Combiner Type", "simulation") && (
                              <div>
                                {renderFieldHeader("Combination Mode", "combinerType", "Choose combination formula to batch or package components")}
                                <select
                                  value={unifiedCombinerType.isMixed ? "" : unifiedCombinerType.value}
                                  onChange={(e) => triggerNodePropertyUpdate("combinerType", e.target.value)}
                                  className="w-full bg-slate-950 text-slate-200 border border-slate-900 rounded pl-2.5 py-1.5 text-[10px] font-mono focus:outline-none focus:border-indigo-600 cursor-pointer"
                                >
                                  {unifiedCombinerType.isMixed && <option value="">— Mixed —</option>}
                                  <option value="batch">Assemble Batch (Merge)</option>
                                  <option value="pack">Form Package (Palletize)</option>
                                </select>
                              </div>
                            )}

                            {isFieldVisible("Batch Size", "simulation") && (
                              <div>
                                {renderFieldHeader("Assembly Batch Size", "combinerBatchSize", "Specify number of components needed to create one combined assembly batch")}
                                <input
                                  type="number"
                                  min="2"
                                  value={unifiedCombinerBatchSize.isMixed ? "" : unifiedCombinerBatchSize.value}
                                  placeholder={unifiedCombinerBatchSize.isMixed ? "—" : "Batch units"}
                                  onFocus={handleFieldFocus}
                                  onBlur={handleFieldBlur}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    if (validateField("combinerBatchSize", val, { type: "number", min: 2, max: 1000 })) {
                                      triggerNodePropertyUpdate("combinerBatchSize", val);
                                    }
                                  }}
                                  className={`w-full bg-slate-950 text-slate-200 border rounded pl-2.5 py-1.5 text-[10px] font-mono focus:outline-none transition-all ${
                                    errors.combinerBatchSize ? "border-red-500" : "border-slate-900 focus:border-indigo-600"
                                  }`}
                                />
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )}

                  </div>
                )}
              </div>
            )}

            {/* SECTION 4: Visual Appearance & Custom Aesthetic Styling */}
            {expandedGroups.visuals && (
              <div className="bg-slate-900/10 border border-slate-900/50 rounded-xl p-3.5 space-y-3.5">
                <div
                  onClick={() => toggleGroup("visuals")}
                  className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-400 cursor-pointer uppercase tracking-wider select-none"
                >
                  <span className="flex items-center gap-1.5">
                    <Paintbrush className="w-3.5 h-3.5 text-indigo-400" />
                    Visual Styling
                  </span>
                  {expandedGroups.visuals ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </div>

                {expandedGroups.visuals && (
                  <div className="space-y-3 pt-2">
                    
                    {/* Enterprise Palette Swatches */}
                    {isFieldVisible("Component Color Accent", "visuals") && (
                      <div>
                        {renderFieldHeader("Component Color Accent", "nodeColor", "Select canvas theme accent color for selected nodes")}
                        <div className="grid grid-cols-6 gap-1.5 mb-2.5 select-none">
                          {colorSwatches.map((swatch) => (
                            <button
                              key={swatch}
                              onClick={() => triggerNodePropertyUpdate("color", swatch)}
                              className={`h-5 rounded border cursor-pointer transition-all hover:scale-110 shadow-sm ${
                                !unifiedNodeColor.isMixed && unifiedNodeColor.value.toLowerCase() === swatch.toLowerCase()
                                  ? "border-slate-100 ring-1 ring-indigo-500 scale-105"
                                  : "border-transparent"
                              }`}
                              style={{ backgroundColor: swatch }}
                            />
                          ))}
                        </div>

                        {/* Hex Input */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={unifiedNodeColor.isMixed ? "" : unifiedNodeColor.value}
                            placeholder={unifiedNodeColor.isMixed ? "— Mixed colors —" : "#HEXCOLOR"}
                            onFocus={handleFieldFocus}
                            onBlur={handleFieldBlur}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (validateField("nodeColor", val, { type: "color", required: true })) {
                                triggerNodePropertyUpdate("color", val);
                              }
                            }}
                            className={`w-full bg-slate-950 text-slate-200 border rounded pl-2.5 py-1.5 text-[10px] font-mono focus:outline-none transition-all ${
                              errors.nodeColor ? "border-red-500" : "border-slate-900 focus:border-indigo-600"
                            }`}
                          />
                        </div>
                      </div>
                    )}

                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </div>

      {/* Real-time KPI widget for the selected single Node */}
      {!isMultiNode && selectedNode && utilizationStats && (
        <div className="mt-4 border-t border-slate-900 pt-4 bg-slate-900/10 p-3 rounded-lg border border-slate-950/50 flex flex-col gap-2 font-mono">
          <div className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            Live Component metrics
          </div>

          <div className="grid grid-cols-3 gap-2 text-center mt-1">
            <div className="bg-slate-950 p-1.5 rounded border border-slate-900">
              <span className="text-[7px] text-slate-500 block">UTILIZATION</span>
              <span className="text-[11px] font-bold text-indigo-400 block mt-0.5">
                {(utilizationStats.utilization * 100).toFixed(1)}%
              </span>
            </div>
            <div className="bg-slate-950 p-1.5 rounded border border-slate-900">
              <span className="text-[7px] text-slate-500 block">WAITING</span>
              <span className="text-[11px] font-bold text-amber-500 block mt-0.5">
                {utilizationStats.queueLength} items
              </span>
            </div>
            <div className="bg-slate-950 p-1.5 rounded border border-slate-900">
              <span className="text-[7px] text-slate-500 block">ACTIVE</span>
              <span className="text-[11px] font-bold text-emerald-400 block mt-0.5">
                {utilizationStats.occupiedCount} units
              </span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
