import React, { useState } from "react";
import { usePlatformStore, UserRole } from "../../core/store/platformStore";
import { getTranslation } from "../../core/i18n/translations";
import { Shield, ShieldAlert, Key, LogOut, Check, UserCheck } from "lucide-react";

export default function AuthPanel() {
  const { user, login, logout, locale, addLog } = usePlatformStore();
  const [username, setUsername] = useState("NovaOperator");
  const [role, setRole] = useState<UserRole>("editor");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setIsSubmitting(true);
    setTimeout(() => {
      // Simulate JWT creation
      const mockJwt = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(
        JSON.stringify({ sub: username, role, exp: Date.now() + 3600000 })
      )}.signature_here`;

      login(username, role, mockJwt);
      addLog(`User '${username}' authenticated as role [${role.toUpperCase()}]. JWT token stored.`);
      setIsSubmitting(false);
    }, 600);
  };

  const t = (key: any) => getTranslation(locale, key);

  if (user) {
    return (
      <div className="bg-slate-900/60 border border-slate-900 rounded-xl p-4 flex flex-col gap-3.5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider">
              {t("loginTitle")}
            </span>
          </div>
          <button
            onClick={() => {
              logout();
              addLog("User logged out. Credentials revoked.");
            }}
            className="text-[9px] font-mono text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{t("logout").toUpperCase()}</span>
          </button>
        </div>

        <div className="flex items-center justify-between bg-slate-950 p-3 rounded-lg border border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded ${
              user.role === "admin" ? "bg-red-950/40 border border-red-900/40" :
              user.role === "editor" ? "bg-indigo-950/40 border border-indigo-900/40" :
              "bg-slate-950 border border-slate-800"
            }`}>
              <UserCheck className={`w-4 h-4 ${
                user.role === "admin" ? "text-red-400" :
                user.role === "editor" ? "text-indigo-400" :
                "text-slate-400"
              }`} />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-mono">OPERATOR PROFILE</div>
              <div className="text-xs font-bold font-mono text-slate-200">{user.username}</div>
            </div>
          </div>

          <div className="flex flex-col items-end">
            <div className="text-[8px] text-slate-500 font-mono">SECURITY CLASS</div>
            <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded uppercase mt-0.5 ${
              user.role === "admin" ? "bg-red-500/10 border border-red-500/20 text-red-400" :
              user.role === "editor" ? "bg-indigo-500/10 border border-indigo-500/20 text-indigo-400" :
              "bg-slate-800 text-slate-300"
            }`}>
              {user.role}
            </span>
          </div>
        </div>

        <div className="text-[9px] text-slate-500 font-mono leading-relaxed bg-slate-950/20 px-2 py-1.5 rounded border border-slate-900 flex items-start gap-1.5">
          <Key className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
          <span className="truncate">JWT Bearer: <span className="text-slate-600">{user.token}</span></span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/60 border border-slate-900 rounded-xl p-4 flex flex-col gap-3.5">
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
        <ShieldAlert className="w-4 h-4 text-amber-500" />
        <span className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider">
          {t("loginTitle")}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-[9px] font-mono text-slate-500 uppercase tracking-wide">
            Operator Name
          </label>
          <input
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 font-mono"
            placeholder="Operator name"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[9px] font-mono text-slate-500 uppercase tracking-wide">
            Security Permission Tier
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {(["admin", "editor", "viewer"] as UserRole[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`py-1.5 px-2 rounded border text-[9px] font-mono uppercase tracking-wide cursor-pointer transition-all ${
                  role === r
                    ? "bg-indigo-600 border-indigo-500 text-white font-bold shadow-md shadow-indigo-900/25"
                    : "bg-slate-950 border-slate-850 hover:border-slate-700 text-slate-400 hover:text-slate-300"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-750 py-2 rounded text-xs font-mono font-bold cursor-pointer transition-colors flex items-center justify-center gap-1.5 mt-1"
        >
          {isSubmitting ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
              <span>AUTHORIZING...</span>
            </>
          ) : (
            <>
              <Shield className="w-3.5 h-3.5 text-indigo-400" />
              <span>ACQUIRE BEARER TOKEN</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
