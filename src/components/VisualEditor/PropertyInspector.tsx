import React, { useEffect, useState } from "react";
import { SimNode, NodeType, NodeProperties, SimConnection } from "../../core/simulation/types";
import { Sliders, Settings, Check, HelpCircle, Activity, Link2, Route } from "lucide-react";

interface PropertyInspectorProps {
  selectedNode: SimNode | null;
  selectedConnection?: SimConnection | null;
  onUpdateProperties: (id: string, properties: Partial<NodeProperties>, name?: string) => void;
  onUpdateConnectionProperties?: (id: string, properties: Partial<SimConnection>) => void;
  utilizationStats?: {
    utilization: number;
    queueLength: number;
    occupiedCount: number;
  };
}

export default function PropertyInspector({
  selectedNode,
  selectedConnection = null,
  onUpdateProperties,
  onUpdateConnectionProperties,
  utilizationStats
}: PropertyInspectorProps) {
  const [name, setName] = useState("");
  const [arrivalInterval, setArrivalInterval] = useState(10);
  const [processingTime, setProcessingTime] = useState(8);
  const [capacity, setCapacity] = useState(1);
  const [distribution, setDistribution] = useState<"constant" | "exponential" | "normal">("exponential");
  const [routeProbability, setRouteProbability] = useState(0.5);
  const [color, setColor] = useState("#6366f1");

  // Connection-specific states
  const [connLabel, setConnLabel] = useState("");
  const [connWeight, setConnWeight] = useState<number | undefined>(undefined);
  const [connDelay, setConnDelay] = useState<number | undefined>(undefined);
  const [connColor, setConnColor] = useState<string | undefined>(undefined);
  const [connStyle, setConnStyle] = useState<"bezier" | "orthogonal" | "straight">("bezier");
  const [connDashArray, setConnDashArray] = useState<string>("");

  // Conveyor properties
  const [conveyorSpeed, setConveyorSpeed] = useState(1.0);
  const [conveyorLength, setConveyorLength] = useState(10);

  // Resource properties
  const [resourceType, setResourceType] = useState<"Worker" | "Tool" | "Fixture" | "Space">("Worker");
  const [quantity, setQuantity] = useState(1);

  // Transporter properties
  const [transporterSpeed, setTransporterSpeed] = useState(2.0);
  const [transporterCapacity, setTransporterCapacity] = useState(5);

  // Separator properties
  const [separatorType, setSeparatorType] = useState<"split" | "batch-split">("split");
  const [separatorSplitRatio, setSeparatorSplitRatio] = useState(0.5);

  // Combiner properties
  const [combinerType, setCombinerType] = useState<"batch" | "pack">("batch");
  const [combinerBatchSize, setCombinerBatchSize] = useState(2);

  // Size and rotation properties
  const [width, setWidth] = useState(140);
  const [height, setHeight] = useState(52);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (selectedNode) {
      setName(selectedNode.name);
      setArrivalInterval(selectedNode.properties.arrivalInterval ?? 10);
      setProcessingTime(selectedNode.properties.processingTime ?? 8);
      setCapacity(selectedNode.properties.capacity ?? 1);
      setDistribution(selectedNode.properties.distribution ?? "exponential");
      setRouteProbability(selectedNode.properties.routeProbability ?? 0.5);
      setColor(selectedNode.properties.color ?? "#6366f1");

      setConveyorSpeed(selectedNode.properties.conveyorSpeed ?? 1.0);
      setConveyorLength(selectedNode.properties.conveyorLength ?? 10);
      setResourceType(selectedNode.properties.resourceType ?? "Worker");
      setQuantity(selectedNode.properties.quantity ?? 1);
      setTransporterSpeed(selectedNode.properties.transporterSpeed ?? 2.0);
      setTransporterCapacity(selectedNode.properties.transporterCapacity ?? 5);
      setSeparatorType(selectedNode.properties.separatorType ?? "split");
      setSeparatorSplitRatio(selectedNode.properties.separatorSplitRatio ?? 0.5);
      setCombinerType(selectedNode.properties.combinerType ?? "batch");
      setCombinerBatchSize(selectedNode.properties.combinerBatchSize ?? 2);

      setWidth(selectedNode.properties.width ?? 140);
      setHeight(selectedNode.properties.height ?? 52);
      setRotation(selectedNode.properties.rotation ?? 0);
    }
  }, [selectedNode]);

  useEffect(() => {
    if (selectedConnection) {
      setConnLabel(selectedConnection.label ?? "");
      setConnWeight(selectedConnection.weight);
      setConnDelay(selectedConnection.delay);
      setConnColor(selectedConnection.color ?? "#334155");
      setConnStyle(selectedConnection.style ?? "bezier");
      setConnDashArray(selectedConnection.dashArray ?? "");
    }
  }, [selectedConnection]);

  if (!selectedNode && !selectedConnection) {
    return (
      <div className="flex flex-col h-full bg-slate-950/40 p-5 border-l border-slate-900 w-full lg:w-80 justify-center items-center text-center">
        <Sliders className="w-8 h-8 text-slate-700 stroke-1" />
        <p className="text-xs font-mono text-slate-500 mt-3 uppercase tracking-wider">
          Property Inspector
        </p>
        <p className="text-[10px] text-slate-600 font-mono mt-1 max-w-[180px]">
          Click on any node or connection wire in the workspace to view and edit its design parameters.
        </p>
      </div>
    );
  }

  // Handle saving of connection properties
  const handleSaveConnection = () => {
    if (selectedConnection && onUpdateConnectionProperties) {
      onUpdateConnectionProperties(selectedConnection.id, {
        label: connLabel.trim() || undefined,
        weight: connWeight !== undefined && !isNaN(connWeight) ? connWeight : undefined,
        delay: connDelay !== undefined && !isNaN(connDelay) ? connDelay : undefined,
        color: connColor,
        style: connStyle,
        dashArray: connDashArray.trim() || undefined
      });
    }
  };

  if (selectedConnection && !selectedNode) {
    const connColors = ["#334155", "#475569", "#6366f1", "#10b981", "#eab308", "#ef4444", "#a855f7", "#ec4899", "#f97316", "#06b6d4"];
    return (
      <div className="flex flex-col h-full bg-slate-950/40 p-4 border-l border-slate-900 w-full lg:w-80 overflow-y-auto space-y-4">
        {/* Connection Header */}
        <div className="flex items-center gap-2 border-b border-slate-900 pb-3">
          <div className="p-2 rounded-lg bg-indigo-950/40 border border-indigo-900 shrink-0">
            <Link2 className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-indigo-400">
              Connection Wire
            </span>
            <h2 className="text-xs font-bold text-slate-200 mt-0.5 truncate max-w-[180px]">
              {selectedConnection.sourceId} → {selectedConnection.targetId}
            </h2>
          </div>
        </div>

        {/* Connection Label */}
        <div className="space-y-4 flex-1">
          <div>
            <label className="block text-[9px] font-mono uppercase text-slate-500 tracking-wider mb-1.5">
              Connection Label / Alias
            </label>
            <input
              type="text"
              placeholder="e.g. Reject Path, Bypass line..."
              value={connLabel}
              onChange={(e) => setConnLabel(e.target.value)}
              onBlur={handleSaveConnection}
              onKeyDown={(e) => e.key === "Enter" && handleSaveConnection()}
              className="w-full bg-slate-900/60 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          {/* Connection Routing Style */}
          <div>
            <label className="block text-[9px] font-mono uppercase text-slate-500 tracking-wider mb-1.5">
              Path Routing Style
            </label>
            <select
              value={connStyle}
              onChange={(e) => {
                const sType = e.target.value as any;
                setConnStyle(sType);
                if (onUpdateConnectionProperties) {
                  onUpdateConnectionProperties(selectedConnection.id, { style: sType });
                }
              }}
              className="w-full bg-slate-900/60 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
            >
              <option value="bezier">Cubic Bezier Curve</option>
              <option value="orthogonal">Orthogonal Steps</option>
              <option value="straight">Direct Straight Line</option>
            </select>
          </div>

          {/* Router Probability Weight */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-[9px] font-mono uppercase text-slate-500 tracking-wider flex items-center gap-1">
                Routing Weight / Probability
                <span className="group relative cursor-help">
                  <HelpCircle className="w-3 h-3 text-slate-600 hover:text-slate-400" />
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-950 border border-slate-800 text-[8px] font-mono rounded shadow-xl hidden group-hover:block text-slate-400 leading-normal normal-case z-50">
                    Routing ratio used when branching entity paths from Decision Routers.
                  </span>
                </span>
              </label>
            </div>
            <div className="flex gap-2.5 items-center">
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={connWeight ?? 0.5}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setConnWeight(val);
                  if (onUpdateConnectionProperties) {
                    onUpdateConnectionProperties(selectedConnection.id, { weight: val });
                  }
                }}
                className="flex-1 accent-indigo-500 cursor-ew-resize h-1 bg-slate-800 rounded-lg appearance-none"
              />
              <span className="text-xs font-mono text-indigo-400 w-12 text-right">
                {connWeight !== undefined ? `${(connWeight * 100).toFixed(0)}%` : "N/A"}
              </span>
            </div>
          </div>

          {/* Transfer Delay (Seconds) */}
          <div>
            <label className="block text-[9px] font-mono uppercase text-slate-500 tracking-wider mb-1.5">
              Path Transfer Delay (Seconds)
            </label>
            <input
              type="number"
              min="0"
              max="1000"
              step="0.1"
              placeholder="0 (Instant transfers)"
              value={connDelay ?? ""}
              onChange={(e) => {
                const val = e.target.value === "" ? undefined : parseFloat(e.target.value);
                setConnWeight(val);
                setConnDelay(val);
              }}
              onBlur={handleSaveConnection}
              className="w-full bg-slate-900/60 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          {/* Line Style (Dashing array pattern) */}
          <div>
            <label className="block text-[9px] font-mono uppercase text-slate-500 tracking-wider mb-1.5">
              Line Dash Style
            </label>
            <select
              value={connDashArray}
              onChange={(e) => {
                const val = e.target.value;
                setConnDashArray(val);
                if (onUpdateConnectionProperties) {
                  onUpdateConnectionProperties(selectedConnection.id, { dashArray: val || undefined });
                }
              }}
              className="w-full bg-slate-900/60 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
            >
              <option value="">Solid Wire Path</option>
              <option value="5,5">Dashed Wire (5px, 5px)</option>
              <option value="2,2">Dotted Path (2px, 2px)</option>
              <option value="10,5">Long Dashes (10px, 5px)</option>
            </select>
          </div>

          {/* Color pickers */}
          <div>
            <label className="block text-[9px] font-mono uppercase text-slate-500 tracking-wider mb-1.5">
              Wire accent color
            </label>
            <div className="flex flex-wrap gap-1.5">
              {connColors.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setConnColor(c);
                    if (onUpdateConnectionProperties) {
                      onUpdateConnectionProperties(selectedConnection.id, { color: c });
                    }
                  }}
                  style={{ backgroundColor: c }}
                  className={`w-5 h-5 rounded-full border border-slate-950 transition-transform ${
                    connColor === c ? "scale-125 ring-1 ring-white" : "hover:scale-110"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleSave = () => {
    const updatedProperties: Partial<NodeProperties> = {};

    if (selectedNode.type === "source") {
      updatedProperties.arrivalInterval = arrivalInterval;
      updatedProperties.distribution = distribution;
    } else if (selectedNode.type === "processor") {
      updatedProperties.processingTime = processingTime;
      updatedProperties.distribution = distribution;
      updatedProperties.capacity = capacity;
    } else if (selectedNode.type === "queue") {
      updatedProperties.capacity = capacity;
    } else if (selectedNode.type === "router") {
      updatedProperties.routeProbability = routeProbability;
    } else if (selectedNode.type === "conveyor") {
      updatedProperties.conveyorSpeed = conveyorSpeed;
      updatedProperties.conveyorLength = conveyorLength;
      updatedProperties.capacity = capacity;
    } else if (selectedNode.type === "resource") {
      updatedProperties.resourceType = resourceType;
      updatedProperties.quantity = quantity;
    } else if (selectedNode.type === "transporter") {
      updatedProperties.transporterSpeed = transporterSpeed;
      updatedProperties.transporterCapacity = transporterCapacity;
    } else if (selectedNode.type === "separator") {
      updatedProperties.separatorType = separatorType;
      updatedProperties.separatorSplitRatio = separatorSplitRatio;
    } else if (selectedNode.type === "combiner") {
      updatedProperties.combinerType = combinerType;
      updatedProperties.combinerBatchSize = combinerBatchSize;
    }

    updatedProperties.color = color;
    updatedProperties.width = width;
    updatedProperties.height = height;
    updatedProperties.rotation = rotation;

    onUpdateProperties(selectedNode.id, updatedProperties, name);
  };

  const colors = ["#6366f1", "#10b981", "#eab308", "#ef4444", "#06b6d4", "#f43f5e", "#a855f7", "#ec4899"];

  return (
    <div className="flex flex-col h-full bg-slate-950/40 p-4 border-l border-slate-900 w-full lg:w-80 overflow-y-auto">
      <div className="mb-4 pb-3 border-b border-slate-900">
        <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Settings className="w-3.5 h-3.5 text-indigo-400" />
          Node Inspector
        </h3>
        <p className="text-[9px] text-slate-500 font-mono mt-0.5">
          ID: {selectedNode.id} | Class: {selectedNode.type.toUpperCase()}
        </p>
      </div>

      <div className="space-y-4 flex-1">
        {/* Node label */}
        <div>
          <label className="block text-[9px] font-mono uppercase text-slate-500 tracking-wider mb-1.5">
            Display Label
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleSave}
            className="w-full bg-slate-900/60 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
          />
        </div>

        {/* Geometry (Size & Rotation) */}
        <div className="border-t border-slate-900/40 pt-3">
          <span className="block text-[8px] font-mono uppercase text-indigo-400/80 tracking-wider mb-2 font-semibold">
            Geometry & Orientation
          </span>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[8px] font-mono uppercase text-slate-500 tracking-wider mb-1">
                Width (px)
              </label>
              <input
                type="number"
                min={80}
                max={500}
                value={width}
                onChange={(e) => setWidth(parseInt(e.target.value) || 140)}
                onBlur={handleSave}
                className="w-full bg-slate-900/60 border border-slate-800 rounded px-1.5 py-1 text-[10px] text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-[8px] font-mono uppercase text-slate-500 tracking-wider mb-1">
                Height (px)
              </label>
              <input
                type="number"
                min={40}
                max={400}
                value={height}
                onChange={(e) => setHeight(parseInt(e.target.value) || 52)}
                onBlur={handleSave}
                className="w-full bg-slate-900/60 border border-slate-800 rounded px-1.5 py-1 text-[10px] text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-[8px] font-mono uppercase text-slate-500 tracking-wider mb-1">
                Rotate (°)
              </label>
              <input
                type="number"
                min={0}
                max={360}
                value={rotation}
                onChange={(e) => setRotation(parseInt(e.target.value) || 0)}
                onBlur={handleSave}
                className="w-full bg-slate-900/60 border border-slate-800 rounded px-1.5 py-1 text-[10px] text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Source specifics */}
        {selectedNode.type === "source" && (
          <>
            <div>
              <label className="block text-[9px] font-mono uppercase text-slate-500 tracking-wider mb-1.5">
                Mean Arrival Interval (s)
              </label>
              <input
                type="number"
                min={1}
                max={1000}
                value={arrivalInterval}
                onChange={(e) => setArrivalInterval(parseFloat(e.target.value) || 10)}
                onBlur={handleSave}
                className="w-full bg-slate-900/60 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-[9px] font-mono uppercase text-slate-500 tracking-wider mb-1.5">
                Stochastic Distribution
              </label>
              <select
                value={distribution}
                onChange={(e) => {
                  setDistribution(e.target.value as any);
                  onUpdateProperties(selectedNode.id, { distribution: e.target.value as any }, name);
                }}
                className="w-full bg-slate-900/60 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              >
                <option value="constant">Constant (Deterministic)</option>
                <option value="exponential">Exponential (Poisson Arrivals)</option>
                <option value="normal">Gaussian Normal Distribution</option>
              </select>
            </div>
          </>
        )}

        {/* Processor specifics */}
        {selectedNode.type === "processor" && (
          <>
            <div>
              <label className="block text-[9px] font-mono uppercase text-slate-500 tracking-wider mb-1.5">
                Mean Process Time (s)
              </label>
              <input
                type="number"
                min={0.1}
                max={1000}
                step={0.1}
                value={processingTime}
                onChange={(e) => setProcessingTime(parseFloat(e.target.value) || 8)}
                onBlur={handleSave}
                className="w-full bg-slate-900/60 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-[9px] font-mono uppercase text-slate-500 tracking-wider mb-1.5">
                Parallel Service Units
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={capacity}
                onChange={(e) => setCapacity(parseInt(e.target.value) || 1)}
                onBlur={handleSave}
                className="w-full bg-slate-900/60 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-[9px] font-mono uppercase text-slate-500 tracking-wider mb-1.5">
                Execution Distribution
              </label>
              <select
                value={distribution}
                onChange={(e) => {
                  setDistribution(e.target.value as any);
                  onUpdateProperties(selectedNode.id, { distribution: e.target.value as any }, name);
                }}
                className="w-full bg-slate-900/60 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              >
                <option value="constant">Constant / Linear Time</option>
                <option value="exponential">Markov / Exponential Duration</option>
                <option value="normal">Normal Gaussian (stdDev=20%)</option>
              </select>
            </div>
          </>
        )}

        {/* Queue specifics */}
        {selectedNode.type === "queue" && (
          <div>
            <label className="block text-[9px] font-mono uppercase text-slate-500 tracking-wider mb-1.5">
              Maximum Buffer Capacity
            </label>
            <input
              type="number"
              min={1}
              max={100000}
              value={capacity}
              onChange={(e) => setCapacity(parseInt(e.target.value) || 9999)}
              onBlur={handleSave}
              className="w-full bg-slate-900/60 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>
        )}

        {/* Router specifics */}
        {selectedNode.type === "router" && (
          <div>
            <label className="block text-[9px] font-mono uppercase text-slate-500 tracking-wider mb-1.5">
              Primary routing probability
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={routeProbability}
                onChange={(e) => {
                  setRouteProbability(parseFloat(e.target.value));
                  onUpdateProperties(selectedNode.id, { routeProbability: parseFloat(e.target.value) }, name);
                }}
                className="flex-1 accent-indigo-500 cursor-ew-resize h-1 bg-slate-800 rounded-lg appearance-none"
              />
              <span className="text-xs font-mono text-indigo-400 w-10 text-right">
                {(routeProbability * 100).toFixed(0)}%
              </span>
            </div>
            <p className="text-[8px] text-slate-600 font-mono mt-1.5 leading-normal">
              Probability that entities are routed along the primary (first created) wire. Remaining items take secondary path.
            </p>
          </div>
        )}

        {/* Conveyor specifics */}
        {selectedNode.type === "conveyor" && (
          <>
            <div>
              <label className="block text-[9px] font-mono uppercase text-slate-500 tracking-wider mb-1.5">
                Conveyor Speed (m/s)
              </label>
              <input
                type="number"
                min={0.1}
                max={50}
                step={0.1}
                value={conveyorSpeed}
                onChange={(e) => setConveyorSpeed(parseFloat(e.target.value) || 1.0)}
                onBlur={handleSave}
                className="w-full bg-slate-900/60 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-[9px] font-mono uppercase text-slate-500 tracking-wider mb-1.5">
                Conveyor Length (m)
              </label>
              <input
                type="number"
                min={1}
                max={1000}
                value={conveyorLength}
                onChange={(e) => setConveyorLength(parseFloat(e.target.value) || 10)}
                onBlur={handleSave}
                className="w-full bg-slate-900/60 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-[9px] font-mono uppercase text-slate-500 tracking-wider mb-1.5">
                Transit Capacity (units)
              </label>
              <input
                type="number"
                min={1}
                max={1000}
                value={capacity}
                onChange={(e) => setCapacity(parseInt(e.target.value) || 1)}
                onBlur={handleSave}
                className="w-full bg-slate-900/60 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </>
        )}

        {/* Resource specifics */}
        {selectedNode.type === "resource" && (
          <>
            <div>
              <label className="block text-[9px] font-mono uppercase text-slate-500 tracking-wider mb-1.5">
                Resource Category
              </label>
              <select
                value={resourceType}
                onChange={(e) => {
                  const type = e.target.value as any;
                  setResourceType(type);
                  onUpdateProperties(selectedNode.id, { resourceType: type }, name);
                }}
                className="w-full bg-slate-900/60 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              >
                <option value="Worker">Worker (Operator)</option>
                <option value="Tool">Tooling / Fixtures</option>
                <option value="Fixture">Heavier Equipment</option>
                <option value="Space">Physical Workspace Cell</option>
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-mono uppercase text-slate-500 tracking-wider mb-1.5">
                Max Capacity Pool Quantity
              </label>
              <input
                type="number"
                min={1}
                max={1000}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                onBlur={handleSave}
                className="w-full bg-slate-900/60 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </>
        )}

        {/* Transporter specifics */}
        {selectedNode.type === "transporter" && (
          <>
            <div>
              <label className="block text-[9px] font-mono uppercase text-slate-500 tracking-wider mb-1.5">
                Movement Speed (m/s)
              </label>
              <input
                type="number"
                min={0.1}
                max={100}
                step={0.1}
                value={transporterSpeed}
                onChange={(e) => setTransporterSpeed(parseFloat(e.target.value) || 2.0)}
                onBlur={handleSave}
                className="w-full bg-slate-900/60 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-[9px] font-mono uppercase text-slate-500 tracking-wider mb-1.5">
                Load Carrying Capacity (units)
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={transporterCapacity}
                onChange={(e) => setTransporterCapacity(parseInt(e.target.value) || 5)}
                onBlur={handleSave}
                className="w-full bg-slate-900/60 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </>
        )}

        {/* Separator specifics */}
        {selectedNode.type === "separator" && (
          <>
            <div>
              <label className="block text-[9px] font-mono uppercase text-slate-500 tracking-wider mb-1.5">
                Separation Mode
              </label>
              <select
                value={separatorType}
                onChange={(e) => {
                  const sType = e.target.value as any;
                  setSeparatorType(sType);
                  onUpdateProperties(selectedNode.id, { separatorType: sType }, name);
                }}
                className="w-full bg-slate-900/60 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              >
                <option value="split">Split / Branch Stream</option>
                <option value="batch-split">Batch Deconstruction (Unpack)</option>
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-mono uppercase text-slate-500 tracking-wider mb-1.5">
                {separatorType === "split" ? "Split Ratio (Primary Path %)" : "Units per Batch Split"}
              </label>
              {separatorType === "split" ? (
                <div className="flex gap-2 items-center">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={separatorSplitRatio}
                    onChange={(e) => {
                      setSeparatorSplitRatio(parseFloat(e.target.value));
                      onUpdateProperties(selectedNode.id, { separatorSplitRatio: parseFloat(e.target.value) }, name);
                    }}
                    className="flex-1 accent-indigo-500 cursor-ew-resize h-1 bg-slate-800 rounded-lg appearance-none"
                  />
                  <span className="text-xs font-mono text-indigo-400 w-10 text-right">
                    {(separatorSplitRatio * 100).toFixed(0)}%
                  </span>
                </div>
              ) : (
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={separatorSplitRatio}
                  onChange={(e) => setSeparatorSplitRatio(parseFloat(e.target.value) || 2)}
                  onBlur={handleSave}
                  className="w-full bg-slate-900/60 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                />
              )}
            </div>
          </>
        )}

        {/* Combiner specifics */}
        {selectedNode.type === "combiner" && (
          <>
            <div>
              <label className="block text-[9px] font-mono uppercase text-slate-500 tracking-wider mb-1.5">
                Assembly / Combiner Mode
              </label>
              <select
                value={combinerType}
                onChange={(e) => {
                  const cType = e.target.value as any;
                  setCombinerType(cType);
                  onUpdateProperties(selectedNode.id, { combinerType: cType }, name);
                }}
                className="w-full bg-slate-900/60 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              >
                <option value="batch">Batching (Group units)</option>
                <option value="pack">Packaging (Carrier + Contents)</option>
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-mono uppercase text-slate-500 tracking-wider mb-1.5">
                Target Batch Size
              </label>
              <input
                type="number"
                min={2}
                max={1000}
                value={combinerBatchSize}
                onChange={(e) => setCombinerBatchSize(parseInt(e.target.value) || 2)}
                onBlur={handleSave}
                className="w-full bg-slate-900/60 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </>
        )}

        {/* Color presets */}
        <div>
          <label className="block text-[9px] font-mono uppercase text-slate-500 tracking-wider mb-1.5">
            Node Color Accent
          </label>
          <div className="flex flex-wrap gap-1.5">
            {colors.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setColor(c);
                  onUpdateProperties(selectedNode.id, { color: c }, name);
                }}
                style={{ backgroundColor: c }}
                className={`w-5 h-5 rounded-full border border-slate-950 transition-transform ${
                  color === c ? "scale-125 ring-1 ring-white" : "hover:scale-110"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Real-time KPI widget for the selected Node */}
      {utilizationStats && (
        <div className="mt-6 border-t border-slate-900 pt-4 bg-slate-900/10 p-3 rounded-lg border border-slate-950 flex flex-col gap-2 font-mono">
          <div className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1">
            <Activity className="w-3 h-3 text-indigo-400" />
            Live Component metrics
          </div>
          <div className="grid grid-cols-2 gap-2 text-[9px] text-slate-500">
            <div className="bg-slate-950/40 border border-slate-900/60 p-1.5 rounded">
              <div>UTILIZATION</div>
              <div className="text-xs font-bold text-slate-200 mt-0.5">
                {(utilizationStats.utilization * 100).toFixed(1)}%
              </div>
            </div>
            <div className="bg-slate-950/40 border border-slate-900/60 p-1.5 rounded">
              <div>ACTIVE JOBS</div>
              <div className="text-xs font-bold text-slate-200 mt-0.5">
                {utilizationStats.occupiedCount}
              </div>
            </div>
            <div className="bg-slate-950/40 border border-slate-900/60 p-1.5 rounded col-span-2">
              <div>WAITING ENTITIES</div>
              <div className="text-xs font-bold text-amber-400 mt-0.5">
                {utilizationStats.queueLength} units
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
