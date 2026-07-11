using NovaSim.Core.Simulation;

namespace NovaSim.Core.Interfaces
{
    /// <summary>
    /// Core interface defining capabilities to schedule events into the simulation's Future Event List.
    /// </summary>
    public interface IEventScheduler
    {
        /// <summary>
        /// Schedules a new event to be processed at its designated simulation timestamp.
        /// </summary>
        /// <param name="event">The simulation event to insert into the scheduling queue.</param>
        void Schedule(SimulationEvent @event);
    }
}
