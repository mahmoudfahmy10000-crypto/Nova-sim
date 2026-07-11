import React, { useState, useMemo } from "react";
import { ARCHITECTURE_SECTIONS, ArchitectureSection } from "./architecture_doc";
import GraphViewer from "./components/GraphViewer";
import ResourceEstimator from "./components/ResourceEstimator";
import DbExplorer from "./components/DbExplorer";
import ClassViewer from "./components/ClassViewer";
import ChiefArchitectChat from "./components/ChiefArchitectChat";
import Phase1Console from "./components/Phase1Console";
import MainEditor from "./components/VisualEditor/MainEditor";

import {
  BookOpen,
  Cpu,
  Layers,
  Settings,
  Code,
  Database,
  FileText,
  Download,
  Search,
  Menu,
  X,
  ChevronRight,
  Info,
  ExternalLink,
  MessageSquare,
  HelpCircle,
  Clock,
  Terminal,
  Activity,
  Workflow
} from "lucide-react";

type ActiveTab = "editor" | "doc" | "pipeline" | "resource" | "database" | "classes" | "chat" | "engine";

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("editor");
  const [selectedSectionId, setSelectedSectionId] = useState<string>("vision-mission");
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Filter sections based on search query
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return ARCHITECTURE_SECTIONS;
    const query = searchQuery.toLowerCase();
    return ARCHITECTURE_SECTIONS.filter(
      (sec) =>
        sec.title.toLowerCase().includes(query) ||
        sec.shortDescription.toLowerCase().includes(query) ||
        sec.markdown.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Selected section object
  const currentSection = useMemo(() => {
    return (
      ARCHITECTURE_SECTIONS.find((s) => s.id === selectedSectionId) ||
      ARCHITECTURE_SECTIONS[0]
    );
  }, [selectedSectionId]);

  // Trigger download of the complete Markdown document
  const downloadFullDocument = () => {
    const fullMarkdown = ARCHITECTURE_SECTIONS.map((sec) => sec.markdown).join("\n\n---\n\n");
    const blob = new Blob([fullMarkdown], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "NovaSim_AI_Software_Architecture.md");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      
      {/* Top Banner / Navigation */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur sticky top-0 z-50 px-4 lg:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-500 shadow-lg shadow-indigo-500/10 shrink-0">
            <Cpu className="w-5 h-5 text-white" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-tight bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">
                NOVASIM AI
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-500">
                ARCHITECTURE
              </span>
            </div>
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mt-0.5">
              Industrial CAE Simulation Engine
            </p>
          </div>
        </div>

        {/* Desktop View Mode Tabs */}
        <nav className="hidden lg:flex items-center gap-1.5 bg-slate-900/40 border border-slate-900 p-1 rounded-lg">
          {[
            { id: "editor", label: "Visual CAD Editor", icon: <Workflow className="w-4 h-4 text-indigo-400 animate-pulse" /> },
            { id: "doc", label: "Architecture Document", icon: <FileText className="w-4 h-4" /> },
            { id: "pipeline", label: "Dependency Pipeline", icon: <Layers className="w-4 h-4" /> },
            { id: "resource", label: "Resource Estimator", icon: <Activity className="w-4 h-4" /> },
            { id: "database", label: "Database Schemas", icon: <Database className="w-4 h-4" /> },
            { id: "classes", label: "Class Registry", icon: <Code className="w-4 h-4" /> },
            { id: "chat", label: "CTO AI Copilot", icon: <MessageSquare className="w-4 h-4" /> },
            { id: "engine", label: "Phase 1 Runtime", icon: <Terminal className="w-4 h-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as ActiveTab);
                if (tab.id === "doc") setSelectedSectionId("vision-mission");
              }}
              className={`flex items-center gap-2 py-1.5 px-3 rounded-md text-xs font-medium font-mono transition-all ${
                activeTab === tab.id
                  ? "bg-slate-800 text-slate-100 border border-slate-700/50 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Global Export Options */}
        <div className="flex items-center gap-3">
          <button
            onClick={downloadFullDocument}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs py-2 px-3 rounded-lg transition-all"
            title="Download full architectural blueprint in Markdown format"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export Blueprint (.md)</span>
          </button>
          
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 text-slate-400 hover:text-slate-100 bg-slate-900 rounded-lg border border-slate-800"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Tab Overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-slate-950 border-b border-slate-900 p-4 absolute top-16 left-0 right-0 z-40 space-y-2">
          <div className="text-[10px] font-mono text-slate-600 uppercase mb-2">Workspace Plane</div>
          {[
            { id: "editor", label: "Visual CAD Editor", icon: <Workflow className="w-4 h-4 text-indigo-400" /> },
            { id: "doc", label: "Architecture Document", icon: <FileText className="w-4 h-4" /> },
            { id: "pipeline", label: "Dependency Pipeline", icon: <Layers className="w-4 h-4" /> },
            { id: "resource", label: "Resource Estimator", icon: <Activity className="w-4 h-4" /> },
            { id: "database", label: "Database Schemas", icon: <Database className="w-4 h-4" /> },
            { id: "classes", label: "Class Registry", icon: <Code className="w-4 h-4" /> },
            { id: "chat", label: "CTO AI Copilot", icon: <MessageSquare className="w-4 h-4" /> },
            { id: "engine", label: "Phase 1 Runtime", icon: <Terminal className="w-4 h-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as ActiveTab);
                setMobileMenuOpen(false);
                if (tab.id === "doc") setSelectedSectionId("vision-mission");
              }}
              className={`w-full flex items-center gap-3 py-2.5 px-3 rounded-lg text-xs font-mono border transition-all ${
                activeTab === tab.id
                  ? "bg-slate-900 border-slate-800 text-emerald-400 font-bold"
                  : "bg-transparent border-transparent text-slate-400"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Main Workspace Body */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* VIEW: Visual CAD Editor */}
        {activeTab === "editor" && (
          <MainEditor />
        )}
        
        {/* VIEW: Architecture Document (Traditional sidebar + reader layout) */}
        {activeTab === "doc" && (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden w-full">
            
            {/* Sidebar indices panel */}
            <aside className="w-full md:w-80 border-r border-slate-900 bg-slate-950/40 p-4 lg:p-6 overflow-y-auto flex flex-col justify-between">
              <div>
                <div className="mb-4">
                  <div className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-2 px-1">Search Blueprint</div>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Filter parameters..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-900/50 border border-slate-900 focus:border-indigo-500 focus:outline-none rounded-lg text-xs py-2 px-3 pl-8 text-slate-200 placeholder-slate-600 font-mono transition-all"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-600 absolute left-3.5 top-2.5" />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="text-[10px] text-slate-500 hover:text-slate-300 absolute right-3 top-2 px-1.5 py-0.5 rounded bg-slate-800"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="text-[10px] font-mono text-slate-600 uppercase tracking-wider mb-2 px-1">
                      Architectural Elements
                    </div>
                    <div className="space-y-1">
                      {filteredSections.map((sec) => (
                        <button
                          key={sec.id}
                          onClick={() => {
                            setSelectedSectionId(sec.id);
                            setActiveTab("doc");
                          }}
                          className={`w-full text-left p-2.5 rounded-lg transition-all border flex items-start gap-2.5 ${
                            selectedSectionId === sec.id
                              ? "bg-slate-900 border-slate-800 text-indigo-400 shadow-sm"
                              : "bg-transparent border-transparent hover:bg-slate-900/40 text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          <BookOpen className={`w-4 h-4 shrink-0 mt-0.5 ${selectedSectionId === sec.id ? "text-indigo-400" : "text-slate-600"}`} />
                          <div>
                            <div className="text-xs font-semibold font-mono leading-tight">{sec.title}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5 leading-normal text-ellipsis overflow-hidden line-clamp-1">{sec.shortDescription}</div>
                          </div>
                        </button>
                      ))}
                      {filteredSections.length === 0 && (
                        <div className="text-xs font-mono text-slate-600 italic p-4 text-center">
                          No matching design variables.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick status specs at bottom */}
              <div className="mt-8 border-t border-slate-900/80 pt-4 font-mono text-[10px] text-slate-600 space-y-1.5">
                <div className="flex justify-between">
                  <span>Classified level:</span>
                  <span className="text-indigo-400 font-bold">COMMERCIAL L3</span>
                </div>
                <div className="flex justify-between">
                  <span>Solver standard:</span>
                  <span className="text-slate-400">C++23 / CUDA 12.4</span>
                </div>
                <div className="flex justify-between">
                  <span>License signature:</span>
                  <span className="text-emerald-400">RSA-4096 VALID</span>
                </div>
              </div>

            </aside>

            {/* Document Reader Area */}
            <article className="flex-1 overflow-y-auto px-6 py-8 md:px-12 md:py-10 bg-slate-950/20 max-w-4xl mx-auto w-full">
              
              {/* Context Tagging */}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-indigo-950/40 text-indigo-400 border border-indigo-900/40">
                  {currentSection.category}
                </span>
                <span className="text-[10px] font-mono text-slate-600 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Checked: Jul 2026
                </span>
              </div>

              {/* Title Header */}
              <h1 className="text-2xl md:text-3xl font-bold text-slate-100 tracking-tight mb-4 flex items-center justify-between">
                {currentSection.title}
              </h1>

              {/* Quick summary alert block */}
              <div className="bg-slate-900/40 border border-slate-900 rounded-lg p-4 mb-8 text-xs text-slate-400 flex gap-3 items-start leading-relaxed">
                <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-300 font-mono">Architectural Brief:</span> {currentSection.shortDescription}
                </div>
              </div>

              {/* Sub-Interactive Embedded widgets within document to "enrich" it professionally */}
              {selectedSectionId === "tech-stack" && (
                <div className="bg-slate-900/20 border border-slate-900 rounded-lg p-4 mb-8">
                  <h4 className="text-[11px] font-mono uppercase text-slate-500 mb-3">Interactive Technology Matrix comparison</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { lang: "C++23 / CUDA", role: "HPC Core Solvers", metric: "100% Performance", color: "border-amber-900 bg-amber-950/10 text-amber-300" },
                      { lang: "Rust (Edition 2024)", role: "Orchestration & API", metric: "100% Thread Safety", color: "border-indigo-900 bg-indigo-950/10 text-indigo-300" },
                      { lang: "WebAssembly", role: "User Extension Sandbox", metric: "100% Isolated Safety", color: "border-emerald-900 bg-emerald-950/10 text-emerald-300" }
                    ].map((card, idx) => (
                      <div key={idx} className={`p-3 rounded border font-mono text-xs ${card.color}`}>
                        <div className="font-bold">{card.lang}</div>
                        <div className="text-[10px] text-slate-500 mt-1">{card.role}</div>
                        <div className="text-[10px] text-emerald-400 font-semibold mt-1.5">{card.metric}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Markdown Content Parser */}
              <div className="prose prose-invert prose-xs max-w-none prose-headings:font-mono prose-headings:font-bold prose-headings:tracking-tight prose-a:text-indigo-400 prose-code:font-mono prose-code:text-emerald-400 prose-code:bg-slate-900 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-[11px] prose-table:border prose-table:border-slate-800 text-slate-300 leading-relaxed font-sans space-y-6">
                
                {/* Visual helper to render nicely formatted HTML blocks based on markdown text */}
                {currentSection.markdown.split("\n\n").map((block, idx) => {
                  if (block.startsWith("# ")) {
                    return <h2 key={idx} className="text-xl font-bold font-mono text-slate-100 border-b border-slate-900 pb-2 pt-4">{block.replace("# ", "")}</h2>;
                  }
                  if (block.startsWith("## ")) {
                    return <h3 key={idx} className="text-lg font-bold font-mono text-indigo-300 pt-3">{block.replace("## ", "")}</h3>;
                  }
                  if (block.startsWith("### ")) {
                    return <h4 key={idx} className="text-sm font-bold font-mono text-emerald-400 pt-2">{block.replace("### ", "")}</h4>;
                  }
                  if (block.startsWith("* ")) {
                    return (
                      <ul key={idx} className="list-disc list-inside pl-4 text-xs space-y-2 text-slate-300">
                        {block.split("\n").map((li, lidx) => (
                          <li key={lidx}>{li.replace("* ", "").replace(/\*\*(.*?)\*\*/g, '$1')}</li>
                        ))}
                      </ul>
                    );
                  }
                  if (block.startsWith("1. ")) {
                    return (
                      <ol key={idx} className="list-decimal list-inside pl-4 text-xs space-y-2 text-slate-300">
                        {block.split("\n").map((li, lidx) => (
                          <li key={lidx}>{li.replace(/^\d+\.\s+/, "").replace(/\*\*(.*?)\*\*/g, '$1')}</li>
                        ))}
                      </ol>
                    );
                  }
                  if (block.startsWith("```")) {
                    const lines = block.split("\n");
                    const code = lines.slice(1, -1).join("\n");
                    return (
                      <div key={idx} className="bg-slate-900/60 border border-slate-900 rounded-lg p-4 my-4 relative font-mono text-[11px] overflow-x-auto text-slate-200">
                        <div className="absolute top-2 right-2 flex gap-2">
                          <span className="text-[8px] uppercase text-slate-600 tracking-widest font-bold">SOURCE</span>
                          <button 
                            onClick={() => navigator.clipboard.writeText(code)}
                            className="text-[9px] text-slate-500 hover:text-slate-300 font-mono transition-all"
                          >
                            Copy
                          </button>
                        </div>
                        <pre className="whitespace-pre">{code}</pre>
                      </div>
                    );
                  }
                  if (block.startsWith("|")) {
                    const rows = block.split("\n").filter(r => r.trim().startsWith("|"));
                    return (
                      <div key={idx} className="overflow-x-auto my-6 border border-slate-900 rounded-lg bg-slate-900/10">
                        <table className="min-w-full text-xs font-mono text-left">
                          <thead>
                            <tr className="border-b border-slate-900 bg-slate-900/20 text-slate-400">
                              {rows[0].split("|").slice(1, -1).map((cell, cidx) => (
                                <th key={cidx} className="py-2.5 px-3 font-semibold font-mono">{cell.trim()}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-900/40 text-slate-300">
                            {rows.slice(2).map((row, ridx) => (
                              <tr key={ridx} className="hover:bg-slate-900/20">
                                {row.split("|").slice(1, -1).map((cell, cidx) => (
                                  <td key={cidx} className="py-2.5 px-3 font-sans">{cell.trim().replace(/\*\*(.*?)\*\*/g, '$1').replace(/`(.*?)`/g, '$1')}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  }
                  
                  // Render paragraphs with basic inline code replacement
                  const inlineFormatted = block.split("`").map((part, pidx) => {
                    if (pidx % 2 === 1) {
                      return <code key={pidx} className="font-mono text-emerald-400 bg-slate-900 px-1 py-0.5 rounded text-[11px]">{part}</code>;
                    }
                    return part;
                  });

                  return <p key={idx} className="text-xs text-slate-300 leading-relaxed font-sans">{inlineFormatted}</p>;
                })}

              </div>

              {/* Navigation Pagination */}
              <div className="mt-12 pt-6 border-t border-slate-900 flex justify-between">
                {selectedSectionId !== ARCHITECTURE_SECTIONS[0].id ? (
                  <button
                    onClick={() => {
                      const idx = ARCHITECTURE_SECTIONS.findIndex((s) => s.id === selectedSectionId);
                      setSelectedSectionId(ARCHITECTURE_SECTIONS[idx - 1].id);
                    }}
                    className="flex items-center gap-1.5 font-mono text-xs text-slate-500 hover:text-indigo-400 transition-all"
                  >
                    ← Previous Section
                  </button>
                ) : (
                  <div></div>
                )}
                {selectedSectionId !== ARCHITECTURE_SECTIONS[ARCHITECTURE_SECTIONS.length - 1].id ? (
                  <button
                    onClick={() => {
                      const idx = ARCHITECTURE_SECTIONS.findIndex((s) => s.id === selectedSectionId);
                      setSelectedSectionId(ARCHITECTURE_SECTIONS[idx + 1].id);
                    }}
                    className="flex items-center gap-1.5 font-mono text-xs text-slate-500 hover:text-indigo-400 transition-all"
                  >
                    Next Section →
                  </button>
                ) : (
                  <div></div>
                )}
              </div>

            </article>
          </div>
        )}

        {/* VIEW: Dependency Graph Pipeline */}
        {activeTab === "pipeline" && (
          <div className="flex-1 overflow-y-auto p-4 lg:p-8 max-w-7xl mx-auto w-full">
            <GraphViewer />
          </div>
        )}

        {/* VIEW: Resource Footprint Estimator */}
        {activeTab === "resource" && (
          <div className="flex-1 overflow-y-auto p-4 lg:p-8 max-w-7xl mx-auto w-full">
            <ResourceEstimator />
          </div>
        )}

        {/* VIEW: Database schemas explorer */}
        {activeTab === "database" && (
          <div className="flex-1 overflow-y-auto p-4 lg:p-8 max-w-7xl mx-auto w-full">
            <DbExplorer />
          </div>
        )}

        {/* VIEW: Class relationships registry */}
        {activeTab === "classes" && (
          <div className="flex-1 overflow-y-auto p-4 lg:p-8 max-w-7xl mx-auto w-full">
            <ClassViewer />
          </div>
        )}

        {/* VIEW: Chief Architect Copilot Chat */}
        {activeTab === "chat" && (
          <div className="flex-1 overflow-y-auto p-4 lg:p-8 max-w-5xl mx-auto w-full">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-100 font-mono">Conversational Architecture Blueprint</h2>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Consult with our specialized Chief Architect agent. Clarify performance trade-offs, language allocations, memory management, or cloud cluster scaling parameters.
              </p>
            </div>
            <ChiefArchitectChat />
          </div>
        )}

        {/* VIEW: Phase 1 Dynamic Runtime Console */}
        {activeTab === "engine" && (
          <div className="flex-1 overflow-y-auto p-4 lg:p-8 max-w-7xl mx-auto w-full">
            <Phase1Console />
          </div>
        )}

      </main>

      {/* Persistent Status Bar */}
      <footer className="border-t border-slate-900 bg-slate-950 px-6 py-2.5 flex items-center justify-between text-[10px] font-mono text-slate-600">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-slate-600" />
          <span>Platform: Cloud Run Container Ingress Node </span>
          <span className="hidden sm:inline text-indigo-500 font-bold">PORT 3000 ACTIVE</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden md:inline">Specs: IEEE-754 Volumetric Precision Bounds</span>
          <span>© 2026 NovaSim AI Inc.</span>
        </div>
      </footer>

    </div>
  );
}
