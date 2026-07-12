import React, { useState, useRef, useEffect } from "react";
import {
  MessageSquare,
  Sparkles,
  Send,
  RefreshCw,
  HelpCircle,
  Activity,
  FileText,
  CheckSquare,
  LayoutTemplate,
  Lightbulb,
  FileSpreadsheet,
  PlayCircle,
  X,
  Clipboard,
  AlertTriangle,
  User,
  Cpu
} from "lucide-react";
import { SimulationLayout } from "../../core/simulation/types";

interface CopilotPanelProps {
  currentLayout: SimulationLayout;
  onDeployLayout: (layout: SimulationLayout) => void;
}

export default function CopilotPanel({ currentLayout, onDeployLayout }: CopilotPanelProps) {
  const [copilotTab, setCopilotTab] = useState<"compiler" | "audits" | "assistant">("compiler");
  
  // --- COMPILER STATES ---
  const [prompt, setPrompt] = useState("");
  const [isLoadingCompiler, setIsLoadingCompiler] = useState(false);
  const [compilerError, setCompilerError] = useState<string | null>(null);
  const [compilerExplanation, setCompilerExplanation] = useState<string | null>(null);

  // --- OPERATIONS AUDITS STATES ---
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [activeAuditType, setActiveAuditType] = useState<string | null>(null);
  const [auditResponseText, setAuditResponseText] = useState<string | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);

  // --- INTERACTIVE CHAT ASSISTANT STATES ---
  const [chatMessage, setChatMessage] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<Array<{ role: "user" | "model"; content: string }>>([
    {
      role: "model",
      content: "Hello! I am your NovaSim Simulation Assistant. I can help you debug WASM solver configurations, write custom python/JS scripts, design dynamic formulas, or validate layout throughput limits. How can I assist you today?"
    }
  ]);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const samplePrompts = [
    "Reset layout and build a classic 3-stage assembly line (lathe, milling, laser)",
    "Add a high-speed inspection router with 80% passing rate to laser cutter",
    "Double the capacity of all buffer queues and make arrival intervals 5s"
  ];

  // Submit natural language compiler prompt to create models from text
  const handleCompilerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsLoadingCompiler(true);
    setCompilerError(null);
    setCompilerExplanation(null);

    try {
      const response = await fetch("/api/ai-configure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt,
          currentLayout: currentLayout
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to compile layout via AI.");
      }

      if (data.layout && Array.isArray(data.layout.nodes)) {
        onDeployLayout(data.layout);
        setCompilerExplanation(data.explanation || "Layout successfully compiled by AI.");
        setPrompt("");
      } else {
        throw new Error("AI returned an invalid layout payload schema.");
      }
    } catch (err: any) {
      console.error(err);
      setCompilerError(err.message || "An unexpected compile error occurred.");
    } finally {
      setIsLoadingCompiler(false);
    }
  };

  // Run Operations Command (Explain, Bottleneck, Optimize, Validate, Dashboard, Report)
  const handleAuditCommand = async (type: "explain" | "bottlenecks" | "optimize" | "validate" | "dashboard" | "report") => {
    setIsLoadingAudit(true);
    setActiveAuditType(type);
    setAuditResponseText(null);
    setAuditError(null);

    try {
      const endpoint = `/api/ai/${type}`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout: currentLayout })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to perform ${type} command.`);
      }

      setAuditResponseText(data.text || "No analysis details generated.");
    } catch (err: any) {
      console.error(err);
      setAuditError(err.message || "Network error during AI audit execution.");
    } finally {
      setIsLoadingAudit(false);
    }
  };

  // Submit message to the CTO Copilot Chat API
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;

    const userMsg = chatMessage.trim();
    setChatMessage("");
    setChatHistory(prev => [...prev, { role: "user", content: userMsg }]);
    setIsChatLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg,
          history: chatHistory.map(h => ({ role: h.role, content: h.content }))
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch AI reply.");
      }

      setChatHistory(prev => [...prev, { role: "model", content: data.text }]);
    } catch (err: any) {
      console.error(err);
      setChatHistory(prev => [
        ...prev,
        { role: "model", content: `❌ Error: ${err.message || "Failed to connect to AI server."}` }
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="bg-slate-900/60 border border-slate-900 rounded-xl p-4 w-full flex flex-col gap-4">
      {/* Header with active models */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
          <h3 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider">
            NovaSim AI Workspace
          </h3>
        </div>
        <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-850">
          <button
            onClick={() => setCopilotTab("compiler")}
            className={`px-2 py-1 text-[8.5px] font-mono font-bold rounded uppercase transition-colors cursor-pointer ${
              copilotTab === "compiler" ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            Canvas Compiler
          </button>
          <button
            onClick={() => setCopilotTab("audits")}
            className={`px-2 py-1 text-[8.5px] font-mono font-bold rounded uppercase transition-colors cursor-pointer ${
              copilotTab === "audits" ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            Operations Copilot
          </button>
          <button
            onClick={() => setCopilotTab("assistant")}
            className={`px-2 py-1 text-[8.5px] font-mono font-bold rounded uppercase transition-colors cursor-pointer ${
              copilotTab === "assistant" ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            Chat Assistant
          </button>
        </div>
      </div>

      {/* COMPILER TAB */}
      {copilotTab === "compiler" && (
        <div className="flex flex-col gap-3.5">
          <p className="text-[10px] text-slate-400 font-sans leading-relaxed">
            Configure or scale your simulation layout instantly by describing your physical requirements in plain English:
          </p>

          <form onSubmit={handleCompilerSubmit} className="flex gap-2">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., 'Reset layout and build a 4-stage chemical packaging pipeline'"
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
              disabled={isLoadingCompiler}
            />
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white px-4 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
              disabled={isLoadingCompiler}
            >
              {isLoadingCompiler ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>COMPILE</span>
                </>
              )}
            </button>
          </form>

          {compilerExplanation && (
            <div className="bg-emerald-950/20 border border-emerald-900/40 text-emerald-400 text-[10px] font-mono p-3 rounded-lg flex gap-2 animate-fadeIn">
              <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-emerald-300" />
              <div>
                <b className="font-bold text-emerald-300">Model Compiled Successfully:</b> {compilerExplanation}
              </div>
            </div>
          )}

          {compilerError && (
            <div className="bg-red-950/20 border border-red-950 text-red-400 text-[10px] font-mono p-3 rounded-lg">
              <b className="font-bold">Compiler Failure:</b> {compilerError}
            </div>
          )}

          {/* Prompt Suggestions */}
          <div>
            <div className="text-[8px] font-mono text-slate-500 uppercase font-semibold tracking-wider mb-2 flex items-center gap-1">
              <HelpCircle className="w-3 h-3 text-slate-600" />
              SIMULATION BLUEPRINT PROMPTS
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {samplePrompts.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => setPrompt(p)}
                  className="text-left text-[9px] font-mono text-slate-400 hover:text-slate-200 hover:border-slate-700 bg-slate-950/50 hover:bg-slate-950 border border-slate-900 p-2.5 rounded-lg transition-all cursor-pointer leading-normal"
                >
                  "{p}"
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* OPERATIONS COPILOT TAB */}
      {copilotTab === "audits" && (
        <div className="flex flex-col gap-3.5">
          <p className="text-[10px] text-slate-400 font-sans leading-relaxed">
            Run complete operational diagnostics, flow audits, bottleneck tracking, or boardroom report compilations using the Gemini analyzer core:
          </p>

          {/* Quick command buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <button
              onClick={() => handleAuditCommand("explain")}
              className="p-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-850 rounded-lg flex flex-col items-center justify-center gap-1.5 text-center transition-all cursor-pointer hover:border-indigo-500"
            >
              <LayoutTemplate className="w-4 h-4 text-emerald-400" />
              <span className="text-[9px] font-mono font-bold text-slate-300 uppercase">Explain Model</span>
            </button>
            <button
              onClick={() => handleAuditCommand("bottlenecks")}
              className="p-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-850 rounded-lg flex flex-col items-center justify-center gap-1.5 text-center transition-all cursor-pointer hover:border-indigo-500"
            >
              <Activity className="w-4 h-4 text-red-400" />
              <span className="text-[9px] font-mono font-bold text-slate-300 uppercase">Track Bottlenecks</span>
            </button>
            <button
              onClick={() => handleAuditCommand("optimize")}
              className="p-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-850 rounded-lg flex flex-col items-center justify-center gap-1.5 text-center transition-all cursor-pointer hover:border-indigo-500"
            >
              <Lightbulb className="w-4 h-4 text-amber-400" />
              <span className="text-[9px] font-mono font-bold text-slate-300 uppercase">Suggest Optimizations</span>
            </button>
            <button
              onClick={() => handleAuditCommand("validate")}
              className="p-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-850 rounded-lg flex flex-col items-center justify-center gap-1.5 text-center transition-all cursor-pointer hover:border-indigo-500"
            >
              <CheckSquare className="w-4 h-4 text-indigo-400" />
              <span className="text-[9px] font-mono font-bold text-slate-300 uppercase">Validate Graph</span>
            </button>
            <button
              onClick={() => handleAuditCommand("dashboard")}
              className="p-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-850 rounded-lg flex flex-col items-center justify-center gap-1.5 text-center transition-all cursor-pointer hover:border-indigo-500"
            >
              <FileSpreadsheet className="w-4 h-4 text-purple-400" />
              <span className="text-[9px] font-mono font-bold text-slate-300 uppercase">Auto Dashboard</span>
            </button>
            <button
              onClick={() => handleAuditCommand("report")}
              className="p-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-850 rounded-lg flex flex-col items-center justify-center gap-1.5 text-center transition-all cursor-pointer hover:border-indigo-500"
            >
              <FileText className="w-4 h-4 text-blue-400" />
              <span className="text-[9px] font-mono font-bold text-slate-300 uppercase">Compile Report</span>
            </button>
          </div>

          {/* Output block */}
          {isLoadingAudit && (
            <div className="bg-slate-950 border border-slate-850 rounded-lg p-5 flex flex-col items-center justify-center gap-2.5">
              <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-[9px] font-mono text-slate-500 uppercase font-bold">
                Running industrial AI diagnostic solver '{activeAuditType}'...
              </span>
            </div>
          )}

          {auditResponseText && !isLoadingAudit && (
            <div className="bg-slate-950 border border-slate-850 rounded-lg p-3.5 flex flex-col gap-3 relative animate-fadeIn max-h-[300px] overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-900 pb-2 shrink-0">
                <span className="text-[9px] font-mono font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                  <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                  ANALYSIS RESULTS: {activeAuditType?.toUpperCase()}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopyText(auditResponseText)}
                    className="p-1 hover:bg-slate-900 text-slate-500 hover:text-slate-300 rounded text-[9px] font-mono uppercase font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Clipboard className="w-3.5 h-3.5" /> Copy
                  </button>
                  <button
                    onClick={() => setAuditResponseText(null)}
                    className="p-1 hover:bg-slate-900 text-slate-500 hover:text-red-400 rounded cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pr-1 text-[10px] font-mono text-slate-300 leading-relaxed whitespace-pre-wrap select-text scrollbar-thin">
                {auditResponseText}
              </div>
            </div>
          )}

          {auditError && (
            <div className="bg-red-950/20 border border-red-950 text-red-400 text-[10px] font-mono p-3 rounded-lg flex gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <div>
                <b className="font-bold">Audit Evaluation Failure:</b> {auditError}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CHAT ASSISTANT / INTERACTIVE DEBUGGER TAB */}
      {copilotTab === "assistant" && (
        <div className="flex flex-col gap-2.5 flex-1 h-[260px] overflow-hidden">
          {/* Chat scroll content */}
          <div className="flex-1 bg-slate-950/80 border border-slate-850 rounded-lg p-3 overflow-y-auto flex flex-col gap-2.5 scrollbar-thin">
            {chatHistory.map((chat, idx) => (
              <div
                key={idx}
                className={`p-2.5 rounded-lg text-[10.5px] font-sans leading-relaxed max-w-[85%] ${
                  chat.role === "user"
                    ? "bg-indigo-600 text-white self-end ml-10 rounded-br-none"
                    : "bg-slate-900 border border-slate-850 text-slate-300 self-start mr-10 rounded-bl-none font-mono"
                }`}
              >
                <div className="flex items-center gap-1 text-[8.5px] uppercase font-bold opacity-60 tracking-wider mb-1">
                  {chat.role === "user" ? (
                    <>
                      <User className="w-3 h-3 text-indigo-300" />
                      <span>Operator</span>
                    </>
                  ) : (
                    <>
                      <Cpu className="w-3 h-3 text-indigo-300 animate-pulse" />
                      <span>Simulation Assistant</span>
                    </>
                  )}
                </div>
                <div className="whitespace-pre-wrap select-text">{chat.content}</div>
              </div>
            ))}
            {isChatLoading && (
              <div className="p-2 bg-slate-900 border border-slate-850 rounded-lg text-[10px] font-mono text-slate-500 self-start animate-pulse">
                Thinking... solver consulting its topological rulesets...
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Chat input form */}
          <form onSubmit={handleChatSubmit} className="flex gap-2 shrink-0">
            <input
              type="text"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              placeholder="e.g. 'How do I write a custom Poisson interval in JavaScript scripting?'"
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-[10.5px] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              disabled={isChatLoading}
            />
            <button
              type="submit"
              disabled={isChatLoading || !chatMessage.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-850 text-white p-2.5 rounded-lg text-xs font-mono flex items-center justify-center cursor-pointer transition-all shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
