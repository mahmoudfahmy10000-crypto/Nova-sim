import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, Bot, User, Trash2, Cpu, HelpCircle, Loader2 } from "lucide-react";

interface Message {
  role: "user" | "model";
  content: string;
}

export default function ChiefArchitectChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "model",
      content: "Greetings. I am the Lead Software Architect and CTO of NovaSim AI. Ask me anything regarding our structural design, Rust/C++ cohabitation boundaries, WASM scripting performance, Vulkan zero-copy GPU pipelines, or our customized HDF5-based binary container formats."
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check if API Key is configured on load
  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => {
        setAiConfigured(!!data.aiConfigured);
      })
      .catch(() => {
        setAiConfigured(false);
      });
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput("");
    
    // Add user message to state
    const updatedMessages = [...messages, { role: "user", content: userMsg }];
    setMessages(updatedMessages as Message[]);
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMsg,
          // Limit history to last 6 turns to keep context lightweight
          history: updatedMessages.slice(-6, -1).map(msg => ({
            role: msg.role,
            content: msg.content
          }))
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setMessages(prev => [...prev, { role: "model", content: data.text }]);
      } else {
        setMessages(prev => [
          ...prev, 
          { 
            role: "model", 
            content: data.error || "The architect is currently out of the office. Ensure API configurations are active." 
          }
        ]);
      }
    } catch (err: any) {
      setMessages(prev => [
        ...prev, 
        { 
          role: "model", 
          content: "Network error occurred. The simulation thread could not establish gRPC connection." 
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handlePromptStarter = (prompt: string) => {
    setInput(prompt);
  };

  const clearChat = () => {
    setMessages([
      {
        role: "model",
        content: "Greetings. Let's start fresh. Ask me about our memory alignment strategies, WASM gas ceilings, or GPU scheduling architecture."
      }
    ]);
  };

  return (
    <div className="bg-slate-950 border border-slate-900 rounded-xl p-5 shadow-2xl flex flex-col h-[550px]">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-900 pb-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-emerald-950/40 border border-emerald-900">
            <Cpu className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100 font-mono">CTO & Lead Architect Copilot</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${aiConfigured ? "bg-emerald-500" : "bg-amber-500"}`}></span>
              <span className="text-[10px] text-slate-500 font-mono uppercase">
                {aiConfigured ? "System Online" : "Demo Mode (Configure Key)"}
              </span>
            </div>
          </div>
        </div>
        <button 
          onClick={clearChat}
          className="p-1.5 hover:bg-slate-900 text-slate-500 hover:text-rose-400 rounded transition-all"
          title="Clear Conversation"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* API Key Missing Alert */}
      {aiConfigured === false && (
        <div className="bg-amber-950/20 border border-amber-900/60 rounded-lg p-3 text-[11px] text-amber-400 mb-3 flex items-start gap-2 leading-relaxed">
          <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Interactive AI Assist Offline:</span> To unlock conversational insights on this architecture, register your <code className="text-white bg-slate-900 px-1 py-0.5 rounded">GEMINI_API_KEY</code> under the <strong className="font-semibold text-amber-200">Secrets panel</strong> in AI Studio (found in Settings).
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-slate-900 scrollbar-track-transparent">
        {messages.map((msg, index) => (
          <div 
            key={index} 
            className={`flex items-start gap-2.5 max-w-[85%] ${
              msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
            }`}
          >
            <div className={`p-1.5 rounded-md mt-0.5 ${
              msg.role === "user" 
                ? "bg-indigo-950/20 border border-indigo-900" 
                : "bg-slate-900/40 border border-slate-900"
            }`}>
              {msg.role === "user" ? (
                <User className="w-3.5 h-3.5 text-indigo-400" />
              ) : (
                <Bot className="w-3.5 h-3.5 text-emerald-400" />
              )}
            </div>
            <div className={`rounded-lg p-3 text-xs leading-relaxed ${
              msg.role === "user"
                ? "bg-indigo-950/30 text-indigo-100 border border-indigo-900/50"
                : "bg-slate-900/20 text-slate-300 border border-slate-900"
            }`}>
              <div className="whitespace-pre-wrap font-sans">{msg.content}</div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-start gap-2.5 max-w-[80%]">
            <div className="p-1.5 rounded-md bg-slate-900/40 border border-slate-900 mt-0.5">
              <Loader2 className="w-3.5 h-3.5 text-emerald-500 animate-spin" />
            </div>
            <div className="bg-slate-900/20 text-slate-500 border border-slate-900 rounded-lg p-3 text-xs font-mono">
              Chief Architect is compiling decision factors...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion Prompts */}
      {messages.length === 1 && !loading && (
        <div className="mt-2 mb-3">
          <div className="text-[10px] font-mono text-slate-600 uppercase mb-1.5 px-0.5">Architectural Inquiries:</div>
          <div className="flex flex-col gap-1.5">
            {[
              "Why did you choose C++23 over Rust for computation?",
              "Explain the zero-copy CUDA/Vulkan frame buffer mechanism.",
              "What performance benefits does the Slab Allocator yield?"
            ].map((p, idx) => (
              <button
                key={idx}
                onClick={() => handlePromptStarter(p)}
                className="text-left text-[11px] font-sans text-emerald-400 bg-slate-900/30 hover:bg-slate-900 border border-slate-900 hover:border-slate-800 rounded p-1.5 transition-all text-ellipsis overflow-hidden whitespace-nowrap"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat Form Input */}
      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about thread boundaries, WASM execution, lock-free queues..."
          className="flex-1 text-xs bg-slate-950 border border-slate-900 focus:border-indigo-500 focus:outline-none rounded-lg py-2 px-3 text-slate-200 placeholder-slate-600 font-mono transition-all"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-900 disabled:text-slate-700 text-white p-2.5 rounded-lg transition-all"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>

    </div>
  );
}
