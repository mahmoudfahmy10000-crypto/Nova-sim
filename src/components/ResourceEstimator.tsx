import React, { useState, useMemo } from "react";
import { Cpu, Zap, DollarSign, Database, HelpCircle, HardDrive, BarChart2 } from "lucide-react";

type SimType = "cfd" | "fea" | "sph";
type HardwareType = "workstation" | "cloud_node" | "cloud_cluster";
type ExecutionMode = "numerical" | "hybrid" | "surrogate";

export default function ResourceEstimator() {
  const [simType, setSimType] = useState<SimType>("cfd");
  const [meshSize, setMeshSize] = useState<number>(500000); // 500k cells
  const [hardware, setHardware] = useState<HardwareType>("workstation");
  const [mode, setMode] = useState<ExecutionMode>("hybrid");

  // Format mesh size labels
  const formatMeshLabel = (val: number) => {
    if (val >= 1000000) {
      return `${(val / 1000000).toFixed(1)}M elements`;
    }
    return `${(val / 1000).toFixed(0)}k elements`;
  };

  const calculations = useMemo(() => {
    // 1. RAM memory footprints (KB per cell / node)
    const kbPerElement = {
      cfd: 1.2, // 1.2 KB per cell in Finite Volume
      fea: 0.8, // 0.8 KB per node in Finite Element
      sph: 0.5, // 0.5 KB per particle in SPH
    }[simType];

    let ramGb = (meshSize * kbPerElement) / (1024 * 1024);
    
    // AI Surrogate adds static weight overhead
    if (mode === "hybrid" || mode === "surrogate") {
      ramGb += 1.4; // LibTorch/TensorRT base weights
    }

    // 2. Compute steps FLOP cost per element
    const flopsPerElementNumerical = {
      cfd: 6500,
      fea: 4200,
      sph: 3100,
    }[simType];

    // Neural Fourier operators require extremely small calculation cost per cell
    const flopsPerElementSurrogate = 45; 

    let flopsPerElement = 0;
    if (mode === "numerical") {
      flopsPerElement = flopsPerElementNumerical;
    } else if (mode === "surrogate") {
      flopsPerElement = flopsPerElementSurrogate;
    } else {
      // Hybrid: 85% surrogate steps, 15% heavy corrector steps
      flopsPerElement = (flopsPerElementSurrogate * 0.85) + (flopsPerElementNumerical * 0.15);
    }

    const totalFlops = meshSize * flopsPerElement;
    const totalGFlops = totalFlops / 1e9;

    // 3. Hardware performance metrics (TFLOPS) and efficiency
    // efficiency: high-level CUDA/OpenMP cohabitation vs standard CPU
    const hwMetrics = {
      workstation: { flops: 82e12, efficiency: 0.82, cost: 0.25, name: "RTX 4090 Workstation" }, // RTX 4090
      cloud_node: { flops: 350e12, efficiency: 0.88, cost: 4.50, name: "1x Cloud Tensor H100 Node" }, // H100
      cloud_cluster: { flops: 2800e12, efficiency: 0.78, cost: 36.00, name: "8x Cloud H100 InfiniBand Cluster" }, // 8x H100 Cluster
    }[hardware];

    // Execution step latency (seconds)
    let stepLatencySec = totalFlops / (hwMetrics.flops * hwMetrics.efficiency);
    
    // CPU boundary orchestration overhead
    stepLatencySec += 0.0002; // 0.2ms latency floor

    // Translate to visual milliseconds or seconds
    const latencyFormatted = stepLatencySec < 1 
      ? `${(stepLatencySec * 1000).toFixed(1)} ms`
      : `${stepLatencySec.toFixed(3)} seconds`;

    // Bottleneck analysis
    let bottleneck = "Compute Optimal";
    let bottleneckColor = "text-emerald-400 border-emerald-900 bg-emerald-950/20";
    let bottleneckDesc = "Optimal resource distribution. The simulation runs directly inside unified GPU registers.";

    if (meshSize > 20000000 && hardware === "workstation") {
      bottleneck = "VRAM Allocation Overflow";
      bottleneckColor = "text-rose-400 border-rose-900 bg-rose-950/20";
      bottleneckDesc = "Simulated elements exceed Workstation VRAM boundaries. Memory will spill to System RAM over PCIe, causing a 12x calculation lag.";
    } else if (mode === "numerical" && meshSize > 5000000 && hardware !== "cloud_cluster") {
      bottleneck = "Numerical Solver Saturation";
      bottleneckColor = "text-amber-400 border-amber-900 bg-amber-950/20";
      bottleneckDesc = "Finite linear solvers are bound by thread scheduling latency. Activating Hybrid AI surrogate is recommended to bypass iterative linear steps.";
    } else if (mode === "surrogate" && simType === "sph") {
      bottleneck = "Surrogate Conservation Variance";
      bottleneckColor = "text-amber-400 border-amber-900 bg-amber-950/20";
      bottleneckDesc = "Pure SPH neural surrogates have a 4% mass divergence rate. Hybrid Adaptive mode is recommended to preserve boundary mass physics.";
    }

    // AI speedup ratio compared to numerical
    const numericalFlops = meshSize * flopsPerElementNumerical;
    const speedupRatio = numericalFlops / totalFlops;

    return {
      ramGb,
      totalGFlops,
      latencyFormatted,
      bottleneck,
      bottleneckColor,
      bottleneckDesc,
      costPerHour: hwMetrics.cost,
      hwName: hwMetrics.name,
      speedupRatio,
    };
  }, [simType, meshSize, hardware, mode]);

  return (
    <div className="bg-slate-950 border border-slate-900 rounded-xl p-6 shadow-2xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 border-b border-slate-900 pb-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-indigo-500" />
            NovaSim Resource & Performance Estimator
          </h2>
          <p className="text-sm text-slate-400">
            Simulate computational footprints, hardware limits, and AI surrogate acceleration benefits.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Input Parameters panel */}
        <div className="lg:col-span-1 flex flex-col gap-5 bg-slate-900/20 p-5 rounded-lg border border-slate-900">
          <h3 className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-2">Simulation Parameters</h3>
          
          {/* Simulation Type */}
          <div>
            <label className="text-xs text-slate-400 block mb-1.5 font-mono">1. Physics Solver Engine</label>
            <div className="grid grid-cols-3 gap-2">
              {(["cfd", "fea", "sph"] as SimType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setSimType(type)}
                  className={`py-1.5 px-2 rounded text-xs font-medium border transition-all uppercase ${
                    simType === type
                      ? "bg-indigo-950/40 border-indigo-500 text-indigo-100"
                      : "bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Mesh / Cell Count Slider */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs text-slate-400 font-mono">2. Grid Size / Cell Count</label>
              <span className="text-xs font-mono text-emerald-400 font-semibold">
                {formatMeshLabel(meshSize)}
              </span>
            </div>
            <input
              type="range"
              min="10000"
              max="50000000"
              step="10000"
              value={meshSize}
              onChange={(e) => setMeshSize(Number(e.target.value))}
              className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-600 mt-1">
              <span>10k cells</span>
              <span>10M cells</span>
              <span>50M elements</span>
            </div>
          </div>

          {/* Execution Mode */}
          <div>
            <label className="text-xs text-slate-400 block mb-1.5 font-mono">3. Computation Solver Mode</label>
            <div className="flex flex-col gap-2">
              {[
                { id: "numerical", label: "Pure Numerical Solver", desc: "100% precise finite equation solving" },
                { id: "hybrid", label: "Hybrid Adaptive Solver", desc: "AI Surrogate + SPH/CFD physical correction" },
                { id: "surrogate", label: "Pure AI Surrogate Engine", desc: "100% Neural FNO / GNN surrogate loop" },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id as ExecutionMode)}
                  className={`p-2.5 text-left rounded border transition-all ${
                    mode === m.id
                      ? "bg-emerald-950/20 border-emerald-500 text-emerald-100"
                      : "bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <div className="text-xs font-semibold">{m.label}</div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Hardware Configuration */}
          <div>
            <label className="text-xs text-slate-400 block mb-1.5 font-mono">4. Target Hardware Target</label>
            <div className="flex flex-col gap-2">
              {[
                { id: "workstation", label: "Local GPU Workstation", spec: "16-core CPU, RTX 4090 GPU (24GB VRAM)" },
                { id: "cloud_node", label: "Single Cloud GPU Node", spec: "64-core, 1x H100 Enterprise Node" },
                { id: "cloud_cluster", label: "HPC GPU Cloud Cluster", spec: "8x H100 Cluster connected over InfiniBand" },
              ].map((hw) => (
                <button
                  key={hw.id}
                  onClick={() => setHardware(hw.id as HardwareType)}
                  className={`p-2.5 text-left rounded border transition-all ${
                    hardware === hw.id
                      ? "bg-indigo-950/20 border-indigo-500 text-indigo-100"
                      : "bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <div className="text-xs font-semibold">{hw.label}</div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">{hw.spec}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Output Metrics dashboard */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Metric 1: Memory Footprint */}
          <div className="bg-slate-900/40 border border-slate-900 rounded-lg p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2 text-slate-500">
                <HardDrive className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-mono uppercase tracking-wider">Mesh RAM Footprint</span>
              </div>
              <div className="text-3xl font-semibold text-slate-100 font-mono">
                {calculations.ramGb.toFixed(2)} <span className="text-lg font-normal text-slate-500">GB</span>
              </div>
            </div>
            <div className="text-xs text-slate-400 font-mono mt-3 leading-relaxed border-t border-slate-900 pt-3">
              Allocated via <code className="text-emerald-400 font-bold">SlabAlloc</code> inside double-precision matrices. Bypasses standard fragmentation boundaries.
            </div>
          </div>

          {/* Metric 2: Speed / Latency per timestep */}
          <div className="bg-slate-900/40 border border-slate-900 rounded-lg p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2 text-slate-500">
                <Zap className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-mono uppercase tracking-wider">Solver Step Latency</span>
              </div>
              <div className="text-3xl font-semibold text-slate-100 font-mono">
                {calculations.latencyFormatted}
              </div>
            </div>
            <div className="text-xs text-slate-400 font-mono mt-3 leading-relaxed border-t border-slate-900 pt-3">
              Theoretical speed: <span className="text-indigo-400 font-semibold">{calculations.totalGFlops.toFixed(1)} GFLOPS</span> per step. Calculated over {calculations.hwName}.
            </div>
          </div>

          {/* Metric 3: AI Surrogate Acceleration */}
          <div className="bg-slate-900/40 border border-slate-900 rounded-lg p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2 text-slate-500">
                <Zap className="w-4 h-4 text-indigo-500" />
                <span className="text-xs font-mono uppercase tracking-wider">AI Surrogate Speedup</span>
              </div>
              <div className="text-3xl font-semibold text-emerald-400 font-mono">
                {calculations.speedupRatio.toFixed(1)}x
              </div>
            </div>
            <div className="text-xs text-slate-400 font-mono mt-3 leading-relaxed border-t border-slate-900 pt-3">
              Compared to standard finite volume numerical solver iteration cycles. Achieved via pre-compiled TensorRT Fourier models.
            </div>
          </div>

          {/* Metric 4: Cloud Resource Cost */}
          <div className="bg-slate-900/40 border border-slate-900 rounded-lg p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2 text-slate-500">
                <DollarSign className="w-4 h-4 text-indigo-500" />
                <span className="text-xs font-mono uppercase tracking-wider">Operating Infrastructure Cost</span>
              </div>
              <div className="text-3xl font-semibold text-slate-100 font-mono">
                ${calculations.costPerHour.toFixed(2)} <span className="text-lg font-normal text-slate-500">/ hr</span>
              </div>
            </div>
            <div className="text-xs text-slate-400 font-mono mt-3 leading-relaxed border-t border-slate-900 pt-3">
              Based on on-demand high-end cluster allocations. Local workstation uses standard zero-cost offline licenses.
            </div>
          </div>

          {/* Architectural Bottleneck Analysis */}
          <div className={`md:col-span-2 border rounded-lg p-4 mt-2 ${calculations.bottleneckColor}`}>
            <div className="flex items-center gap-2 mb-1">
              <HelpCircle className="w-4 h-4" />
              <h4 className="text-sm font-semibold font-mono">System Diagnostic: {calculations.bottleneck}</h4>
            </div>
            <p className="text-xs leading-relaxed">{calculations.bottleneckDesc}</p>
          </div>

        </div>
      </div>
    </div>
  );
}
