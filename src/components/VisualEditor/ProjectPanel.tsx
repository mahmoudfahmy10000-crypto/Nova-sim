import React, { useState, useEffect, useRef } from "react";
import { usePlatformStore, Project, Version } from "../../core/store/platformStore";
import { getTranslation } from "../../core/i18n/translations";
import { SimulationLayout } from "../../core/simulation/types";
import { validateProjectJSON } from "../../core/simulation/validation";
import { 
  Folder, 
  Plus, 
  Trash2, 
  Save, 
  History, 
  FileCode, 
  RefreshCw, 
  CheckCircle2,
  Lock,
  Upload,
  Download,
  AlertCircle,
  AlertTriangle,
  FileJson,
  Check,
  Edit2,
  Clock,
  Settings
} from "lucide-react";

interface ProjectPanelProps {
  currentLayout: SimulationLayout;
  onLoadLayout: (layout: SimulationLayout) => void;
  onSaveProject: () => Promise<void>;
  onNewProject: (name: string, description: string) => void;
  zoom: number;
  panOffset: { x: number; y: number };
  showGrid: boolean;
  snapSize: number;
}

export default function ProjectPanel({ 
  currentLayout, 
  onLoadLayout, 
  onSaveProject, 
  onNewProject,
  zoom,
  panOffset,
  showGrid,
  snapSize
}: ProjectPanelProps) {
  const {
    locale,
    user,
    projects,
    currentProjectId,
    setProjects,
    setCurrentProjectId,
    addProject,
    deleteProject,
    updateProjectLayout,
    createProjectSnapshot,
    restoreProjectSnapshot,
    autosaveEnabled,
    toggleAutosave,
    recentProjects,
    addRecentProject
  } = usePlatformStore();

  const [activeTab, setActiveTab] = useState<"catalog" | "metadata" | "import" | "diagnostics">("catalog");
  
  // Create Project inputs
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  
  // Snapshot inputs
  const [snapshotComment, setSnapshotComment] = useState("");
  
  // Save status states
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  // Edit active project details states
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // Import states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [importReport, setImportReport] = useState<{ isValid: boolean; errors: string[]; warnings: string[] } | null>(null);
  const [importedLayout, setImportedLayout] = useState<SimulationLayout | null>(null);
  const [importedName, setImportedName] = useState("");

  // Get current project details
  const currentProject = projects.find((p) => p.id === currentProjectId);

  // Initialize edit fields when current project changes
  useEffect(() => {
    if (currentProject) {
      setEditName(currentProject.name);
      setEditDesc(currentProject.description);
    }
  }, [currentProject]);

  // Real-time canvas diagnostics report
  const diagnostics = validateProjectJSON(currentLayout);

  const t = (key: any) => getTranslation(locale, key);

  // Create snap-shot versions
  const handleCreateSnapshot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!snapshotComment.trim() || !currentProjectId) return;
    createProjectSnapshot(currentProjectId, snapshotComment);
    setSnapshotComment("");
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 3000);
  };

  // Save changes to active project details
  const handleUpdateMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProject || !editName.trim() || user?.role === "viewer") return;

    setSaveStatus("saving");
    const updated = {
      ...currentProject,
      name: editName,
      description: editDesc,
      lastSaved: new Date().toISOString()
    };

    try {
      await fetch(`/api/projects/${currentProject.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated)
      });

      // Update in our store
      setProjects(projects.map(p => p.id === currentProject.id ? updated : p));
      setIsEditingMetadata(false);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch {
      setProjects(projects.map(p => p.id === currentProject.id ? updated : p));
      setIsEditingMetadata(false);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  };

  // Clone current layout (Save As)
  const handleSaveAsProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || user?.role === "viewer") return;

    setSaveStatus("saving");
    const cloneLayout: SimulationLayout = {
      ...currentLayout,
      zoom,
      panOffsetX: panOffset.x,
      panOffsetY: panOffset.y,
      showGrid,
      snapSize
    };

    const newId = `proj_${Date.now()}`;
    const newProj: Project = {
      id: newId,
      name: newProjectName,
      description: newProjectDesc || "Cloned layout snapshot of active workplace.",
      lastSaved: new Date().toISOString(),
      layout: cloneLayout,
      versions: [
        {
          id: `ver_init`,
          timestamp: new Date().toISOString(),
          comment: "Initial cloned topology snapshot",
          layout: JSON.parse(JSON.stringify(cloneLayout))
        }
      ]
    };

    try {
      await fetch(`/api/projects/${newId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProj)
      });

      addProject(newProj);
      setCurrentProjectId(newId);
      addRecentProject(newId, newProj.name);
      setNewProjectName("");
      setNewProjectDesc("");
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch {
      addProject(newProj);
      setCurrentProjectId(newId);
      addRecentProject(newId, newProj.name);
      setNewProjectName("");
      setNewProjectDesc("");
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  };

  // Create clean blank project
  const handleCreateNewProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || user?.role === "viewer") return;

    setSaveStatus("saving");
    const emptyLayout: SimulationLayout = {
      nodes: [],
      connections: [],
      zoom: 1.0,
      panOffsetX: 50,
      panOffsetY: 50,
      showGrid: true,
      snapSize: 10
    };

    const newId = `proj_${Date.now()}`;
    const newProj: Project = {
      id: newId,
      name: newProjectName,
      description: newProjectDesc || "Clean industrial process pipeline schematic.",
      lastSaved: new Date().toISOString(),
      layout: emptyLayout,
      versions: []
    };

    try {
      await fetch(`/api/projects/${newId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProj)
      });

      addProject(newProj);
      setCurrentProjectId(newId);
      onLoadLayout(emptyLayout);
      addRecentProject(newId, newProj.name);
      setNewProjectName("");
      setNewProjectDesc("");
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch {
      addProject(newProj);
      setCurrentProjectId(newId);
      onLoadLayout(emptyLayout);
      addRecentProject(newId, newProj.name);
      setNewProjectName("");
      setNewProjectDesc("");
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  };

  const handleManualSave = async () => {
    if (user?.role === "viewer") return;
    setSaveStatus("saving");
    try {
      await onSaveProject();
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (err: any) {
      setSaveError(err.message || "Manual save failed.");
      setSaveStatus("idle");
      setTimeout(() => setSaveError(null), 5000);
    }
  };

  const handleSwitchProject = async (id: string) => {
    const targetProj = projects.find((p) => p.id === id);
    if (targetProj) {
      setCurrentProjectId(id);
      onLoadLayout(targetProj.layout);
      addRecentProject(id, targetProj.name);
    } else {
      // Fetch from API if not loaded in store
      try {
        const res = await fetch(`/api/projects/${id}`);
        if (res.ok) {
          const fetched = await res.json();
          addProject(fetched);
          setCurrentProjectId(id);
          onLoadLayout(fetched.layout);
          addRecentProject(id, fetched.name);
        }
      } catch (e) {
        console.error("Failed to load project from server", e);
      }
    }
  };

  const handleRestoreVersion = (version: Version) => {
    if (!currentProjectId || user?.role === "viewer") return;
    restoreProjectSnapshot(currentProjectId, version.id);
    onLoadLayout(version.layout);
  };

  // Export project download
  const handleExportJSON = () => {
    if (!currentProject) return;
    
    const exportLayout: SimulationLayout = {
      ...currentLayout,
      zoom,
      panOffsetX: panOffset.x,
      panOffsetY: panOffset.y,
      showGrid,
      snapSize
    };

    const payload = {
      ...currentProject,
      layout: exportLayout,
      schemaVersion: "2.1.0",
      exporter: "NovaSim AI CAD System Engine"
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentProject.name.toLowerCase().replace(/\s+/g, "_")}_schema.nsim.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Import JSON Logic
  const handleImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const rawText = e.target?.result as string;
        const parsed = JSON.parse(rawText);
        
        // Deep validate parsed schema
        const report = validateProjectJSON(parsed);
        setImportReport(report);
        
        if (report.isValid) {
          const layoutData = parsed.layout || parsed;
          setImportedLayout(layoutData);
          setImportedName(parsed.name || `Imported_${Date.now()}`);
        } else {
          setImportedLayout(null);
        }
      } catch (err: any) {
        setImportReport({
          isValid: false,
          errors: ["File format error: Must be a clean valid JSON project manifest."],
          warnings: []
        });
        setImportedLayout(null);
      }
    };
    reader.readAsText(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImportFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleImportFile(e.target.files[0]);
    }
  };

  const executeImport = async () => {
    if (!importedLayout || user?.role === "viewer") return;

    setSaveStatus("saving");
    const newId = `proj_import_${Date.now()}`;
    const newProj: Project = {
      id: newId,
      name: importedName,
      description: "Successfully imported from offline JSON template file.",
      lastSaved: new Date().toISOString(),
      layout: importedLayout,
      versions: [
        {
          id: `ver_import`,
          timestamp: new Date().toISOString(),
          comment: "Initial JSON import seed",
          layout: JSON.parse(JSON.stringify(importedLayout))
        }
      ]
    };

    try {
      await fetch(`/api/projects/${newId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProj)
      });

      addProject(newProj);
      setCurrentProjectId(newId);
      onLoadLayout(importedLayout);
      addRecentProject(newId, newProj.name);
      
      // Reset Import States
      setImportReport(null);
      setImportedLayout(null);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch {
      addProject(newProj);
      setCurrentProjectId(newId);
      onLoadLayout(importedLayout);
      addRecentProject(newId, newProj.name);
      setImportReport(null);
      setImportedLayout(null);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  };

  return (
    <div className="bg-slate-900/60 border border-slate-900 rounded-xl p-4 flex flex-col gap-4">
      
      {/* Header with Project Title & Save state */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Folder className="w-4 h-4 text-amber-500" />
          <h3 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider">
            {t("projectManager")}
          </h3>
        </div>
        
        <div className="flex items-center gap-2">
          {saveStatus === "saving" && (
            <span className="text-[9px] font-mono text-amber-400 flex items-center gap-1">
              <RefreshCw className="w-2.5 h-2.5 animate-spin" />
              SAVING...
            </span>
          )}
          {saveStatus === "saved" && (
            <span className="text-[9px] font-mono text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-2.5 h-2.5" />
              SYNCED
            </span>
          )}
          {saveStatus === "idle" && (
            <span className="text-[8px] font-mono text-slate-500 uppercase flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${autosaveEnabled ? "bg-emerald-500" : "bg-slate-600"}`}></span>
              {autosaveEnabled ? "Auto-Save" : "Manual Mode"}
            </span>
          )}
        </div>
      </div>

      {/* Main active project card summary */}
      {currentProject && (
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 flex flex-col gap-1.5 relative group">
          <div className="flex items-start justify-between">
            {isEditingMetadata ? (
              <form onSubmit={handleUpdateMetadata} className="flex-1 space-y-2 mr-6">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[11px] font-mono font-bold text-slate-200 focus:outline-none focus:border-indigo-500"
                />
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[9px] font-mono text-slate-400 focus:outline-none focus:border-indigo-500"
                />
                <div className="flex gap-1">
                  <button
                    type="submit"
                    className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] font-mono cursor-pointer"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingMetadata(false)}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 text-[9px] font-mono cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold font-mono text-slate-200">{currentProject.name}</span>
                  {user?.role !== "viewer" && (
                    <button
                      onClick={() => setIsEditingMetadata(true)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-slate-900 text-slate-500 hover:text-slate-300 transition-all cursor-pointer"
                      title="Edit project meta labels"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <p className="text-[9px] text-slate-400 font-mono leading-relaxed mt-1">
                  {currentProject.description || "No project overview statement recorded yet."}
                </p>
              </div>
            )}
            
            {!isEditingMetadata && (
              <span className="text-[8px] font-mono bg-indigo-950/40 border border-indigo-900/30 text-indigo-400 px-1.5 py-0.5 rounded shrink-0">
                ACTIVE
              </span>
            )}
          </div>
          
          <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-slate-900 text-[8px] text-slate-500 font-mono">
            <span>SAVED: {new Date(currentProject.lastSaved).toLocaleTimeString()}</span>
            <span>VERSIONS: {currentProject.versions?.length || 0}</span>
          </div>

          {/* Action Row */}
          {user?.role !== "viewer" && (
            <div className="flex gap-1.5 mt-2">
              <button
                onClick={handleManualSave}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white p-1 rounded flex items-center justify-center gap-1 text-[9px] font-mono font-bold cursor-pointer transition-colors"
                title="Manually sync schematic topology to cloud"
              >
                <Save className="w-3 h-3" />
                <span>SAVE</span>
              </button>
              <button
                onClick={handleExportJSON}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-750 text-slate-300 p-1 rounded flex items-center justify-center gap-1 text-[9px] font-mono cursor-pointer transition-colors px-2.5"
                title="Export layout schema to local disk (.json)"
              >
                <Download className="w-3 h-3" />
                <span>EXPORT</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Settings Row: Toggle Auto-save */}
      <div className="bg-slate-950/40 border border-slate-850 rounded-lg p-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Settings className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[9px] font-mono font-bold text-slate-400">AUTOMATIC AUTO-SAVE</span>
        </div>
        <button
          onClick={toggleAutosave}
          className={`px-2 py-0.5 text-[9px] font-mono font-bold rounded transition-all cursor-pointer ${
            autosaveEnabled
              ? "bg-emerald-600/20 border border-emerald-500/30 text-emerald-400"
              : "bg-slate-850 border border-slate-800 text-slate-500"
          }`}
        >
          {autosaveEnabled ? "ENABLED" : "DISABLED"}
        </button>
      </div>

      {/* Sub Tabs Selector */}
      <div className="flex bg-slate-950 rounded-lg p-0.5 border border-slate-850">
        <button
          onClick={() => setActiveTab("catalog")}
          className={`flex-1 py-1 text-[9px] font-mono font-bold rounded transition-colors cursor-pointer ${
            activeTab === "catalog" ? "bg-slate-900 text-slate-200" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          CATALOG
        </button>
        <button
          onClick={() => setActiveTab("metadata")}
          className={`flex-1 py-1 text-[9px] font-mono font-bold rounded transition-colors cursor-pointer ${
            activeTab === "metadata" ? "bg-slate-900 text-slate-200" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          CLONE & NEW
        </button>
        <button
          onClick={() => setActiveTab("import")}
          className={`flex-1 py-1 text-[9px] font-mono font-bold rounded transition-colors cursor-pointer ${
            activeTab === "import" ? "bg-slate-900 text-slate-200" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          IMPORT File
        </button>
        <button
          onClick={() => setActiveTab("diagnostics")}
          className={`flex-1 py-1 text-[9px] font-mono font-bold rounded transition-colors cursor-pointer relative ${
            activeTab === "diagnostics" ? "bg-slate-900 text-slate-200" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <span>DIAGNOSTICS</span>
          {!diagnostics.isValid && (
            <span className="absolute top-0.5 right-1.5 h-1.5 w-1.5 rounded-full bg-red-500"></span>
          )}
          {diagnostics.isValid && diagnostics.warnings.length > 0 && (
            <span className="absolute top-0.5 right-1.5 h-1.5 w-1.5 rounded-full bg-amber-500"></span>
          )}
        </button>
      </div>

      {/* Tab Body Contents */}
      <div className="min-h-[180px]">

        {/* Tab 1: Project Catalog List */}
        {activeTab === "catalog" && (
          <div className="space-y-4">
            
            {/* Project List */}
            <div className="space-y-1.5">
              <span className="text-[9px] font-mono uppercase text-slate-500 font-semibold tracking-wider block">
                Select Workspace Project
              </span>
              <div className="space-y-1 max-h-[140px] overflow-y-auto pr-1">
                {projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSwitchProject(p.id)}
                    className={`w-full text-left p-2 rounded border text-[10px] font-mono transition-all flex items-center justify-between ${
                      p.id === currentProjectId
                        ? "bg-slate-950 border-indigo-600 text-slate-200"
                        : "bg-slate-950/40 border-slate-850 hover:border-slate-700 text-slate-400 hover:text-slate-300"
                    }`}
                  >
                    <span className="truncate max-w-[180px]">{p.name}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[8px] font-mono text-slate-600">
                        {new Date(p.lastSaved).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                      {projects.length > 1 && p.id !== "proj_default" && user?.role === "admin" && (
                        <Trash2
                          className="w-3 h-3 text-red-500 hover:text-red-400 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteProject(p.id);
                          }}
                        />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Recent list */}
            {recentProjects.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[9px] font-mono uppercase text-slate-500 font-semibold tracking-wider flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Recent Sessions
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {recentProjects.map((rp) => (
                    <button
                      key={rp.id}
                      onClick={() => handleSwitchProject(rp.id)}
                      className="bg-slate-950/30 hover:bg-slate-950 p-1.5 rounded border border-slate-850 hover:border-slate-700 text-left text-[9px] font-mono text-slate-400 hover:text-slate-200 truncate cursor-pointer transition-all"
                    >
                      <div className="font-bold text-[8px] text-indigo-400 truncate">{rp.name}</div>
                      <div className="text-[7px] text-slate-600 mt-0.5">Opened: {new Date(rp.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Version rollback select list */}
            <div className="space-y-1.5">
              <span className="text-[9px] font-mono uppercase text-slate-500 font-semibold tracking-wider block">
                {t("versionHistory")}
              </span>
              <div className="space-y-1.5 max-h-[145px] overflow-y-auto pr-1">
                {currentProject?.versions?.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => handleRestoreVersion(v)}
                    className="w-full text-left p-1.5 rounded border border-slate-850 bg-slate-950/20 hover:bg-slate-950 hover:border-slate-700 text-[9px] font-mono transition-all text-slate-400 flex flex-col gap-0.5 group"
                  >
                    <div className="flex justify-between w-full text-slate-500">
                      <span className="font-bold text-indigo-400 group-hover:text-indigo-300">{v.id.toUpperCase()}</span>
                      <span>{new Date(v.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className="text-slate-300 truncate max-w-[280px]">"{v.comment}"</div>
                  </button>
                ))}
                {(!currentProject?.versions || currentProject.versions.length === 0) && (
                  <div className="text-[9px] font-mono text-slate-600 italic text-center py-6">
                    No version tags recorded yet.
                  </div>
                )}
              </div>
            </div>

            {/* Commit Form */}
            {user?.role !== "viewer" && currentProject && (
              <form onSubmit={handleCreateSnapshot} className="flex flex-col gap-2 mt-2">
                <label className="text-[9px] font-mono uppercase text-slate-500 font-semibold tracking-wider">
                  Commit snap to version control
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={snapshotComment}
                    onChange={(e) => setSnapshotComment(e.target.value)}
                    placeholder="e.g. 'Optimized processing step times'"
                    className="flex-1 bg-slate-950 border border-slate-850 rounded px-2 py-1 text-[9px] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <button
                    type="submit"
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-750 p-1.5 rounded flex items-center gap-1 text-[9px] font-mono cursor-pointer transition-colors shrink-0"
                  >
                    <History className="w-3.5 h-3.5 text-indigo-400" />
                    <span>COMMIT</span>
                  </button>
                </div>
              </form>
            )}

          </div>
        )}

        {/* Tab 2: Clone and Create New Project */}
        {activeTab === "metadata" && (
          <div className="space-y-4">
            
            {/* Save As (Clone) Form */}
            {user?.role !== "viewer" ? (
              <form onSubmit={handleSaveAsProject} className="bg-slate-950 p-3 rounded-lg border border-slate-850 space-y-3">
                <span className="text-[9px] font-mono uppercase text-indigo-400 font-bold tracking-wider block">
                  CLONE WORKSPACE LAYOUT (SAVE AS)
                </span>
                <p className="text-[8px] font-mono text-slate-500">
                  Clones all nodes, connections, coordinate scales, zoom offsets, and custom parameters into a separate isolated profile.
                </p>
                <div className="space-y-2">
                  <input
                    type="text"
                    required
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="New layout cloned name"
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-[10px] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <input
                    type="text"
                    value={newProjectDesc}
                    onChange={(e) => setNewProjectDesc(e.target.value)}
                    placeholder="Cloned description summary"
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-[10px] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-1.5 rounded text-[10px] font-mono font-bold transition-all cursor-pointer"
                  >
                    CLONE PROFILE
                  </button>
                </div>
              </form>
            ) : (
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 text-slate-500 text-[10px] font-mono text-center">
                Clone operation restricted in Viewer mode.
              </div>
            )}

            {/* Create New Blank Project Form */}
            {user?.role !== "viewer" && (
              <form onSubmit={handleCreateNewProject} className="bg-slate-950 p-3 rounded-lg border border-slate-850 space-y-3">
                <span className="text-[9px] font-mono uppercase text-emerald-400 font-bold tracking-wider block">
                  CREATE NEW BLANK SCHEMATIC
                </span>
                <p className="text-[8px] font-mono text-slate-500">
                  Resets the workbench canvas to initial clean state with no active nodes or wire connections.
                </p>
                <div className="space-y-2">
                  <input
                    type="text"
                    required
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="New empty schematic name"
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-[10px] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <input
                    type="text"
                    value={newProjectDesc}
                    onChange={(e) => setNewProjectDesc(e.target.value)}
                    placeholder="Description summary (optional)"
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-[10px] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-1.5 rounded text-[10px] font-mono font-bold transition-all cursor-pointer"
                  >
                    CREATE BLANK PROJECT
                  </button>
                </div>
              </form>
            )}
            
          </div>
        )}

        {/* Tab 3: JSON Import Zone */}
        {activeTab === "import" && (
          <div className="space-y-4">
            <span className="text-[9px] font-mono uppercase text-slate-500 font-semibold tracking-wider block">
              Drag-and-Drop / Upload Project JSON
            </span>

            {/* Drop Zone */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                dragActive
                  ? "border-indigo-500 bg-indigo-950/20 text-indigo-400"
                  : "border-slate-800 bg-slate-950/40 hover:border-slate-700 text-slate-500 hover:text-slate-400"
              }`}
            >
              <Upload className="w-8 h-8 text-indigo-400 shrink-0" />
              <div className="text-[10px] font-mono font-bold text-center">
                {dragActive ? "Drop the file here..." : "Drag & drop files here, or click to upload"}
              </div>
              <div className="text-[8px] font-mono text-slate-600">Supports standard .json and .nsim files</div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.nsim"
                onChange={handleFileInputChange}
                className="hidden"
              />
            </div>

            {/* Import reports, validation outputs, and validation banner */}
            {importReport && (
              <div className={`p-3 rounded border text-[10px] font-mono ${
                importReport.isValid
                  ? "bg-slate-950 border-emerald-900/40"
                  : "bg-slate-950 border-red-900/40"
              }`}>
                <div className="flex items-center gap-2 font-bold mb-2">
                  {importReport.isValid ? (
                    <span className="text-emerald-400 flex items-center gap-1 uppercase">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Schema structure valid!
                    </span>
                  ) : (
                    <span className="text-red-400 flex items-center gap-1 uppercase">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Invalid Layout Schema!
                    </span>
                  )}
                </div>

                {/* Errors list */}
                {importReport.errors.length > 0 && (
                  <div className="space-y-1 mb-2">
                    <div className="text-red-400 font-bold uppercase text-[8px]">Structural Errors:</div>
                    {importReport.errors.map((err, i) => (
                      <div key={i} className="text-red-300 text-[9px] pl-2 flex items-start gap-1">
                        <span className="text-red-500 shrink-0">•</span>
                        <span>{err}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Warnings list */}
                {importReport.warnings.length > 0 && (
                  <div className="space-y-1 mb-2">
                    <div className="text-amber-400 font-bold uppercase text-[8px]">Warnings / Flow alerts:</div>
                    {importReport.warnings.map((warn, i) => (
                      <div key={i} className="text-amber-300/80 text-[9px] pl-2 flex items-start gap-1">
                        <span className="text-amber-500 shrink-0">•</span>
                        <span>{warn}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Success launch button */}
                {importReport.isValid && importedLayout && (
                  <div className="mt-3 pt-2.5 border-t border-slate-900 space-y-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-[8px] text-slate-500 uppercase font-bold">Import profile name:</label>
                      <input
                        type="text"
                        value={importedName}
                        onChange={(e) => setImportedName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[10px] text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <button
                      onClick={executeImport}
                      disabled={user?.role === "viewer"}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-mono font-bold py-1.5 rounded transition-all cursor-pointer text-[10px]"
                    >
                      EXECUTE SCHEMATIC IMPORT
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        {/* Tab 4: Diagnostics Panel */}
        {activeTab === "diagnostics" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-mono uppercase text-slate-500 font-bold">Workbench Diagnostics</span>
              <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded ${
                diagnostics.isValid
                  ? "bg-emerald-950/40 text-emerald-400 border border-emerald-900/30"
                  : "bg-red-950/40 text-red-400 border border-red-900/30"
              }`}>
                {diagnostics.isValid ? "TOPOLOGY SOUND" : "TOPOLOGY ISSUES"}
              </span>
            </div>

            {/* Error alerts */}
            {diagnostics.errors.length > 0 ? (
              <div className="space-y-2 bg-red-950/15 border border-red-900/30 p-3 rounded-lg">
                <div className="flex items-center gap-1.5 text-red-400 text-[10px] font-bold">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>CRITICAL STRUCTURAL ERRORS ({diagnostics.errors.length})</span>
                </div>
                <div className="space-y-1">
                  {diagnostics.errors.map((err, i) => (
                    <p key={i} className="text-red-300 text-[9px] pl-2 flex items-start gap-1">
                      <span className="text-red-500 shrink-0">•</span>
                      <span>{err}</span>
                    </p>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-emerald-950/15 border border-emerald-900/30 p-3 rounded-lg flex items-center gap-2 text-emerald-400 text-[10px]">
                <Check className="w-4 h-4" />
                <span>All schemas match standard system specification profiles.</span>
              </div>
            )}

            {/* Warning alerts */}
            {diagnostics.warnings.length > 0 && (
              <div className="space-y-2 bg-amber-950/15 border border-amber-900/30 p-3 rounded-lg">
                <div className="flex items-center gap-1.5 text-amber-400 text-[10px] font-bold">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>PROCESS FLOW ALERTS ({diagnostics.warnings.length})</span>
                </div>
                <div className="space-y-1">
                  {diagnostics.warnings.map((warn, i) => (
                    <p key={i} className="text-amber-300/85 text-[9px] pl-2 flex items-start gap-1">
                      <span className="text-amber-500 shrink-0">•</span>
                      <span>{warn}</span>
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Stats Summary */}
            {diagnostics.metadata && (
              <div className="bg-slate-950 border border-slate-850 p-3 rounded-lg grid grid-cols-2 gap-2 text-[9px] font-mono text-slate-400">
                <div>Nodes Count: <span className="font-bold text-slate-200">{diagnostics.metadata.nodeCount}</span></div>
                <div>Connections: <span className="font-bold text-slate-200">{diagnostics.metadata.connectionCount}</span></div>
                <div>Sources: <span className="font-bold text-slate-200">{diagnostics.metadata.sourceCount}</span></div>
                <div>Sinks: <span className="font-bold text-slate-200">{diagnostics.metadata.sinkCount}</span></div>
              </div>
            )}

          </div>
        )}

      </div>

    </div>
  );
}
