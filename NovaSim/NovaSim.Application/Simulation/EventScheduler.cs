using System;
using NovaSim.Core.Interfaces;
using NovaSim.Core.Simulation;

namespace NovaSim.Application.Simulation
{
    /// <summary>
    /// Thread-safe concrete scheduler that inserts future simulation actions into the Future Event List (FEL).
    /// </summary>
    public class EventScheduler : IEventScheduler
    {
        private readonly FutureEventList _fel;

        /// <summary>
        /// Initializes a new instance of the <see cref="EventScheduler"/> class.
        /// </summary>
        /// <param name="fel">The active Future Event List instance.</param>
        public EventScheduler(FutureEventList fel)
        {
            _fel = fel ?? throw new ArgumentNullException(nameof(fel));
        }

        /// <summary>
        /// Inserts an event chronologically into the Future Event List.
        /// </summary>
        /// <param name="event">The simulation event to schedule.</param>
        public void Schedule(SimulationEvent @event)
        {
            if (@event == null)
                throw new ArgumentNullException(nameof(@event));

            _fel.Enqueue(@event);
        }
    }
}
