import React, { useState, useEffect } from "react";
import { usePlatformStore, Project, Version } from "../../core/store/platformStore";
import { getTranslation } from "../../core/i18n/translations";
import { SimulationLayout } from "../../core/simulation/types";
import { 
  Folder, 
  Plus, 
  Trash2, 
  Save, 
  History, 
  ArrowLeftRight, 
  FileCode, 
  RefreshCw, 
  CheckCircle2,
  Lock
} from "lucide-react";

interface ProjectPanelProps {
  currentLayout: SimulationLayout;
  onLoadLayout: (layout: SimulationLayout) => void;
}

export default function ProjectPanel({ currentLayout, onLoadLayout }: ProjectPanelProps) {
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
    restoreProjectSnapshot
  } = usePlatformStore();

  const [newProjectName, setNewProjectName] = useState("");
  const [snapshotComment, setSnapshotComment] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [wsStatus, setWsStatus] = useState<string>("Active");

  // Get current project details
  const currentProject = projects.find((p) => p.id === currentProjectId);

  // Initialize store with default projects if empty
  useEffect(() => {
    if (projects.length === 0) {
      const defaultProject: Project = {
        id: "proj_default",
        name: "Standard Factory Assembly",
        description: "Classic 3-stage CNC factory milling line with deterministic arrival rates.",
        lastSaved: new Date().toISOString(),
        layout: currentLayout,
        versions: [
          {
            id: "ver_init",
            timestamp: new Date().toISOString(),
            comment: "Initial system bootstrap topology",
            layout: JSON.parse(JSON.stringify(currentLayout))
          }
        ]
      };
      setProjects([defaultProject]);
      setCurrentProjectId("proj_default");
    }
  }, [projects.length, setProjects, setCurrentProjectId, currentLayout]);

  // Handle auto-save mechanism
  useEffect(() => {
    const timer = setInterval(() => {
      if (currentProjectId && user?.role !== "viewer") {
        setSaveStatus("saving");
        updateProjectLayout(currentProjectId, currentLayout);
        
        // Mock save to persistent database
        fetch("/api/projects/default", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(currentLayout)
        }).catch((err) => console.warn("Auto-save sync offline, cached in local state."));

        setTimeout(() => setSaveStatus("saved"), 1000);
        setTimeout(() => setSaveStatus("idle"), 3000);
      }
    }, 15000); // Auto-save every 15s

    return () => clearInterval(timer);
  }, [currentProjectId, currentLayout, updateProjectLayout, user?.role]);

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    const newProj: Project = {
      id: `proj_${Date.now()}`,
      name: newProjectName,
      description: "Custom user-generated industrial pipeline workflow schematic",
      lastSaved: new Date().toISOString(),
      layout: JSON.parse(JSON.stringify(currentLayout)),
      versions: [
        {
          id: `ver_${Date.now()}`,
          timestamp: new Date().toISOString(),
          comment: "Initial template creation",
          layout: JSON.parse(JSON.stringify(currentLayout))
        }
      ]
    };

    addProject(newProj);
    setCurrentProjectId(newProj.id);
    setNewProjectName("");
  };

  const handleCreateSnapshot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!snapshotComment.trim() || !currentProjectId) return;

    createProjectSnapshot(currentProjectId, snapshotComment);
    setSnapshotComment("");
  };

  const handleManualSave = () => {
    if (!currentProjectId || user?.role === "viewer") return;
    
    setSaveStatus("saving");
    updateProjectLayout(currentProjectId, currentLayout);
    
    // Explicit server save
    fetch("/api/projects/default", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(currentLayout)
    })
    .then(() => {
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    })
    .catch(() => {
      setSaveStatus("saved"); // save completed locally
      setTimeout(() => setSaveStatus("idle"), 3000);
    });
  };

  const handleSwitchProject = (id: string) => {
    setCurrentProjectId(id);
    const targetProj = projects.find((p) => p.id === id);
    if (targetProj) {
      onLoadLayout(targetProj.layout);
    }
  };

  const handleRestoreVersion = (version: Version) => {
    if (!currentProjectId || user?.role === "viewer") return;
    restoreProjectSnapshot(currentProjectId, version.id);
    onLoadLayout(version.layout);
  };

  const t = (key: any) => getTranslation(locale, key);

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
              AUTO-SAVED
            </span>
          )}
          {saveStatus === "idle" && (
            <span className="text-[8px] font-mono text-slate-500 uppercase">
              {t("autoSaveEnabled")}
            </span>
          )}
        </div>
      </div>

      {/* Main active project card summary */}
      {currentProject && (
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold font-mono text-slate-200">{currentProject.name}</span>
            <span className="text-[8px] font-mono text-slate-500 uppercase">Active Profile</span>
          </div>
          <p className="text-[9px] text-slate-400 font-mono leading-relaxed">
            {currentProject.description}
          </p>
          <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-slate-900 text-[8px] text-slate-500 font-mono">
            <span>SAVED: {new Date(currentProject.lastSaved).toLocaleTimeString()}</span>
            <span>VERSIONS: {currentProject.versions?.length || 0}</span>
          </div>
        </div>
      )}

      {/* Save snapshot form */}
      {user?.role !== "viewer" ? (
        <form onSubmit={handleCreateSnapshot} className="flex flex-col gap-2">
          <label className="text-[9px] font-mono uppercase text-slate-500 font-semibold tracking-wider">
            Commit snapshot to version control
          </label>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={snapshotComment}
              onChange={(e) => setSnapshotComment(e.target.value)}
              placeholder="e.g. 'Optimized processing step times & route probs'"
              className="flex-1 bg-slate-950 border border-slate-850 rounded px-2 py-1.5 text-[10px] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
            />
            <button
              type="submit"
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-750 p-1.5 rounded flex items-center gap-1 text-[10px] font-mono cursor-pointer transition-colors"
            >
              <History className="w-3.5 h-3.5 text-indigo-400" />
              <span>COMMIT</span>
            </button>
          </div>
        </form>
      ) : (
        <div className="bg-indigo-950/20 border border-indigo-900/30 text-indigo-400 text-[10px] font-mono p-2.5 rounded-lg flex gap-2 items-center">
          <Lock className="w-3.5 h-3.5 shrink-0" />
          <span>Viewer permission tier. System modifications locked.</span>
        </div>
      )}

      {/* List Projects & Version selector side by side or tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
        
        {/* Project Selector list */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[9px] font-mono uppercase text-slate-500 font-semibold tracking-wider">
            Select Project Template
          </span>
          <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
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
                <span className="truncate max-w-[120px]">{p.name}</span>
                {projects.length > 1 && p.id !== "proj_default" && user?.role === "admin" && (
                  <Trash2
                    className="w-3 h-3 text-red-500 hover:text-red-400 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteProject(p.id);
                    }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Create new project button */}
          {user?.role !== "viewer" && (
            <form onSubmit={handleCreateProject} className="flex gap-1.5 mt-1">
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="New project label"
                className="flex-1 bg-slate-950 border border-slate-850 rounded px-2 py-1 text-[9px] text-slate-300 focus:outline-none focus:border-indigo-500 font-mono"
              />
              <button
                type="submit"
                className="p-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
                title="Create blank project snapshot"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </form>
          )}
        </div>

        {/* Version rollback select list */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[9px] font-mono uppercase text-slate-500 font-semibold tracking-wider">
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
                <div className="text-slate-300 truncate max-w-[150px]">"{v.comment}"</div>
              </button>
            ))}
            {(!currentProject?.versions || currentProject.versions.length === 0) && (
              <div className="text-[9px] font-mono text-slate-600 italic text-center py-6">
                No version tags recorded yet.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
