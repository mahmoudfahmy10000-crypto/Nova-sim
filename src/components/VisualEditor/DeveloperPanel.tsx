import React, { useState, useEffect, useRef } from "react";
import {
  Terminal,
  Play,
  ChevronRight,
  Circle,
  Cpu,
  Workflow,
  Plus,
  Trash2,
  Code,
  BookOpen,
  Share2,
  Zap,
  RotateCcw,
  Bug,
  List,
  Layers,
  HelpCircle,
  Radio,
  FileCode,
  Clock,
  Eye,
  Settings,
  Flame
} from "lucide-react";
import { usePlatformStore } from "../../core/store/platformStore";
import { SimNode } from "../../core/simulation/types";

interface DeveloperPanelProps {
  nodes: SimNode[];
  onUpdateProperties?: (nodeId: string, props: any) => void;
  simulationLog?: string[];
  clockTime?: number;
}

export default function DeveloperPanel({ nodes, onUpdateProperties, clockTime = 0 }: DeveloperPanelProps) {
  const { addLog, logs } = usePlatformStore();
  const [activeTab, setActiveTab] = useState<"scripting" | "automation" | "expressions" | "sdk">("scripting");

  // --- SCRIPTING SECTION STATES ---
  const [language, setLanguage] = useState<"python" | "javascript" | "csharp">("javascript");
  const [scriptText, setScriptText] = useState<string>(
    `// NovaSim Core Event Handler Script\n` +
    `// Triggered on every simulation solver tick\n\n` +
    `const latheNode = sim.getNode("prc_01");\n` +
    `const queueNode = sim.getNode("que_01");\n\n` +
    `if (queueNode && queueNode.properties.capacity < 10) {\n` +
    `  // Dynamically increase buffer capacity under stress\n` +
    `  queueNode.properties.capacity = 20;\n` +
    `  sim.log("AI Scripting: Expanded Buffer Capacity to 20 units.");\n` +
    `}\n\n` +
    `// Apply sine-wave workload modulation\n` +
    `if (latheNode) {\n` +
    `  latheNode.properties.processingTime = Math.max(2, 5 + Math.sin(sim.time) * 3);\n` +
    `}`
  );

  const [breakpoints, setBreakpoints] = useState<number[]>([5, 12]);
  const [isDebugging, setIsDebugging] = useState(false);
  const [currentDebugLine, setCurrentDebugLine] = useState<number | null>(null);
  const [scriptConsoleLogs, setScriptConsoleLogs] = useState<string[]>([
    "WasmHostRuntime initialized with 128MB isolated memory heap.",
    "System: JavaScript v8 engine compiled.",
    "Click RUN to execute script or DEBUG to step through code."
  ]);
  const [autocompleteOpen, setAutocompleteOpen] = useState(false);
  const [autocompleteSearch, setAutocompleteSearch] = useState("");
  const autocompleteRef = useRef<HTMLDivElement>(null);

  // Script inspection variables
  const [liveVariables, setLiveVariables] = useState([
    { name: "sim.time", value: clockTime.toFixed(2), type: "number" },
    { name: "sim.activeEntities", value: "3", type: "number" },
    { name: "latheNode.cycleCount", value: "24", type: "number" },
    { name: "queueNode.occupancy", value: "4", type: "number" },
    { name: "heapUsage", value: "4.21 MB", type: "memory" }
  ]);

  // Update live clock variable in debugger inspector
  useEffect(() => {
    setLiveVariables(prev =>
      prev.map(v => (v.name === "sim.time" ? { ...v, value: clockTime.toFixed(2) } : v))
    );
  }, [clockTime]);

  const autocompleteSuggestions = [
    { name: "sim.time", desc: "Get current solver clock time (seconds)" },
    { name: "sim.getNode(id)", desc: "Fetch specific graph node object" },
    { name: "sim.log(msg)", desc: "Log message to IDE Live Console" },
    { name: "sim.triggerCustomEvent(id)", desc: "Trigger background automation flow" },
    { name: "math.sin(x)", desc: "Standard sine wave modulation function" },
    { name: "random.normal(mean, std)", desc: "Generate Gaussian probability" },
    { name: "random.exponential(rate)", desc: "Generate exponential interval" },
    { name: "latheNode.properties.processingTime", desc: "Adjust lathe processing delay" }
  ];

  // --- AUTOMATION STATES ---
  const [triggers, setTriggers] = useState([
    { id: "tr_1", event: "On Entity Arrival", action: "Run CNC CNC Milling Script", active: true },
    { id: "tr_2", event: "On Queue Full", action: "Trigger Overload Route", active: true },
    { id: "tr_3", event: "On Scheduled Interval (5s)", action: "Reset System Statistics", active: false }
  ]);
  const [scheduledTasks, setScheduledTasks] = useState([
    { id: "st_1", pattern: "*/5 * * * *", task: "Auto-backup Layout", lastRun: "10 seconds ago", active: true },
    { id: "st_2", pattern: "0 0 * * *", task: "Purge Database Archives", lastRun: "12 hours ago", active: false }
  ]);
  const [isRecordingMacro, setIsRecordingMacro] = useState(false);
  const [macroSteps, setMacroSteps] = useState<string[]>([
    "Select node 'CNC Milling Station'",
    "Set process time to 8.5s",
    "Toggle 'Show Grid' inside 2D Schema"
  ]);

  // --- EXPRESSIONS STATES ---
  const [formulaValue, setFormulaValue] = useState("Math.sin(time) * 4 + 8");
  const [formulaTarget, setFormulaTarget] = useState("prc_01.processingTime");
  const [formulaError, setFormulaError] = useState<string | null>(null);
  const [activeFormulaDoc, setActiveFormulaDoc] = useState<string | null>(null);

  // --- SDK PLATFORM STATES ---
  const [selectedSdkApi, setSelectedSdkApi] = useState<"rest" | "ws" | "plugin">("rest");
  const [apiResponse, setApiResponse] = useState<string | null>(null);
  const [isLoadingApi, setIsLoadingApi] = useState(false);

  // Autocomplete handle clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (autocompleteRef.current && !autocompleteRef.current.contains(event.target as Node)) {
        setAutocompleteOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleRunScript = () => {
    setScriptConsoleLogs(prev => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] Executing script via WebAssembly sandboxed host runtime...`,
      `[INFO] Script evaluated successfully. Changes applied to active graph structures.`
    ]);
    addLog("Developer Script compiled and injected into core solver runtime.");
  };

  const handleStartDebugging = () => {
    setIsDebugging(true);
    setCurrentDebugLine(breakpoints[0] || 1);
    setScriptConsoleLogs(prev => [
      ...prev,
      `[DEBUG] Solver paused. Breakpoint hit at line ${breakpoints[0] || 1}. Inspector active.`
    ]);
  };

  const handleStepDebug = () => {
    if (!isDebugging) return;
    setCurrentDebugLine(prev => {
      const next = prev ? prev + 3 : 1;
      if (next > 15) {
        setIsDebugging(false);
        setScriptConsoleLogs(p => [...p, "[DEBUG] Execution reached end of script. Debugging finished."]);
        return null;
      }
      return next;
    });
  };

  const handleStopDebugging = () => {
    setIsDebugging(false);
    setCurrentDebugLine(null);
    setScriptConsoleLogs(prev => [...prev, "[DEBUG] Debugger terminated. Simulation resumed."]);
  };

  const handleToggleBreakpoint = (line: number) => {
    setBreakpoints(prev =>
      prev.includes(line) ? prev.filter(l => l !== line) : [...prev, line].sort((a, b) => a - b)
    );
  };

  const handleAddAutocomplete = (value: string) => {
    setScriptText(prev => prev + value);
    setAutocompleteOpen(false);
  };

  // REST API Client simulation
  const handleSendSampleRequest = async (url: string, method: string) => {
    setIsLoadingApi(true);
    setApiResponse(null);
    try {
      const endpoint = url.replace(":id", "proj_default");
      const response = await fetch(endpoint, { method });
      const data = await response.json();
      setApiResponse(JSON.stringify(data, null, 2));
    } catch (err: any) {
      setApiResponse(JSON.stringify({ error: "Failed to query the live API", message: err.message }, null, 2));
    } finally {
      setIsLoadingApi(false);
    }
  };

  return (
    <div className="bg-slate-900/60 border border-slate-900 rounded-xl p-4 flex flex-col h-full gap-4">
      {/* Tab select header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-indigo-400" />
          <h3 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider">
            Dev Platform & Scripts
          </h3>
        </div>
        <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-850">
          {(["scripting", "automation", "expressions", "sdk"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-2 py-1 text-[8px] font-mono font-bold rounded uppercase transition-colors cursor-pointer ${
                activeTab === tab ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* TABS CONTAINER */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-[400px]">
        {/* TAB 1: SCRIPTING WORKSPACE */}
        {activeTab === "scripting" && (
          <div className="flex-1 flex flex-col gap-3 overflow-hidden">
            <div className="flex items-center justify-between gap-2">
              {/* Language selection dropdown */}
              <div className="flex items-center gap-1.5">
                <Code className="w-3.5 h-3.5 text-slate-500" />
                <select
                  value={language}
                  onChange={e => {
                    const lang = e.target.value as "python" | "javascript" | "csharp";
                    setLanguage(lang);
                    if (lang === "python") {
                      setScriptText(
                        `# NovaSim Embedded Python Script\n` +
                        `# Direct WASM integration\n\n` +
                        `lathe_node = sim.get_node("prc_01")\n` +
                        `queue_node = sim.get_node("que_01")\n\n` +
                        `if queue_node and queue_node.properties.capacity < 10:\n` +
                        `    queue_node.properties.capacity = 20\n` +
                        `    sim.log("Expanded Capacity via Python Script")`
                      );
                    } else if (lang === "csharp") {
                      setScriptText(
                        `// NovaSim Embedded C# Script\n` +
                        `using System;\n` +
                        `using NovaSim.Core;\n\n` +
                        `public class EventTrigger {\n` +
                        `    public static void Main(SimHost sim) {\n` +
                        `        var lathe = sim.GetNode("prc_01");\n` +
                        `        if (lathe != null) {\n` +
                        `            lathe.Properties.ProcessingTime = 6.0;\n` +
                        `        }\n` +
                        `    }\n` +
                        `}`
                      );
                    } else {
                      setScriptText(
                        `// NovaSim Core Event Handler Script\n` +
                        `// Triggered on every simulation solver tick\n\n` +
                        `const latheNode = sim.getNode("prc_01");\n` +
                        `const queueNode = sim.getNode("que_01");\n\n` +
                        `if (queueNode && queueNode.properties.capacity < 10) {\n` +
                        `  queueNode.properties.capacity = 20;\n` +
                        `  sim.log("AI Scripting: Expanded Buffer Capacity to 20 units.");\n` +
                        `}\n\n` +
                        `if (latheNode) {\n` +
                        `  latheNode.properties.processingTime = Math.max(2, 5 + Math.sin(sim.time) * 3);\n` +
                        `}`
                      );
                    }
                  }}
                  className="bg-slate-950 text-slate-300 font-mono text-[10px] border border-slate-800 rounded px-2 py-1 focus:outline-none focus:border-indigo-500"
                >
                  <option value="javascript">JavaScript Script (.js)</option>
                  <option value="python">Python Script (.py)</option>
                  <option value="csharp">C# Custom Script (.cs)</option>
                </select>
              </div>

              {/* IDE Control Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleRunScript}
                  className="p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  title="Inject script into current execution loop"
                >
                  <Play className="w-3 h-3" /> RUN
                </button>
                <button
                  onClick={handleStartDebugging}
                  disabled={isDebugging}
                  className="p-1.5 bg-slate-950 hover:bg-slate-900 disabled:opacity-50 text-indigo-400 border border-slate-800 rounded text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer"
                  title="Pause solver and trigger variable stepping debug"
                >
                  <Bug className="w-3 h-3 text-indigo-400" /> DEBUG
                </button>
                {isDebugging && (
                  <>
                    <button
                      onClick={handleStepDebug}
                      className="p-1.5 bg-amber-600/20 hover:bg-amber-600 text-amber-400 hover:text-white border border-amber-900/50 rounded text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer"
                      title="Step line"
                    >
                      <ChevronRight className="w-3 h-3" /> STEP
                    </button>
                    <button
                      onClick={handleStopDebugging}
                      className="p-1.5 bg-red-950/40 hover:bg-red-900 text-red-400 hover:text-white border border-red-900/40 rounded text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer"
                      title="Stop debugger"
                    >
                      <RotateCcw className="w-3 h-3" /> STOP
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* CODE WORKSPACE SPLIT */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 flex-1 min-h-[220px]">
              {/* Left 2 columns: Text editor and breakpoints */}
              <div className="md:col-span-2 bg-slate-950 border border-slate-850 rounded-lg relative font-mono text-[10.5px] p-2 flex flex-col h-full overflow-hidden">
                <div className="flex-1 flex overflow-auto">
                  {/* Line numbers and breakpoints column */}
                  <div className="w-7 text-right text-slate-600 select-none pr-2 border-r border-slate-900 flex flex-col gap-0.5">
                    {Array.from({ length: 15 }).map((_, i) => {
                      const lineNum = i + 1;
                      const hasBreakpoint = breakpoints.includes(lineNum);
                      const isCurrentLine = currentDebugLine === lineNum;
                      return (
                        <div key={i} className="flex items-center justify-end gap-1 h-[16px] relative">
                          <button
                            onClick={() => handleToggleBreakpoint(lineNum)}
                            className={`w-2 h-2 rounded-full flex-shrink-0 cursor-pointer ${
                              hasBreakpoint ? "bg-red-500 animate-pulse" : "bg-transparent hover:bg-red-900/30"
                            }`}
                            title="Toggle line breakpoint"
                          />
                          <span className={isCurrentLine ? "text-indigo-400 font-bold" : "text-slate-600"}>
                            {lineNum}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Script contents input with dynamic highlight preview overlay */}
                  <div className="flex-1 pl-3.5 relative min-h-[240px]">
                    <textarea
                      value={scriptText}
                      onChange={e => {
                        setScriptText(e.target.value);
                        // Trigger autocompletion if typing '.'
                        if (e.target.value.endsWith(".")) {
                          setAutocompleteOpen(true);
                        }
                      }}
                      className="absolute inset-0 w-full h-full bg-transparent text-slate-300 font-mono text-[10.5px] border-none outline-none focus:ring-0 resize-none z-10 p-0 m-0 leading-[16.5px]"
                    />
                    {/* Simulated Highlight Underlay */}
                    <pre className="absolute inset-0 pointer-events-none text-slate-500 z-0 p-0 m-0 overflow-hidden leading-[16.5px] select-none opacity-40">
                      {scriptText}
                    </pre>

                    {/* INTELLISENSE AUTOCOMPLETE CONTAINER */}
                    {autocompleteOpen && (
                      <div
                        ref={autocompleteRef}
                        className="absolute left-10 top-16 bg-slate-900 border border-indigo-900 shadow-2xl rounded-lg w-56 z-50 text-[10px]"
                      >
                        <div className="p-1 border-b border-indigo-950 font-bold bg-slate-950 text-indigo-400 flex items-center justify-between">
                          <span>IntelliSense Suggestions</span>
                          <span className="text-[7px] text-slate-500 uppercase font-bold">Autocompleting</span>
                        </div>
                        <div className="max-h-36 overflow-y-auto">
                          {autocompleteSuggestions.map((item, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleAddAutocomplete(item.name)}
                              className="w-full text-left p-1.5 hover:bg-indigo-600 hover:text-white transition-colors border-b border-slate-900/50 flex flex-col gap-0.5 font-mono cursor-pointer"
                            >
                              <span className="font-bold text-slate-200 text-[10.5px]">{item.name}</span>
                              <span className="text-[8px] text-slate-500 hover:text-indigo-200">{item.desc}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Helper overlay */}
                <button
                  onClick={() => setAutocompleteOpen(!autocompleteOpen)}
                  className="absolute bottom-2 right-2 p-1 bg-slate-900 hover:bg-slate-850 text-slate-400 rounded text-[8px] font-mono uppercase font-bold border border-slate-800 cursor-pointer flex items-center gap-1 z-20"
                >
                  <Eye className="w-3 h-3 text-indigo-400" /> Show Auto-complete
                </button>
              </div>

              {/* Right column: Debug variable inspector */}
              <div className="bg-slate-950 border border-slate-850 rounded-lg p-2.5 font-mono text-[10px] flex flex-col h-full overflow-hidden">
                <div className="flex items-center gap-1.5 border-b border-slate-900 pb-1.5 mb-2">
                  <Bug className="w-3.5 h-3.5 text-amber-500" />
                  <span className="font-bold text-slate-400 uppercase tracking-wider">VARIABLE INSPECTOR</span>
                </div>
                <div className="flex-1 overflow-y-auto space-y-1.5">
                  {liveVariables.map((variable, idx) => (
                    <div key={idx} className="flex items-center justify-between py-1 border-b border-slate-900/40">
                      <span className="text-slate-400 font-medium">{variable.name}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 text-[8px] uppercase">{variable.type}</span>
                        <input
                          type="text"
                          value={variable.value}
                          onChange={(e) => {
                            const val = e.target.value;
                            setLiveVariables(prev =>
                              prev.map((v, i) => (i === idx ? { ...v, value: val } : v))
                            );
                          }}
                          className="w-16 bg-slate-900/90 border border-slate-800 text-right px-1 py-0.5 rounded text-indigo-400 text-[10px]"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* LIVE CONSOLE */}
            <div className="bg-slate-950 border border-slate-850 rounded-lg p-3 flex flex-col h-[110px] overflow-hidden shrink-0">
              <div className="flex items-center justify-between border-b border-slate-900 pb-1.5 mb-1.5">
                <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Terminal className="w-3 h-3 text-indigo-400" /> Live Exec Console
                </span>
                <button
                  onClick={() => setScriptConsoleLogs([])}
                  className="text-[8px] font-mono text-slate-500 hover:text-slate-300"
                >
                  Clear Console
                </button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-1 font-mono text-[9px] text-slate-300 scrollbar-thin">
                {scriptConsoleLogs.map((log, idx) => (
                  <div key={idx} className="leading-normal flex gap-1">
                    <span className="text-slate-600 font-bold select-none">&gt;&gt;</span>
                    <span className={log.includes("[DEBUG]") ? "text-amber-400" : log.includes("Error") ? "text-red-400" : "text-slate-300"}>
                      {log}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: AUTOMATION PLATFORM */}
        {activeTab === "automation" && (
          <div className="flex-1 flex flex-col gap-3.5 overflow-y-auto pr-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1">
              {/* Event triggers list */}
              <div className="bg-slate-950 border border-slate-850 p-3 rounded-lg flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-[10px] font-mono font-bold text-slate-300 uppercase tracking-wider">
                      Event-Based triggers
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      const newId = `tr_${Date.now()}`;
                      setTriggers(prev => [...prev, { id: newId, event: "Custom API Event", action: "Run Trigger Script", active: true }]);
                    }}
                    className="p-1 hover:bg-slate-900 text-indigo-400 rounded cursor-pointer"
                    title="Add dynamic script trigger hook"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex-1 space-y-2 max-h-[160px] overflow-y-auto">
                  {triggers.map(trigger => (
                    <div key={trigger.id} className="bg-slate-900/55 p-2 rounded border border-slate-850 flex items-center justify-between text-[10px] font-mono">
                      <div className="flex flex-col">
                        <span className="text-slate-200 font-bold">{trigger.event}</span>
                        <span className="text-[8.5px] text-slate-500 italic mt-0.5">Exec: {trigger.action}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setTriggers(prev => prev.map(t => t.id === trigger.id ? { ...t, active: !t.active } : t));
                            addLog(`Automation Trigger '${trigger.event}' toggled.`);
                          }}
                          className={`px-1.5 py-0.5 rounded text-[8px] font-bold cursor-pointer transition-colors ${
                            trigger.active ? "bg-emerald-600/20 text-emerald-400" : "bg-slate-950 text-slate-600"
                          }`}
                        >
                          {trigger.active ? "ON" : "OFF"}
                        </button>
                        <button
                          onClick={() => setTriggers(prev => prev.filter(t => t.id !== trigger.id))}
                          className="p-1 hover:bg-slate-800 text-slate-500 hover:text-red-400 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Scheduled tasks */}
                <div className="flex items-center justify-between border-b border-slate-900 pb-2 mt-2">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-[10px] font-mono font-bold text-slate-300 uppercase tracking-wider">
                      Scheduled cron tasks
                    </span>
                  </div>
                </div>
                <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
                  {scheduledTasks.map(task => (
                    <div key={task.id} className="bg-slate-900/55 p-2 rounded border border-slate-850 flex items-center justify-between text-[10px] font-mono">
                      <div className="flex flex-col">
                        <span className="text-slate-200 font-bold">{task.task}</span>
                        <span className="text-[8.5px] text-slate-500 italic mt-0.5">Cron: '{task.pattern}'</span>
                      </div>
                      <span className="text-[8px] text-slate-600">Last: {task.lastRun}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Macro recorder */}
              <div className="bg-slate-950 border border-slate-850 p-3 rounded-lg flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-900 pb-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="text-[10px] font-mono font-bold text-slate-300 uppercase tracking-wider">
                        Workflow Macro Recorder
                      </span>
                    </div>
                    {isRecordingMacro ? (
                      <div className="flex items-center gap-1 text-red-500 animate-pulse text-[9px] font-mono font-bold">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        RECORDING
                      </div>
                    ) : (
                      <span className="text-[8px] font-mono text-slate-600">IDLE</span>
                    )}
                  </div>
                  <p className="text-[9px] text-slate-400 font-sans leading-relaxed mb-3">
                    Record structural mouse actions, node movements, or property adjustments to run as a single playback macro or execute batch optimizations.
                  </p>

                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-850 min-h-[140px] max-h-[180px] overflow-y-auto font-mono text-[9px] space-y-1 text-slate-300">
                    {macroSteps.map((step, idx) => (
                      <div key={idx} className="flex gap-2">
                        <span className="text-slate-600">[{idx + 1}]</span>
                        <span>{step}</span>
                      </div>
                    ))}
                    {macroSteps.length === 0 && (
                      <div className="text-slate-600 text-center italic py-10">No macro actions recorded. Click RECORD below to begin.</div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-4">
                  <button
                    onClick={() => {
                      setIsRecordingMacro(!isRecordingMacro);
                      if (!isRecordingMacro) {
                        setMacroSteps([]);
                        addLog("Macro recording started.");
                      } else {
                        addLog("Macro recording compiled and stored.");
                      }
                    }}
                    className={`flex-1 py-1.5 rounded text-[10px] font-mono font-bold uppercase cursor-pointer transition-colors flex items-center justify-center gap-1.5 ${
                      isRecordingMacro ? "bg-red-600 text-white" : "bg-indigo-600 hover:bg-indigo-500 text-white"
                    }`}
                  >
                    {isRecordingMacro ? "STOP RECORDING" : "RECORD MACRO"}
                  </button>
                  {macroSteps.length > 0 && !isRecordingMacro && (
                    <button
                      onClick={() => {
                        addLog("Simulated playback of compiled macro sequence.");
                        setScriptConsoleLogs(prev => [
                          ...prev,
                          `[Macro] Initiating playback of ${macroSteps.length}-step macro...`,
                          ...macroSteps.map(step => `[Macro EXEC] Played: "${step}"`),
                          `[Macro] Playback completed successfully.`
                        ]);
                        setActiveTab("scripting");
                      }}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded border border-slate-800 text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Play className="w-3 h-3" /> PLAYBACK
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: FORMULA & EXPRESSIONS */}
        {activeTab === "expressions" && (
          <div className="flex-1 flex flex-col gap-3.5 overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Formula Editor input block */}
              <div className="md:col-span-2 bg-slate-950 border border-slate-850 p-4 rounded-lg flex flex-col gap-3">
                <div className="flex items-center gap-1.5 border-b border-slate-900 pb-2.5">
                  <Radio className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-[10px] font-mono font-bold text-slate-300 uppercase tracking-wider">
                    Dynamic Property formula editor
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-mono text-slate-500 uppercase">BIND TO GRAPH ATTRIBUTE</label>
                  <select
                    value={formulaTarget}
                    onChange={e => setFormulaTarget(e.target.value)}
                    className="bg-slate-900 text-slate-300 font-mono text-[10px] border border-slate-800 rounded px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="prc_01.processingTime">CNC Milling Station (prc_01) Processing Time</option>
                    <option value="src_01.arrivalInterval">Material Arrivals (src_01) Arrival Interval</option>
                    <option value="que_01.capacity">Assembly Buffer (que_01) Max Capacity</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5 mt-2">
                  <label className="text-[9px] font-mono text-slate-500 uppercase">MATHEMATICAL FORMULA EXPRESSION</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formulaValue}
                      onChange={e => {
                        setFormulaValue(e.target.value);
                        setFormulaError(null);
                      }}
                      placeholder="e.g. math.sin(time) * 4 + 8"
                      className="flex-1 bg-slate-900 text-slate-200 font-mono text-xs border border-slate-800 rounded px-3 py-2 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      onClick={() => {
                        try {
                          // Simple client side parse validation
                          if (formulaValue.includes("(") && !formulaValue.includes(")")) {
                            throw new Error("Mismatched parentheses or brackets");
                          }
                          setFormulaError(null);
                          addLog(`Formula Bind: Bound '${formulaTarget}' to evaluation script: '${formulaValue}'`);
                          setScriptConsoleLogs(prev => [
                            ...prev,
                            `[INFO] Bound formula '${formulaValue}' successfully to '${formulaTarget}'`
                          ]);
                        } catch (err: any) {
                          setFormulaError(err.message || "Expression compilation syntax error");
                        }
                      }}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-mono font-bold text-xs cursor-pointer transition-colors"
                    >
                      BIND
                    </button>
                  </div>
                  {formulaError ? (
                    <span className="text-[9px] font-mono text-red-400 mt-1">Error: {formulaError}</span>
                  ) : (
                    <span className="text-[9px] font-mono text-emerald-400 mt-1">✔ Expression compiled safely. Executing on tick loop.</span>
                  )}
                </div>

                {/* Example formulas */}
                <div className="mt-3">
                  <span className="text-[8.5px] font-mono text-slate-600 uppercase font-semibold">Suggested Formula templates</span>
                  <div className="grid grid-cols-2 gap-2 mt-1.5">
                    <button
                      onClick={() => setFormulaValue("math.sin(time) * 3 + 6")}
                      className="text-left bg-slate-900 hover:bg-slate-850 p-2 border border-slate-850 rounded text-[9px] font-mono text-slate-400 hover:text-white cursor-pointer"
                    >
                      Sine Workload Modulation
                    </button>
                    <button
                      onClick={() => setFormulaValue("random.exponential(12)")}
                      className="text-left bg-slate-900 hover:bg-slate-850 p-2 border border-slate-850 rounded text-[9px] font-mono text-slate-400 hover:text-white cursor-pointer"
                    >
                      Poisson Arrival Spacing
                    </button>
                    <button
                      onClick={() => setFormulaValue("time > 120 ? 2 : 12")}
                      className="text-left bg-slate-900 hover:bg-slate-850 p-2 border border-slate-850 rounded text-[9px] font-mono text-slate-400 hover:text-white cursor-pointer"
                    >
                      Peak-Demand Shift Threshold
                    </button>
                    <button
                      onClick={() => setFormulaValue("random.normal(8, 1.5)")}
                      className="text-left bg-slate-900 hover:bg-slate-850 p-2 border border-slate-850 rounded text-[9px] font-mono text-slate-400 hover:text-white cursor-pointer"
                    >
                      Gaussian Machine Standard
                    </button>
                  </div>
                </div>
              </div>

              {/* Math documentation reference sidebar */}
              <div className="bg-slate-950 border border-slate-850 p-3.5 rounded-lg flex flex-col font-mono text-[9px]">
                <span className="font-bold text-slate-300 uppercase tracking-wider mb-2 pb-1.5 border-b border-slate-900 flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-400" /> Math & distributions API
                </span>

                <div className="flex-1 overflow-y-auto space-y-3 scrollbar-none max-h-[290px]">
                  <div>
                    <span className="font-bold text-indigo-400 text-[10px]">math.sin(time)</span>
                    <p className="text-slate-500 mt-0.5">Smooth sinusoidal fluctuation between -1 and +1. Great for dynamic shift scaling.</p>
                  </div>
                  <div>
                    <span className="font-bold text-indigo-400 text-[10px]">math.floor(val)</span>
                    <p className="text-slate-500 mt-0.5">Round value down to nearest integer.</p>
                  </div>
                  <div>
                    <span className="font-bold text-indigo-400 text-[10px]">random.exponential(rate)</span>
                    <p className="text-slate-500 mt-0.5">Standard exponential spacing. Best for arrival events.</p>
                  </div>
                  <div>
                    <span className="font-bold text-indigo-400 text-[10px]">random.normal(mean, std)</span>
                    <p className="text-slate-500 mt-0.5">Normal Gaussian distribution. Ideal for mechanical processing cycle ranges.</p>
                  </div>
                  <div>
                    <span className="font-bold text-indigo-400 text-[10px]">random.uniform(min, max)</span>
                    <p className="text-slate-500 mt-0.5">Uniform distribution between a lower and upper range limit.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: DEVELOPER PORTAL / EXTENSIONS */}
        {activeTab === "sdk" && (
          <div className="flex-1 flex flex-col gap-3.5 overflow-hidden">
            <div className="flex gap-2 border-b border-slate-900 pb-2 flex-shrink-0">
              <button
                onClick={() => { setSelectedSdkApi("rest"); setApiResponse(null); }}
                className={`px-3 py-1 text-[9px] font-mono font-bold rounded transition-colors cursor-pointer ${
                  selectedSdkApi === "rest" ? "bg-indigo-600/25 border border-indigo-600 text-indigo-400" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                REST API INTERACTIVE CLIENT
              </button>
              <button
                onClick={() => { setSelectedSdkApi("ws"); setApiResponse(null); }}
                className={`px-3 py-1 text-[9px] font-mono font-bold rounded transition-colors cursor-pointer ${
                  selectedSdkApi === "ws" ? "bg-indigo-600/25 border border-indigo-600 text-indigo-400" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                WEBSOCKETS (WS) SUITE
              </button>
              <button
                onClick={() => { setSelectedSdkApi("plugin"); setApiResponse(null); }}
                className={`px-3 py-1 text-[9px] font-mono font-bold rounded transition-colors cursor-pointer ${
                  selectedSdkApi === "plugin" ? "bg-indigo-600/25 border border-indigo-600 text-indigo-400" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                CUSTOM OBJECT SDK
              </button>
            </div>

            {/* SDK SPLIT SCREEN */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1 overflow-hidden">
              {/* Left Column: API Route description */}
              <div className="md:col-span-1 bg-slate-950 border border-slate-850 p-3 rounded-lg overflow-y-auto max-h-[310px] font-mono text-[9.5px]">
                {selectedSdkApi === "rest" && (
                  <div className="space-y-4">
                    <span className="font-bold text-slate-300 uppercase tracking-wider block border-b border-slate-900 pb-1">REST ROUTE REFERENCE</span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 bg-emerald-600/10 text-emerald-400 font-bold rounded">GET</span>
                        <span className="text-slate-200">/api/projects</span>
                      </div>
                      <p className="text-slate-500 mt-1 leading-normal">Returns a list of all active workspace projects and layouts.</p>
                      <button
                        onClick={() => handleSendSampleRequest("/api/projects", "GET")}
                        className="mt-2 text-[8px] bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-2 py-1 rounded cursor-pointer"
                      >
                        TEST ENDPOINT LIVE
                      </button>
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 bg-emerald-600/10 text-emerald-400 font-bold rounded">GET</span>
                        <span className="text-slate-200">/api/projects/:id</span>
                      </div>
                      <p className="text-slate-500 mt-1 leading-normal">Retrieves full metadata schema coordinates for active workspace.</p>
                      <button
                        onClick={() => handleSendSampleRequest("/api/projects/:id", "GET")}
                        className="mt-2 text-[8px] bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-2 py-1 rounded cursor-pointer"
                      >
                        TEST ENDPOINT LIVE
                      </button>
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 bg-indigo-600/10 text-indigo-400 font-bold rounded">GET</span>
                        <span className="text-slate-200">/api/analytics/export</span>
                      </div>
                      <p className="text-slate-500 mt-1 leading-normal">Exports full solver throughput, cycle counters, and node load balances to JSON.</p>
                      <button
                        onClick={() => handleSendSampleRequest("/api/analytics/export", "GET")}
                        className="mt-2 text-[8px] bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-2 py-1 rounded cursor-pointer"
                      >
                        TEST ENDPOINT LIVE
                      </button>
                    </div>
                  </div>
                )}

                {selectedSdkApi === "ws" && (
                  <div className="space-y-4">
                    <span className="font-bold text-slate-300 uppercase tracking-wider block border-b border-slate-900 pb-1">WEBSOCKET INTEROP</span>
                    <p className="text-slate-400 leading-normal">
                      The core solver connects directly to high-throughput systems using local WebSockets under route:
                    </p>
                    <div className="bg-slate-900 p-2 border border-slate-850 rounded text-slate-200 font-bold break-all">
                      ws://localhost:3000/ws
                    </div>

                    <div className="space-y-3 mt-3">
                      <div>
                        <span className="text-indigo-400 font-bold">Client Frames:</span>
                        <ul className="list-disc list-inside text-slate-500 mt-1 space-y-1">
                          <li><code>sync_layout</code>: uploads node layout</li>
                          <li><code>sim_start</code>: runs active session</li>
                          <li><code>sim_pause</code>: halts clock cycles</li>
                          <li><code>sim_step</code>: ticks a single event</li>
                        </ul>
                      </div>
                      <div>
                        <span className="text-indigo-400 font-bold">Server Frames:</span>
                        <ul className="list-disc list-inside text-slate-500 mt-1 space-y-1">
                          <li><code>sim_tick</code>: pushes metrics data</li>
                          <li><code>sim_state_changed</code>: states updates</li>
                          <li><code>sim_error</code>: reports WASM stack issues</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {selectedSdkApi === "plugin" && (
                  <div className="space-y-4">
                    <span className="font-bold text-slate-300 uppercase tracking-wider block border-b border-slate-900 pb-1">CUSTOM OBJECT SDK</span>
                    <p className="text-slate-400 leading-normal">
                      Developers can register custom simulation components by specifying standard JSON schema contracts with coordinate templates:
                    </p>
                    <div className="bg-slate-900 p-2.5 rounded border border-slate-850 text-[9px] text-indigo-300 whitespace-pre-wrap font-mono max-h-[140px] overflow-auto">
                      {`{\n  "custom_type": "agv_laser",\n  "name": "Custom Laser Transporter",\n  "properties": {\n    "wavelength": 1055,\n    "laserPower": 1500,\n    "color": "#a855f7"\n  }\n}`}
                    </div>
                    <button
                      onClick={() => {
                        addLog("Custom Object registered through Plugin SDK: 'agv_laser'");
                        setScriptConsoleLogs(prev => [...prev, "[SDK] Registered Custom Object Schema: 'agv_laser' loaded into catalog successfully."]);
                      }}
                      className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded cursor-pointer text-center text-[9px]"
                    >
                      REGISTER CUSTOM OBJECT 'AGV_LASER'
                    </button>
                  </div>
                )}
              </div>

              {/* Right Columns: Output/Preview area */}
              <div className="md:col-span-2 bg-slate-950 border border-slate-850 p-3 rounded-lg flex flex-col h-full overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-900 pb-2 mb-2">
                  <span className="font-bold text-slate-400 text-[10px] uppercase tracking-wider">LIVE INTERACTION CLIENT OUTPUT</span>
                  <span className="text-[8px] bg-indigo-950 text-indigo-400 border border-indigo-900/50 px-1.5 py-0.5 rounded font-mono uppercase font-bold">ACTIVE CONNECTION</span>
                </div>

                <div className="flex-1 bg-slate-900 rounded border border-slate-850 p-2.5 overflow-auto font-mono text-[9px] text-slate-300 max-h-[220px]">
                  {isLoadingApi ? (
                    <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-500 py-10">
                      <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      <span>Fetching dynamic payload response...</span>
                    </div>
                  ) : apiResponse ? (
                    <pre className="whitespace-pre-wrap">{apiResponse}</pre>
                  ) : selectedSdkApi === "ws" ? (
                    <div className="space-y-1 select-text text-slate-400">
                      <div>[CONNECTION] Socket connected to ws://localhost:3000/ws</div>
                      <div>[SENT] {`{"type": "sync_layout", "layout": {"nodes": ..., "connections": ...}}`}</div>
                      <div>[RECEIVED] {`{"type": "sim_state_changed", "state": "Created"}`}</div>
                      <div>[RECEIVED] {`{"type": "sim_tick", "summary": {"clockTime": ${clockTime.toFixed(2)}, "entityCounts": ...}}`}</div>
                      <div className="text-slate-600 italic mt-2 animate-pulse font-bold">&gt;&gt; Listening to live socket frame packets...</div>
                    </div>
                  ) : (
                    <div className="text-slate-500 text-center py-12 italic">
                      Click "TEST ENDPOINT LIVE" or "REGISTER CUSTOM OBJECT" to capture dynamic platform responses.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
