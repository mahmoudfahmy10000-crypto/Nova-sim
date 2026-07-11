using System;
using System.Threading.Tasks;
using NovaSim.Core.Interfaces;

namespace NovaSim.Core.Simulation
{
    /// <summary>
    /// Abstract base class representing a discrete event scheduled to occur at a specific simulation time.
    /// </summary>
    public abstract class SimulationEvent : IComparable<SimulationEvent>
    {
        /// <summary>
        /// Gets the unique identifier for the event instance.
        /// </summary>
        public string Id { get; } = Guid.NewGuid().ToString("N");

        /// <summary>
        /// Gets the target simulation virtual timestamp when this event should execute.
        /// </summary>
        public double Time { get; }

        /// <summary>
        /// Gets the sorting priority order used as a tie-breaker for events scheduled at the exact same simulation time.
        /// Lower values designate higher priority (processed first).
        /// </summary>
        public int Priority { get; }

        /// <summary>
        /// Gets the associated target entity (optional).
        /// </summary>
        public Entity? Entity { get; }

        /// <summary>
        /// Initializes a new instance of the <see cref="SimulationEvent"/> class.
        /// </summary>
        /// <param name="time">Target execution timestamp.</param>
        /// <param name="priority">Execution priority tie-breaker (defaults to 0).</param>
        /// <param name="entity">The target entity of the action (optional).</param>
        protected SimulationEvent(double time, int priority = 0, Entity? entity = null)
        {
            if (time < 0.0)
                throw new ArgumentOutOfRangeException(nameof(time), "Event scheduling time cannot be negative.");

            Time = time;
            Priority = priority;
            Entity = entity;
        }

        /// <summary>
        /// Executes the specific action/behavior logic of the event within the given runtime context.
        /// </summary>
        /// <param name="context">The active simulation runtime context.</param>
        /// <returns>A asynchronous Task representing the event execution.</returns>
        public abstract Task ExecuteAsync(ISimulationContext context);

        /// <summary>
        /// Compares events chronologically by Time, then by Priority, and finally by event ID as a final stable fallback.
        /// </summary>
        public int CompareTo(SimulationEvent? other)
        {
            if (other == null) return 1;

            // 1. Sort by Time
            int timeCompare = Time.CompareTo(other.Time);
            if (timeCompare != 0) return timeCompare;

            // 2. Sort by Priority (lower values first)
            int priorityCompare = Priority.CompareTo(other.Priority);
            if (priorityCompare != 0) return priorityCompare;

            // 3. Fallback to Id for stable sorting
            return string.Compare(Id, other.Id, StringComparison.Ordinal);
        }
    }
}
