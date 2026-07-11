import React, { useState, useEffect, useRef } from "react";
import { SimNode, SimConnection, SimulationLayout, SimEntity, ResourceState } from "../../core/simulation/types";
import { DiscreteEventSimulation } from "../../core/simulation/DiscreteEventSimulation";
import Canvas2D from "./Canvas2D";
import Viewport3D from "./Viewport3D";
import ObjectLibrary from "./ObjectLibrary";
import PropertyInspector from "./PropertyInspector";
import SimulationControls from "./SimulationControls";
import CopilotPanel from "./CopilotPanel";
import ProjectPanel from "./ProjectPanel";
import AuthPanel from "./AuthPanel";
import PluginPanel from "./PluginPanel";
import { usePlatformStore, Locale } from "../../core/store/platformStore";
import { getTranslation } from "../../core/i18n/translations";
import {
  Cpu,
  Layers,
  Database,
  Terminal,
  Activity,
  CheckCircle2,
  AlertTriangle,
  PlayCircle,
  Save,
  Download,
  Upload,
  Workflow,
  Sparkles,
  Folder,
  Shield,
  Globe,
  Sun,
  Moon
} from "lucide-react";

// Default factory assembly line layout
const DEFAULT_LAYOUT: SimulationLayout = {
  nodes: [
    {
      id: "src_01",
      type: "source",
      name: "Material Arrivals",
      x: 50,
      y: 180,
      properties: { arrivalInterval: 12, distribution: "exponential", color: "#10b981" }
    },
    {
      id: "que_01",
      type: "queue",
      name: "Assembly Buffer",
      x: 260,
      y: 180,
      properties: { capacity: 9999, color: "#eab308" }
    },
    {
      id: "prc_01",
      type: "processor",
      name: "CNC Milling Station",
      x: 480,
      y: 180,
      properties: { processingTime: 8, capacity: 1, distribution: "constant", color: "#6366f1" }
    },
    {
      id: "snk_01",
      type: "sink",
      name: "Completed Products",
      x: 720,
      y: 180,
      properties: { color: "#ef4444" }
    }
  ],
  connections: [
    { id: "conn_1", sourceId: "src_01", targetId: "que_01" },
    { id: "conn_2", sourceId: "que_01", targetId: "prc_01" },
    { id: "conn_3", sourceId: "prc_01", targetId: "snk_01" }
  ]
};

export default function MainEditor() {
  const { locale, setLocale, theme, toggleTheme, user } = usePlatformStore();
  const [sidebarTab, setSidebarTab] = useState<"inspector" | "projects" | "auth" | "plugins">("inspector");
  const [nodes, setNodes] = useState<SimNode[]>(DEFAULT_LAYOUT.nodes);
  const [connections, setConnections] = useState<SimConnection[]>(DEFAULT_LAYOUT.connections);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedConnectionIds, setSelectedConnectionIds] = useState<string[]>([]);
  const canvasHistoryPushRef = useRef<() => void>(() => {});
  const [activeView, setActiveView] = useState<"2d" | "3d">("2d");

  const handleSelectNode = (id: string | null) => {
    setSelectedNodeId(id);
    if (id !== null) {
      setSelectedConnectionId(null);
      setSelectedConnectionIds([]);
      setSelectedNodeIds((prev) => prev.includes(id) ? prev : [id]);
    } else {
      setSelectedNodeIds([]);
    }
  };

  const handleSelectConnection = (id: string | null) => {
    setSelectedConnectionId(id);
    if (id !== null) {
      setSelectedNodeId(null);
      setSelectedNodeIds([]);
      setSelectedConnectionIds((prev) => prev.includes(id) ? prev : [id]);
    } else {
      setSelectedConnectionIds([]);
    }
  };

  // Docking Panels Toggle States
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [showBottomConsole, setShowBottomConsole] = useState(true);

  // Solver and control variables
  const [isRunning, setIsRunning] = useState(false);
  const [clockTime, setClockTime] = useState(0);
  const [stepCount, setStepCount] = useState(0);
  const [simSpeed, setSimSpeed] = useState(1.0);
  const [seed, setSeed] = useState(42);
  const [solverType, setSolverType] = useState("deterministic");

  // Simulation collections
  const [entities, setEntities] = useState<SimEntity[]>([]);
  const [resources, setResources] = useState<Record<string, ResourceState>>({});
  const [simLogs, setSimLogs] = useState<string[]>([]);
  const [isPersisting, setIsPersisting] = useState(false);
  const [persistMsg, setPersistMsg] = useState<string | null>(null);

  // WebSocket connection reference
  const socketRef = useRef<WebSocket | null>(null);
  const [wsStatus, setWsStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");

  // Discrete Event Simulator local fallback runner
  const simRunnerRef = useRef<DiscreteEventSimulation | null>(null);
  const localLoopIntervalRef = useRef<any>(null);

  // Load defaults from server or local storage on boot
  useEffect(() => {
    loadProjectFromServer();
  }, []);

  // Set up WebSocket client link
  useEffect(() => {
    connectWebSocket();
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      stopLocalSimulationLoop();
    };
  }, []);

  // Connect WebSockets
  const connectWebSocket = () => {
    try {
      setWsStatus("connecting");
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host; // e.g., localhost:3000 or the run app URL
      const wsUrl = `${proto}//${host}/ws`;

      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setWsStatus("connected");
        // Sync layout upon connection
        ws.send(JSON.stringify({
          type: "sync_layout",
          layout: { nodes, connections }
        }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "sim_tick") {
            // Receive high-frequency real-time tick packets directly from the Express engine!
            setClockTime(msg.summary.clockTime);
            setStepCount(msg.summary.stepCount);
            setEntities(msg.summary.entities);
            setResources(msg.summary.resources);
            setSimLogs(msg.summary.recentLogs);
          } else if (msg.type === "sim_state_changed") {
            setIsRunning(msg.state === "Running");
          }
        } catch (e) {
          console.error("Error parsing WebSocket message:", e);
        }
      };

      ws.onclose = () => {
        setWsStatus("disconnected");
        // Retry connection in 5s
        setTimeout(connectWebSocket, 5000);
      };

      ws.onerror = () => {
        setWsStatus("disconnected");
      };
    } catch (e) {
      console.error("WS error:", e);
      setWsStatus("disconnected");
    }
  };

  // Run Local Fallback DES Loop
  const startLocalSimulationLoop = () => {
    stopLocalSimulationLoop();

    // Create simulator runner
    if (!simRunnerRef.current) {
      simRunnerRef.current = new DiscreteEventSimulation({ nodes, connections }, seed);
    }

    const intervalMs = Math.max(10, 100 / simSpeed);

    localLoopIntervalRef.current = setInterval(() => {
      const runner = simRunnerRef.current;
      if (!runner) return;

      // Run multiple steps if simulation speed is higher to avoid slowing down rendering
      const stepsToRun = Math.max(1, Math.floor(simSpeed));
      let keepStepping = true;

      for (let i = 0; i < stepsToRun; i++) {
        keepStepping = runner.step();
        if (!keepStepping) break;
      }

      const summary = runner.getSummary();
      setClockTime(summary.clockTime);
      setStepCount(summary.stepCount);
      setEntities(summary.entities);
      setResources(summary.resources);
      setSimLogs(summary.recentLogs);

      if (!keepStepping) {
        setIsRunning(false);
        stopLocalSimulationLoop();
      }
    }, intervalMs);
  };

  const stopLocalSimulationLoop = () => {
    if (localLoopIntervalRef.current) {
      clearInterval(localLoopIntervalRef.current);
      localLoopIntervalRef.current = null;
    }
  };

  // Load project from Node REST server
  const loadProjectFromServer = async () => {
    try {
      const response = await fetch("/api/projects/default");
      if (response.ok) {
        const proj = await response.json();
        if (proj && proj.layout) {
          setNodes(proj.layout.nodes || DEFAULT_LAYOUT.nodes);
          setConnections(proj.layout.connections || DEFAULT_LAYOUT.connections);
          simRunnerRef.current = null; // force re-init
        }
      }
    } catch (e) {
      console.warn("Failed to contact API server for layout, falling back to local storage.", e);
    }
  };

  // Save current project layout to persistent Express layer
  const saveProjectToServer = async () => {
    setIsPersisting(true);
    setPersistMsg(null);
    try {
      const response = await fetch("/api/projects/default", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodes: nodes,
          connections: connections
        })
      });

      if (response.ok) {
        setPersistMsg("Topology layout written to database context successfully.");
        setTimeout(() => setPersistMsg(null), 3000);
      } else {
        throw new Error("HTTP error saving layout");
      }
    } catch (e) {
      setPersistMsg("Database unavailable. Project cached in local RAM.");
      setTimeout(() => setPersistMsg(null), 3000);
    } finally {
      setIsPersisting(false);
    }
  };

  // Controls implementations
  const handlePlayPause = () => {
    const nextState = !isRunning;
    setIsRunning(nextState);

    if (wsStatus === "connected" && socketRef.current) {
      // Direct remote control over WebSockets!
      socketRef.current.send(JSON.stringify({
        type: nextState ? "sim_start" : "sim_pause"
      }));
    } else {
      // Offline fallback processing
      if (nextState) {
        startLocalSimulationLoop();
      } else {
        stopLocalSimulationLoop();
      }
    }
  };

  const handleStopReset = () => {
    setIsRunning(false);
    setClockTime(0);
    setStepCount(0);
    setEntities([]);
    setSimLogs([]);

    if (wsStatus === "connected" && socketRef.current) {
      socketRef.current.send(JSON.stringify({ type: "sim_reset" }));
    } else {
      stopLocalSimulationLoop();
      simRunnerRef.current = new DiscreteEventSimulation({ nodes, connections }, seed);
      const summary = simRunnerRef.current.getSummary();
      setResources(summary.resources);
      setSimLogs(["Local simulator variables reset."]);
    }
  };

  const handleStep = () => {
    if (wsStatus === "connected" && socketRef.current) {
      socketRef.current.send(JSON.stringify({ type: "sim_step" }));
    } else {
      if (!simRunnerRef.current) {
        simRunnerRef.current = new DiscreteEventSimulation({ nodes, connections }, seed);
      }
      simRunnerRef.current.step();
      const summary = simRunnerRef.current.getSummary();
      setClockTime(summary.clockTime);
      setStepCount(summary.stepCount);
      setEntities(summary.entities);
      setResources(summary.resources);
      setSimLogs(summary.recentLogs);
    }
  };

  // Flow modifications handlers
  const handleAddNode = (type: string) => {
    const newId = `${type.slice(0, 3)}_${Math.floor(Math.random() * 100000)}`;
    const randomOffset = Math.floor(Math.random() * 40) - 20;
    
    const newNode: SimNode = {
      id: newId,
      type: type as any,
      name: `New ${type.toUpperCase()}`,
      x: 350 + randomOffset,
      y: 200 + randomOffset,
      properties: {
        color: type === "processor" ? "#6366f1" : type === "queue" ? "#eab308" : "#10b981",
        ...(type === "source" ? { arrivalInterval: 10 } : {}),
        ...(type === "processor" ? { processingTime: 8, capacity: 1 } : {}),
        ...(type === "queue" ? { capacity: 9999 } : {}),
        ...(type === "router" ? { routeProbability: 0.5 } : {})
      }
    };

    const updatedNodes = [...nodes, newNode];
    setNodes(updatedNodes);
    setSelectedNodeId(newId);

    // Sync layout across WebSockets if connected
    if (wsStatus === "connected" && socketRef.current) {
      socketRef.current.send(JSON.stringify({
        type: "sync_layout",
        layout: { nodes: updatedNodes, connections }
      }));
    } else {
      simRunnerRef.current = null; // force reinitialization
    }
  };

  const handleUpdateNodeCoords = (id: string, x: number, y: number) => {
    const updatedNodes = nodes.map((n) => (n.id === id ? { ...n, x, y } : n));
    setNodes(updatedNodes);

    if (wsStatus === "connected" && socketRef.current) {
      socketRef.current.send(JSON.stringify({
        type: "sync_layout",
        layout: { nodes: updatedNodes, connections }
      }));
    }
  };

  const handleAddConnection = (sourceId: string, targetId: string) => {
    // Avoid self connections
    if (sourceId === targetId) return;

    // Avoid duplicates
    const exists = connections.some((c) => c.sourceId === sourceId && c.targetId === targetId);
    if (exists) return;

    // Avoid connecting to a source node as target (since source nodes have no input port)
    const targetNode = nodes.find((n) => n.id === targetId);
    if (targetNode?.type === "source") return;

    const newConn: SimConnection = {
      id: `conn_${Math.floor(Math.random() * 100000)}`,
      sourceId,
      targetId,
      style: "bezier",
      color: "#64748b",
      weight: 1.0,
      delay: 0
    };

    const updatedConns = [...connections, newConn];
    setConnections(updatedConns);

    if (wsStatus === "connected" && socketRef.current) {
      socketRef.current.send(JSON.stringify({
        type: "sync_layout",
        layout: { nodes, connections: updatedConns }
      }));
    } else {
      simRunnerRef.current = null;
    }
  };

  const handleDeleteNode = (id: string) => {
    const updatedNodes = nodes.filter((n) => n.id !== id);
    const updatedConns = connections.filter((c) => c.sourceId !== id && c.targetId !== id);

    setNodes(updatedNodes);
    setConnections(updatedConns);
    setSelectedNodeId(null);

    if (wsStatus === "connected" && socketRef.current) {
      socketRef.current.send(JSON.stringify({
        type: "sync_layout",
        layout: { nodes: updatedNodes, connections: updatedConns }
      }));
    } else {
      simRunnerRef.current = null;
    }
  };

  const handleDeleteConnection = (id: string) => {
    const updatedConns = connections.filter((c) => c.id !== id);
    setConnections(updatedConns);
    if (selectedConnectionId === id) {
      setSelectedConnectionId(null);
    }

    if (wsStatus === "connected" && socketRef.current) {
      socketRef.current.send(JSON.stringify({
        type: "sync_layout",
        layout: { nodes, connections: updatedConns }
      }));
    } else {
      simRunnerRef.current = null;
    }
  };

  const handleUpdateConnectionProperties = (id: string, updatedProps: Partial<SimConnection>) => {
    if (canvasHistoryPushRef.current) {
      canvasHistoryPushRef.current();
    }
    const updatedConns = connections.map((c) => (c.id === id ? { ...c, ...updatedProps } : c));
    setConnections(updatedConns);

    if (wsStatus === "connected" && socketRef.current) {
      socketRef.current.send(JSON.stringify({
        type: "sync_layout",
        layout: { nodes, connections: updatedConns }
      }));
    } else {
      simRunnerRef.current = null;
    }
  };

  const handleUpdateMultipleConnectionsProperties = (ids: string[], updatedProps: Partial<SimConnection>) => {
    if (canvasHistoryPushRef.current) {
      canvasHistoryPushRef.current();
    }
    const updatedConns = connections.map((c) => (ids.includes(c.id) ? { ...c, ...updatedProps } : c));
    setConnections(updatedConns);

    if (wsStatus === "connected" && socketRef.current) {
      socketRef.current.send(JSON.stringify({
        type: "sync_layout",
        layout: { nodes, connections: updatedConns }
      }));
    } else {
      simRunnerRef.current = null;
    }
  };

  const handleUpdateProperties = (id: string, updatedProps: any, updatedName?: string) => {
    if (canvasHistoryPushRef.current) {
      canvasHistoryPushRef.current();
    }
    const updatedNodes = nodes.map((n) => {
      if (n.id === id) {
        return {
          ...n,
          name: updatedName !== undefined ? updatedName : n.name,
          properties: { ...n.properties, ...updatedProps }
        };
      }
      return n;
    });

    setNodes(updatedNodes);

    if (wsStatus === "connected" && socketRef.current) {
      socketRef.current.send(JSON.stringify({
        type: "sync_layout",
        layout: { nodes: updatedNodes, connections }
      }));
    } else {
      simRunnerRef.current = null;
    }
  };

  const handleUpdateMultipleNodesProperties = (ids: string[], updatedProps: any, updatedName?: string) => {
    if (canvasHistoryPushRef.current) {
      canvasHistoryPushRef.current();
    }
    const updatedNodes = nodes.map((n) => {
      if (ids.includes(n.id)) {
        return {
          ...n,
          name: updatedName !== undefined ? updatedName : n.name,
          properties: { ...n.properties, ...updatedProps }
        };
      }
      return n;
    });

    setNodes(updatedNodes);

    if (wsStatus === "connected" && socketRef.current) {
      socketRef.current.send(JSON.stringify({
        type: "sync_layout",
        layout: { nodes: updatedNodes, connections }
      }));
    } else {
      simRunnerRef.current = null;
    }
  };

  // AI deployment callback
  const handleDeployLayout = (layout: SimulationLayout) => {
    setNodes(layout.nodes);
    setConnections(layout.connections);
    setSelectedNodeId(null);

    if (wsStatus === "connected" && socketRef.current) {
      socketRef.current.send(JSON.stringify({
        type: "sync_layout",
        layout: layout
      }));
    } else {
      simRunnerRef.current = null;
    }
  };

  // Helper properties count
  const activeEntityLocations = useRef<Record<string, string>>({});
  activeEntityLocations.current = {};
  entities.forEach((ent) => {
    if (ent.status !== "Completed") {
      const current = activeEntityLocations.current[ent.currentLocationId] || "0";
      activeEntityLocations.current[ent.currentLocationId] = (parseInt(current) + 1).toString();
    }
  });

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;
  const selectedNodeStats = selectedNode ? resources[selectedNode.id] : undefined;

  // Global KPIs summary
  const totalArrived = entities.length;
  const totalCompleted = entities.filter((e) => e.status === "Completed").length;
  const totalInSystem = totalArrived - totalCompleted;

  return (
    <div className="flex-1 flex flex-col overflow-hidden w-full">
      
      {/* Top Section Actions HUD */}
      <div className="border-b border-slate-900 bg-slate-950/60 p-3 px-6 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-3">
          <Workflow className="w-4 h-4 text-indigo-400" />
          <div>
            <h2 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider">
              {getTranslation(locale, "title")} • {getTranslation(locale, "visualEditor")}
            </h2>
            <p className="text-[9px] font-mono text-slate-500">
              {getTranslation(locale, "subtitle")} | Platform Foundation 2.1
            </p>
          </div>
        </div>

        {/* Sync telemetry, Theme, Locale, and Permissions HUD */}
        <div className="flex flex-wrap items-center gap-3">
          {persistMsg && (
            <span className="text-[9px] font-mono text-emerald-400 border border-emerald-900/30 bg-emerald-950/20 px-2.5 py-0.5 rounded animate-fade-in">
              {persistMsg}
            </span>
          )}

          {/* Theme engine selection */}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
            title={`${getTranslation(locale, "theme")}: ${theme.toUpperCase()}`}
          >
            {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>

          {/* Docking Controls */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5" title="Workspace Docking Controls">
            <button
              onClick={() => setShowLeftSidebar(!showLeftSidebar)}
              className={`p-1 rounded text-[9px] font-mono font-bold uppercase transition-all px-2 cursor-pointer ${
                showLeftSidebar ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-300"
              }`}
              title="Toggle Left Object Library"
            >
              LIB
            </button>
            <button
              onClick={() => setShowBottomConsole(!showBottomConsole)}
              className={`p-1 rounded text-[9px] font-mono font-bold uppercase transition-all px-2 cursor-pointer ${
                showBottomConsole ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-300"
              }`}
              title="Toggle Bottom Console & Copilot"
            >
              CONSOLE
            </button>
            <button
              onClick={() => setShowRightSidebar(!showRightSidebar)}
              className={`p-1 rounded text-[9px] font-mono font-bold uppercase transition-all px-2 cursor-pointer ${
                showRightSidebar ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-300"
              }`}
              title="Toggle Right Property Panel"
            >
              PROPS
            </button>
          </div>

          {/* Internationalization Locale selector */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-slate-400">
            <Globe className="w-3.5 h-3.5 text-indigo-400" />
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value as Locale)}
              className="bg-transparent text-[10px] font-mono font-bold focus:outline-none border-none text-slate-300 uppercase cursor-pointer"
            >
              <option value="en">EN</option>
              <option value="de">DE</option>
              <option value="ja">JA</option>
            </select>
          </div>

          {/* Role badge */}
          {user && (
            <div className={`px-2.5 py-1 rounded-lg border text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 ${
              user.role === "admin" ? "bg-red-950/25 border-red-900/40 text-red-400" :
              user.role === "editor" ? "bg-indigo-950/25 border-indigo-900/40 text-indigo-400" :
              "bg-slate-900 border-slate-800 text-slate-400"
            }`}>
              <Shield className="w-3 h-3" />
              <span>{user.role}</span>
            </div>
          )}

          {wsStatus === "connected" ? (
            <span className="text-[9px] font-mono uppercase bg-emerald-950/40 border border-emerald-900/40 text-emerald-400 px-2 py-1 rounded flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              {getTranslation(locale, "wsSynced")}
            </span>
          ) : (
            <span className="text-[9px] font-mono uppercase bg-slate-900 border border-slate-800 text-slate-500 px-2 py-1 rounded flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-600"></span>
              {getTranslation(locale, "wsOffline")}
            </span>
          )}

          <button
            onClick={saveProjectToServer}
            disabled={isPersisting || user?.role === "viewer"}
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300 py-1.5 px-3 rounded-lg cursor-pointer transition-all"
            title={user?.role === "viewer" ? "Save locked in Viewer mode" : "Commit current schematic"}
          >
            <Save className="w-3.5 h-3.5" />
            <span>{getTranslation(locale, "saveProject").toUpperCase()}</span>
          </button>
        </div>
      </div>

      {/* Main split work layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* Left Side: Object Library */}
        {showLeftSidebar && <ObjectLibrary onAddNode={handleAddNode} />}

        {/* Center Canvas & Viewport Area */}
        <div className="flex-1 flex flex-col p-4 lg:p-6 overflow-y-auto space-y-4">
          
          {/* View Mode Tabs Selector + Sim controls */}
          <SimulationControls
            isRunning={isRunning}
            clockTime={clockTime}
            stepCount={stepCount}
            simSpeed={simSpeed}
            seed={seed}
            solverType={solverType}
            onPlayPause={handlePlayPause}
            onStopReset={handleStopReset}
            onStep={handleStep}
            onSpeedChange={setSimSpeed}
            onSeedChange={setSeed}
            onSolverChange={setSolverType}
          />

          {/* Central Active View (2D Canvas or 3D Viewport) */}
          <div className="bg-slate-950 border border-slate-900 rounded-xl relative">
            
            {/* View Mode toggle tabs */}
            <div className="absolute top-3 right-4 z-30 flex bg-slate-900 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setActiveView("2d")}
                className={`px-3 py-1 text-[9px] font-mono font-bold rounded transition-colors cursor-pointer ${
                  activeView === "2d" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                2D SCHEMA
              </button>
              <button
                onClick={() => setActiveView("3d")}
                className={`px-3 py-1 text-[9px] font-mono font-bold rounded transition-colors cursor-pointer ${
                  activeView === "3d" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                3D VIEWPORT
              </button>
            </div>

            {/* Renderer viewport switch */}
            {activeView === "2d" ? (
              <Canvas2D
                nodes={nodes}
                connections={connections}
                selectedNodeId={selectedNodeId}
                onSelectNode={handleSelectNode}
                selectedConnectionId={selectedConnectionId}
                onSelectConnection={handleSelectConnection}
                onUpdateNodeCoords={handleUpdateNodeCoords}
                onAddConnection={handleAddConnection}
                onDeleteNode={handleDeleteNode}
                onDeleteConnection={handleDeleteConnection}
                activeEntityLocations={activeEntityLocations.current}
                onSelectionChanged={(nodeIds, connIds) => {
                  setSelectedNodeIds(nodeIds);
                  setSelectedConnectionIds(connIds);
                  if (nodeIds.length === 1) {
                    setSelectedNodeId(nodeIds[0]);
                  } else if (nodeIds.length === 0) {
                    setSelectedNodeId(null);
                  }
                  if (connIds.length === 1) {
                    setSelectedConnectionId(connIds[0]);
                  } else if (connIds.length === 0) {
                    setSelectedConnectionId(null);
                  }
                }}
                onHistoryReady={(pushHistory) => {
                  canvasHistoryPushRef.current = pushHistory;
                }}
                onUpdateLayout={(newNodes, newConns) => {
                  setNodes(newNodes);
                  setConnections(newConns);
                  if (wsStatus === "connected" && socketRef.current) {
                    socketRef.current.send(JSON.stringify({
                      type: "sync_layout",
                      layout: { nodes: newNodes, connections: newConns }
                    }));
                  } else {
                    simRunnerRef.current = null;
                  }
                }}
              />
            ) : (
              <Viewport3D
                nodes={nodes}
                connections={connections}
                entities={entities}
                clockTime={clockTime}
              />
            )}
          </div>

          {/* Bottom Panel Split: AI Copilot & Live Event log */}
          {showBottomConsole && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* AI Prompt compiler */}
              <CopilotPanel currentLayout={{ nodes, connections }} onDeployLayout={handleDeployLayout} />

              {/* Discrete Event Scheduler Logger */}
              <div className="bg-slate-900/60 border border-slate-900 rounded-xl p-4 flex flex-col h-[230px]">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                    DES Simulation Log Stream
                  </h3>
                  <span className="text-[8px] font-mono uppercase bg-slate-950 px-1.5 py-0.5 rounded border border-slate-850 text-slate-600">
                    Ring Capacity: 200
                  </span>
                </div>

                <div className="flex-1 bg-slate-950 rounded-lg p-3 border border-slate-850 overflow-y-auto font-mono text-[10px] text-slate-300 space-y-1 select-text scrollbar-thin">
                  {simLogs.map((log, idx) => (
                    <div
                      key={idx}
                      className={`flex gap-2 leading-relaxed border-b border-slate-950 py-0.5 ${
                        log.includes("[BLOCK]")
                          ? "text-red-400 bg-red-950/10 px-1 rounded"
                          : log.includes("Create")
                          ? "text-emerald-400"
                          : log.includes("completed")
                          ? "text-blue-400"
                          : "text-slate-300"
                      }`}
                    >
                      <span className="text-slate-600 font-bold">▶</span>
                      <span>{log}</span>
                    </div>
                  ))}
                  {simLogs.length === 0 && (
                    <div className="text-slate-600 italic text-center py-10">
                      Console idle. Click PLAY above to trigger state mutations.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* System KPIs Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-3 flex flex-col justify-between">
              <span className="text-[9px] font-mono uppercase text-slate-500 font-bold">TOTAL ENTITIES GENERATED</span>
              <span className="text-2xl font-mono font-bold text-slate-200 mt-2">{totalArrived}</span>
              <p className="text-[8px] font-mono text-slate-600 mt-1">Sum of arrival events processed</p>
            </div>
            <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-3 flex flex-col justify-between">
              <span className="text-[9px] font-mono uppercase text-slate-500 font-bold">WORKFLOW COMPLETED</span>
              <span className="text-2xl font-mono font-bold text-emerald-400 mt-2">{totalCompleted}</span>
              <p className="text-[8px] font-mono text-slate-600 mt-1">Successfully reached exit terminal sinks</p>
            </div>
            <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-3 flex flex-col justify-between">
              <span className="text-[9px] font-mono uppercase text-slate-500 font-bold">ACTIVE IN PROCESS</span>
              <span className="text-2xl font-mono font-bold text-indigo-400 mt-2">{totalInSystem}</span>
              <p className="text-[8px] font-mono text-slate-600 mt-1">Buffered in queues or active processing</p>
            </div>
          </div>

        </div>

        {/* Right Side: Unified Enterprise Control Panel Tabbed Sidebar */}
        {showRightSidebar && (
          <div className="w-full lg:w-96 border-l border-slate-900 bg-slate-950/20 flex flex-col h-full overflow-hidden shrink-0">
            
            {/* Tab Selection Header */}
            <div className="flex bg-slate-950 border-b border-slate-900 p-1.5">
              <button
                onClick={() => setSidebarTab("inspector")}
                className={`flex-1 py-2 px-1 rounded font-mono text-[9px] font-bold uppercase tracking-wider flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  sidebarTab === "inspector"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-500 hover:text-slate-300 hover:bg-slate-900"
                }`}
                title="Parameters Inspector"
              >
                <Activity className="w-3.5 h-3.5" />
                <span>INSPECT</span>
              </button>

              <button
                onClick={() => setSidebarTab("projects")}
                className={`flex-1 py-2 px-1 rounded font-mono text-[9px] font-bold uppercase tracking-wider flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  sidebarTab === "projects"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-500 hover:text-slate-300 hover:bg-slate-900"
                }`}
                title="Project & Version Manager"
              >
                <Folder className="w-3.5 h-3.5" />
                <span>PROJECTS</span>
              </button>

              <button
                onClick={() => setSidebarTab("auth")}
                className={`flex-1 py-2 px-1 rounded font-mono text-[9px] font-bold uppercase tracking-wider flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  sidebarTab === "auth"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-500 hover:text-slate-300 hover:bg-slate-900"
                }`}
                title="Operator Identity Gate"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>GATEWAY</span>
              </button>

              <button
                onClick={() => setSidebarTab("plugins")}
                className={`flex-1 py-2 px-1 rounded font-mono text-[9px] font-bold uppercase tracking-wider flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  sidebarTab === "plugins"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-500 hover:text-slate-300 hover:bg-slate-900"
                }`}
                title="System Plugins Manager"
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>PLUGINS</span>
              </button>
            </div>

            {/* Active Tab Body Section */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {sidebarTab === "inspector" && (
                <PropertyInspector
                  selectedNode={selectedNode}
                  selectedNodes={nodes.filter((n) => selectedNodeIds.includes(n.id))}
                  selectedConnection={connections.find((c) => c.id === selectedConnectionId) || null}
                  selectedConnections={connections.filter((c) => selectedConnectionIds.includes(c.id))}
                  onUpdateProperties={handleUpdateProperties}
                  onUpdateMultipleNodesProperties={handleUpdateMultipleNodesProperties}
                  onUpdateConnectionProperties={handleUpdateConnectionProperties}
                  onUpdateMultipleConnectionsProperties={handleUpdateMultipleConnectionsProperties}
                  utilizationStats={selectedNodeStats}
                />
              )}
              {sidebarTab === "projects" && (
                <ProjectPanel
                  currentLayout={{ nodes, connections }}
                  onLoadLayout={(layout) => {
                    setNodes(layout.nodes);
                    setConnections(layout.connections);
                  }}
                />
              )}
              {sidebarTab === "auth" && <AuthPanel />}
              {sidebarTab === "plugins" && <PluginPanel />}
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
