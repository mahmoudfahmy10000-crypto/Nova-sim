import { create } from "zustand";
import { SimulationLayout } from "../simulation/types";

export type UserRole = "admin" | "editor" | "viewer";

export interface User {
  username: string;
  role: UserRole;
  token: string;
}

export interface Version {
  id: string;
  timestamp: string;
  comment: string;
  layout: SimulationLayout;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  lastSaved: string;
  layout: SimulationLayout;
  versions: Version[];
}

export interface Plugin {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  author: string;
  version: string;
}

export type Locale = "en" | "de" | "ja";

interface PlatformState {
  // Auth State
  user: User | null;
  login: (username: string, role: UserRole, token: string) => void;
  logout: () => void;

  // Theme State
  theme: "light" | "dark";
  toggleTheme: () => void;

  // Locale State
  locale: Locale;
  setLocale: (locale: Locale) => void;

  // Projects State
  projects: Project[];
  currentProjectId: string | null;
  autosaveEnabled: boolean;
  recentProjects: { id: string; name: string; timestamp: string }[];
  crashBackup: { projectId: string; layout: SimulationLayout; timestamp: string } | null;
  setProjects: (projects: Project[]) => void;
  setCurrentProjectId: (id: string | null) => void;
  addProject: (project: Project) => void;
  deleteProject: (id: string) => void;
  updateProjectLayout: (id: string, layout: SimulationLayout) => void;
  createProjectSnapshot: (id: string, comment: string) => void;
  restoreProjectSnapshot: (projectId: string, versionId: string) => void;
  toggleAutosave: () => void;
  addRecentProject: (id: string, name: string) => void;
  clearRecentProjects: () => void;
  setCrashBackup: (backup: { projectId: string; layout: SimulationLayout; timestamp: string } | null) => void;

  // Plugins State
  plugins: Plugin[];
  togglePlugin: (id: string) => void;

  // Error/Log tracking
  logs: string[];
  addLog: (msg: string) => void;
  clearLogs: () => void;
}

export const usePlatformStore = create<PlatformState>((set) => ({
  // Auth State (Default is null, but we can initialize with a mock admin/editor token or guest session)
  user: {
    username: "NovaOperator",
    role: "admin",
    token: "mock-jwt-token-xyz"
  },
  login: (username, role, token) => set({ user: { username, role, token } }),
  logout: () => set({ user: null }),

  // Theme State (Default: Dark)
  theme: "dark",
  toggleTheme: () => set((state) => {
    const nextTheme = state.theme === "dark" ? "light" : "dark";
    if (typeof document !== "undefined") {
      if (nextTheme === "light") {
        document.documentElement.classList.add("light");
        document.documentElement.classList.remove("dark");
      } else {
        document.documentElement.classList.add("dark");
        document.documentElement.classList.remove("light");
      }
    }
    return { theme: nextTheme };
  }),

  // Locale State
  locale: "en",
  setLocale: (locale) => set({ locale }),

  // Projects State
  projects: [],
  currentProjectId: "proj_default",
  autosaveEnabled: (() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("novasim_autosave_enabled");
      return saved === null ? true : saved === "true";
    }
    return true;
  })(),
  recentProjects: (() => {
    if (typeof window !== "undefined") {
      try {
        const saved = window.localStorage.getItem("novasim_recent_projects");
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return [];
  })(),
  crashBackup: (() => {
    if (typeof window !== "undefined") {
      try {
        const saved = window.localStorage.getItem("novasim_crash_backup");
        return saved ? JSON.parse(saved) : null;
      } catch {
        return null;
      }
    }
    return null;
  })(),

  setProjects: (projects) => set({ projects }),
  setCurrentProjectId: (id) => set({ currentProjectId: id }),
  addProject: (project) => set((state) => ({ projects: [...state.projects, project] })),
  deleteProject: (id) => set((state) => {
    // Also remove from recent projects list
    const filteredRecent = state.recentProjects.filter((rp) => rp.id !== id);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("novasim_recent_projects", JSON.stringify(filteredRecent));
    }
    return {
      projects: state.projects.filter((p) => p.id !== id),
      currentProjectId: state.currentProjectId === id ? null : state.currentProjectId,
      recentProjects: filteredRecent
    };
  }),
  updateProjectLayout: (id, layout) => set((state) => ({
    projects: state.projects.map((p) =>
      p.id === id ? { ...p, layout, lastSaved: new Date().toISOString() } : p
    )
  })),

  // Version History management
  createProjectSnapshot: (id, comment) => set((state) => {
    const project = state.projects.find((p) => p.id === id);
    if (!project) return {};

    const newVersion: Version = {
      id: `ver_${Date.now()}`,
      timestamp: new Date().toISOString(),
      comment,
      layout: JSON.parse(JSON.stringify(project.layout))
    };

    return {
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, versions: [newVersion, ...p.versions] } : p
      )
    };
  }),

  restoreProjectSnapshot: (projectId, versionId) => set((state) => {
    const project = state.projects.find((p) => p.id === projectId);
    if (!project) return {};

    const version = project.versions.find((v) => v.id === versionId);
    if (!version) return {};

    return {
      projects: state.projects.map((p) =>
        p.id === projectId ? { ...p, layout: JSON.parse(JSON.stringify(version.layout)), lastSaved: new Date().toISOString() } : p
      )
    };
  }),

  toggleAutosave: () => set((state) => {
    const nextVal = !state.autosaveEnabled;
    if (typeof window !== "undefined") {
      window.localStorage.setItem("novasim_autosave_enabled", String(nextVal));
    }
    return { autosaveEnabled: nextVal };
  }),

  addRecentProject: (id, name) => set((state) => {
    const filtered = state.recentProjects.filter((rp) => rp.id !== id);
    const updated = [{ id, name, timestamp: new Date().toISOString() }, ...filtered].slice(0, 10);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("novasim_recent_projects", JSON.stringify(updated));
    }
    return { recentProjects: updated };
  }),

  clearRecentProjects: () => set(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("novasim_recent_projects");
    }
    return { recentProjects: [] };
  }),

  setCrashBackup: (backup) => set(() => {
    if (typeof window !== "undefined") {
      if (backup === null) {
        window.localStorage.removeItem("novasim_crash_backup");
      } else {
        window.localStorage.setItem("novasim_crash_backup", JSON.stringify(backup));
      }
    }
    return { crashBackup: backup };
  }),

  // Plugins State
  plugins: [
    {
      id: "solver_pinn",
      name: "PINN Solver Module",
      description: "Direct Fourier Neural Operator model acceleration for Navier-Stokes boundary equations.",
      enabled: true,
      author: "NovaSim AI Core Team",
      version: "1.0.0"
    },
    {
      id: "sensor_telemetry",
      name: "IoT Live Telemetry Hook",
      description: "Streams dynamic external sensor events to system queues via MQTT protocols.",
      enabled: false,
      author: "Enterprise Integrations Group",
      version: "0.8.2"
    },
    {
      id: "report_exporter",
      name: "PDF Analytics Report Generator",
      description: "Generates beautiful, ready-to-print industrial throughput reports dynamically.",
      enabled: true,
      author: "NovaSim AI Core Team",
      version: "1.1.0"
    }
  ],
  togglePlugin: (id) => set((state) => ({
    plugins: state.plugins.map((p) => p.id === id ? { ...p, enabled: !p.enabled } : p)
  })),

  // Logs tracking
  logs: ["Zustand Platform state engine booted."],
  addLog: (msg) => set((state) => ({ logs: [msg, ...state.logs].slice(0, 100) })),
  clearLogs: () => set({ logs: [] })
}));
