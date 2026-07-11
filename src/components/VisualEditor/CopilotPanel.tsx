import React, { useState } from "react";
import { MessageSquare, Sparkles, Send, RefreshCw, HelpCircle } from "lucide-react";
import { SimulationLayout } from "../../core/simulation/types";

interface CopilotPanelProps {
  currentLayout: SimulationLayout;
  onDeployLayout: (layout: SimulationLayout) => void;
}

export default function CopilotPanel({ currentLayout, onDeployLayout }: CopilotPanelProps) {
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResponseMsg, setLastResponseMsg] = useState<string | null>(null);

  const handleCopilotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsLoading(true);
    setError(null);
    setLastResponseMsg(null);

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
        throw new Error(data.error || "Failed to parse layout from AI.");
      }

      if (data.layout && Array.isArray(data.layout.nodes)) {
        onDeployLayout(data.layout);
        setLastResponseMsg(data.explanation || "Layout successfully optimized by AI Copilot.");
        setPrompt("");
      } else {
        throw new Error("AI returned an invalid layout payload schema.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected network error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const samplePrompts = [
    "Reset layout and build a classic 3-stage assembly line (lathe, milling, laser)",
    "Add a high-speed inspection router with 80% passing rate to laser cutter",
    "Double the capacity of all buffer queues and make arrival intervals 5s"
  ];

  return (
    <div className="bg-slate-900/60 border border-slate-900 rounded-xl p-4 w-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
          <h3 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider">
            AI Layout Copilot
          </h3>
        </div>
        <span className="text-[8px] font-mono uppercase px-1.5 py-0.5 rounded bg-indigo-950/40 text-indigo-400 border border-indigo-900/40">
          Gemini-3.5-Flash Active
        </span>
      </div>

      <p className="text-[10px] text-slate-400 font-sans leading-relaxed">
        Instruct the compiler agent using natural language to structure, calibrate, or optimize your workflow canvas topology instantly:
      </p>

      <form onSubmit={handleCopilotSubmit} className="flex gap-2">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., 'Increase processing speed of lathe machine to 3s and paint it emerald'"
          className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
          disabled={isLoading}
        />
        <button
          type="submit"
          className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white p-2.5 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
          disabled={isLoading}
        >
          {isLoading ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">COMPILE</span>
            </>
          )}
        </button>
      </form>

      {/* Success/Explain block */}
      {lastResponseMsg && (
        <div className="bg-emerald-950/20 border border-emerald-900/40 text-emerald-400 text-[10px] font-mono p-3 rounded-lg flex gap-2">
          <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <b className="font-bold text-emerald-300">AI Deployment Succeded:</b> {lastResponseMsg}
          </div>
        </div>
      )}

      {/* Error block */}
      {error && (
        <div className="bg-red-950/20 border border-red-950 text-red-400 text-[10px] font-mono p-3 rounded-lg">
          <b className="font-bold">Compilation Error:</b> {error}
        </div>
      )}

      {/* Suggestions */}
      <div>
        <div className="text-[8px] font-mono text-slate-500 uppercase font-semibold tracking-wider mb-2 flex items-center gap-1">
          <HelpCircle className="w-3 h-3 text-slate-600" />
          Suggested instructions
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          {samplePrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => setPrompt(p)}
              className="text-left text-[9px] font-mono text-slate-500 hover:text-slate-300 hover:border-slate-700 bg-slate-950/50 hover:bg-slate-900 border border-slate-900 p-2 rounded-lg transition-all cursor-pointer flex-1"
            >
              "{p}"
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
