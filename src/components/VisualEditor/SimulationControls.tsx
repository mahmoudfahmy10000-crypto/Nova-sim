import React from "react";
import { Play, Pause, RotateCcw, ArrowRight, Gauge, Cpu, Layers } from "lucide-react";

interface SimulationControlsProps {
  isRunning: boolean;
  clockTime: number;
  stepCount: number;
  simSpeed: number;
  seed: number;
  solverType: string;
  onPlayPause: () => void;
  onStopReset: () => void;
  onStep: () => void;
  onSpeedChange: (speed: number) => void;
  onSeedChange: (seed: number) => void;
  onSolverChange: (type: string) => void;
}

export default function SimulationControls({
  isRunning,
  clockTime,
  stepCount,
  simSpeed,
  seed,
  solverType,
  onPlayPause,
  onStopReset,
  onStep,
  onSpeedChange,
  onSeedChange,
  onSolverChange
}: SimulationControlsProps) {
  return (
    <div className="bg-slate-900/60 border border-slate-900 rounded-xl p-3 flex flex-wrap gap-4 items-center justify-between w-full mb-4">
      {/* Simulation Clock Counters */}
      <div className="flex items-center gap-4">
        {/* State LED indicator */}
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            {isRunning ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </>
            ) : (
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            )}
          </span>
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
            {isRunning ? "RUNNING" : "HALTED"}
          </span>
        </div>

        {/* Digital Clock readout */}
        <div className="bg-slate-950 px-3 py-1 rounded border border-slate-800/80 flex items-center gap-2">
          <span className="text-[9px] font-mono text-slate-500 font-semibold uppercase">CLOCK</span>
          <span className="text-xs font-mono font-extrabold text-indigo-400 w-16 text-right">
            {clockTime.toFixed(2)}s
          </span>
        </div>

        {/* Event counter */}
        <div className="bg-slate-950 px-3 py-1 rounded border border-slate-800/80 flex items-center gap-2">
          <span className="text-[9px] font-mono text-slate-500 font-semibold uppercase">EVENTS</span>
          <span className="text-xs font-mono font-extrabold text-emerald-400 w-12 text-right">
            {stepCount}
          </span>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={onPlayPause}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
            isRunning
              ? "bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-500/10"
              : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/10"
          }`}
          title={isRunning ? "Pause Simulation" : "Start Simulation"}
        >
          {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          <span>{isRunning ? "PAUSE" : "PLAY"}</span>
        </button>

        <button
          onClick={onStep}
          disabled={isRunning}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-400 bg-slate-800/60 border border-slate-700/50 hover:bg-slate-800 hover:text-slate-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          title="Advance single discrete event step"
        >
          <ArrowRight className="w-3.5 h-3.5" />
          <span>STEP</span>
        </button>

        <button
          onClick={onStopReset}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-400 bg-slate-800/60 border border-slate-700/50 hover:bg-slate-800 hover:text-slate-200 transition-all cursor-pointer"
          title="Reset clock and clear event log"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>RESET</span>
        </button>
      </div>

      {/* Simulation Speed Slider & Config */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Speed multiplier */}
        <div className="flex items-center gap-2 bg-slate-950 px-2.5 py-1 rounded border border-slate-800/80 text-[10px]">
          <Gauge className="w-3.5 h-3.5 text-slate-500" />
          <span className="font-mono text-slate-400 uppercase mr-1">SPEED</span>
          <input
            type="range"
            min={0.1}
            max={10.0}
            step={0.1}
            value={simSpeed}
            onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
            className="w-20 h-1 bg-slate-800 rounded-lg appearance-none cursor-ew-resize accent-indigo-500"
          />
          <span className="font-mono text-indigo-400 w-8 text-right font-bold ml-1">{simSpeed.toFixed(1)}x</span>
        </div>

        {/* PRNG Seed */}
        <div className="flex items-center gap-2 bg-slate-950 px-2.5 py-1 rounded border border-slate-800/80 text-[10px]">
          <span className="font-mono text-slate-500 font-semibold uppercase">SEED</span>
          <input
            type="number"
            value={seed}
            onChange={(e) => onSeedChange(parseInt(e.target.value) || 42)}
            className="bg-transparent text-emerald-400 font-mono focus:outline-none w-10 text-right font-bold"
            title="Pseudo-Random Seed value"
          />
        </div>

        {/* Solver selection */}
        <div className="flex items-center gap-2 bg-slate-950 px-2.5 py-1 rounded border border-slate-800/80 text-[10px]">
          <Cpu className="w-3.5 h-3.5 text-indigo-500" />
          <span className="font-mono text-slate-500 font-semibold uppercase mr-1">SOLVER</span>
          <select
            value={solverType}
            onChange={(e) => onSolverChange(e.target.value)}
            className="bg-transparent text-indigo-300 font-mono focus:outline-none cursor-pointer"
          >
            <option value="deterministic">Stochastic Solver Core (WASM)</option>
            <option value="surrogate">PINN Surrogate (Fourier Neural Operator)</option>
            <option value="mcarlo">Monte Carlo Event Dispatcher</option>
          </select>
        </div>
      </div>
    </div>
  );
}
