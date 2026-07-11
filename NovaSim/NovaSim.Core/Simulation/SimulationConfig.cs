using System;

namespace NovaSim.Core.Simulation
{
    /// <summary>
    /// Specifies the execution scheduling mode for the simulation engine.
    /// </summary>
    public enum ExecutionMode
    {
        /// <summary>
        /// Process events as fast as possible without syncing to wall-clock time.
        /// </summary>
        Fastest,

        /// <summary>
        /// Synchronize virtual simulation time with real-world wall clock time using a scaling factor.
        /// </summary>
        Realtime,

        /// <summary>
        /// Pause execution after each event dispatch, waiting for manual stepping commands.
        /// </summary>
        StepByStep
    }

    /// <summary>
    /// Configuration container defining boundaries, constraints, and execution modes for a simulation run.
    /// </summary>
    public class SimulationConfig
    {
        /// <summary>
        /// Gets or sets the initial virtual simulation time (typically 0.0).
        /// </summary>
        public double StartTime { get; set; } = 0.0;

        /// <summary>
        /// Gets or sets the maximum simulation time boundary. The simulation will automatically terminate once exceeded.
        /// </summary>
        public double EndTime { get; set; } = 3600.0;

        /// <summary>
        /// Gets or sets the execution mode (Fastest, Realtime, or StepByStep).
        /// </summary>
        public ExecutionMode Mode { get; set; } = ExecutionMode.Fastest;

        /// <summary>
        /// Gets or sets the scaling factor used in Realtime mode. 
        /// For example, 1.0 means 1.0 virtual second equals 1.0 real-world second.
        /// </summary>
        public double RealtimeScale { get; set; } = 1.0;

        /// <summary>
        /// Gets or sets the integer seed value to initialize the Random Number Service for deterministic, reproducible runs.
        /// </summary>
        public int Seed { get; set; } = 42;
    }
}
