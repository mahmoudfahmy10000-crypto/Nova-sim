import React from "react";
import { usePlatformStore } from "../../core/store/platformStore";
import { getTranslation } from "../../core/i18n/translations";
import { Cpu, CheckCircle2, AlertCircle, RefreshCcw, ToggleLeft, ToggleRight, HelpCircle } from "lucide-react";

export default function PluginPanel() {
  const { plugins, togglePlugin, locale, user, addLog } = usePlatformStore();

  const handleToggle = (id: string, enabled: boolean) => {
    if (user?.role !== "admin") {
      addLog(`Permission denied: Only Admin level profiles can enable/disable system plug-ins.`);
      return;
    }
    togglePlugin(id);
    addLog(`Plugin '${id}' ${!enabled ? "ENABLED" : "DISABLED"}. Refreshed core solver binding map.`);
  };

  const t = (key: any) => getTranslation(locale, key);

  return (
    <div className="bg-slate-900/60 border border-slate-900 rounded-xl p-4 flex flex-col gap-3.5">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-indigo-400" />
          <h3 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider">
            {t("plugins")}
          </h3>
        </div>
        <span className="text-[8px] font-mono text-slate-500 uppercase tracking-wide">
          API VER: 2.1.0-TS
        </span>
      </div>

      <div className="space-y-2.5">
        {plugins.map((plugin) => (
          <div
            key={plugin.id}
            className={`p-3 rounded-lg border text-left transition-all ${
              plugin.enabled
                ? "bg-slate-950 border-slate-850"
                : "bg-slate-950/40 border-slate-900 opacity-60"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {plugin.enabled ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-slate-600" />
                )}
                <span className="text-xs font-bold font-mono text-slate-200">
                  {plugin.name}
                </span>
              </div>

              {/* Toggle switch */}
              <button
                type="button"
                onClick={() => handleToggle(plugin.id, plugin.enabled)}
                disabled={user?.role !== "admin"}
                className={`cursor-pointer transition-colors ${
                  user?.role !== "admin" ? "cursor-not-allowed opacity-50" : ""
                }`}
                title={user?.role === "admin" ? "Toggle plug-in state" : "Requires Administrator profile"}
              >
                {plugin.enabled ? (
                  <ToggleRight className="w-6 h-6 text-indigo-400" />
                ) : (
                  <ToggleLeft className="w-6 h-6 text-slate-600" />
                )}
              </button>
            </div>

            <p className="text-[10px] text-slate-400 font-mono mt-1.5 leading-relaxed">
              {plugin.description}
            </p>

            <div className="flex items-center justify-between text-[8px] text-slate-600 font-mono mt-2 pt-1.5 border-t border-slate-900/50">
              <span>BY: {plugin.author.toUpperCase()}</span>
              <span>V{plugin.version}</span>
            </div>
          </div>
        ))}
      </div>

      {user?.role !== "admin" && (
        <div className="text-[8px] font-mono text-slate-500 italic text-center leading-relaxed">
          * Dynamic plugin binding and hot-reload is locked to administrator level security roles.
        </div>
      )}
    </div>
  );
}
