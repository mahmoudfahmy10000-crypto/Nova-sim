using System;
using System.Threading.Tasks;
using NovaSim.Core.Enums;
using NovaSim.Core.Simulation;

namespace NovaSim.Core.Interfaces
{
    /// <summary>
    /// Represents structural operations to control the execution loop of a simulation run.
    /// Exposes control flows and lifecycle events.
    /// </summary>
    public interface ISimulationController
    {
        /// <summary>
        /// Gets the active runtime simulation context coordinated by this controller.
        /// </summary>
        ISimulationContext Context { get; }

        /// <summary>
        /// Invoked when the simulation state transitions (e.g., from Created to Running, Paused, etc.).
        /// </summary>
        event Action<SimulationState>? OnStateChanged;

        /// <summary>
        /// Invoked immediately after an event has been successfully dispatched and executed.
        /// Passes the executed event.
        /// </summary>
        event Action<SimulationEvent>? OnEventProcessed;

        /// <summary>
        /// Invoked when the simulation finishes running (Completed, Stopped, or Failed).
        /// </summary>
        event Action<SimulationState, Exception?>? OnFinished;

        /// <summary>
        /// Configures and initializes the controller with the specified simulation configuration.
        /// </summary>
        /// <param name="config">The simulation configuration settings.</param>
        void Initialize(SimulationConfig config);

        /// <summary>
        /// Starts or resumes the asynchronous simulation execution loop.
        /// Executes events continuously until end criteria is reached or a pause/stop command is issued.
        /// </summary>
        Task RunAsync();

        /// <summary>
        /// Temporarily suspends active simulation execution. 
        /// Ensures any running event finishes processing first.
        /// </summary>
        void Pause();

        /// <summary>
        /// Explicitly terminates active execution. 
        /// Clears pending events if required.
        /// </summary>
        void Stop();

        /// <summary>
        /// Executes a single discrete event from the Future Event List, advances clock, and pauses.
        /// </summary>
        /// <returns>A boolean designating if an event was successfully popped and processed.</returns>
        Task<bool> StepAsync();
    }
}
