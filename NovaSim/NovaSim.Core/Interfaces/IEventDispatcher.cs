using System.Threading.Tasks;
using NovaSim.Core.Simulation;

namespace NovaSim.Core.Interfaces
{
    /// <summary>
    /// Contract responsible for orchestrating the execution of scheduled simulation events.
    /// </summary>
    public interface IEventDispatcher
    {
        /// <summary>
        /// Dispatches and processes an event in the context, raising logging, error handling, and telemetry updates.
        /// </summary>
        /// <param name="event">The simulation event to execute.</param>
        /// <param name="context">The running simulation context.</param>
        /// <returns>A task representing the completion of event execution.</returns>
        Task DispatchAsync(SimulationEvent @event, ISimulationContext context);
    }
}
