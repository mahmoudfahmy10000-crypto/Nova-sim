using System;
using System.Collections.Generic;

namespace NovaSim.Core.Simulation
{
    /// <summary>
    /// Thread-safe priority queue containing all scheduled future events sorted chronologically 
    /// by virtual execution timestamp and priority.
    /// </summary>
    public class FutureEventList
    {
        private readonly object _lock = new();
        private readonly SortedSet<SimulationEvent> _events = new();

        /// <summary>
        /// Gets the total number of events currently scheduled.
        /// </summary>
        public int Count
        {
            get
            {
                lock (_lock)
                {
                    return _events.Count;
                }
            }
        }

        /// <summary>
        /// Schedules (enqueues) an event to be executed in the future.
        /// </summary>
        /// <param name="event">The simulation event to schedule.</param>
        public void Enqueue(SimulationEvent @event)
        {
            if (@event == null)
                throw new ArgumentNullException(nameof(@event));

            lock (_lock)
            {
                _events.Add(@event);
            }
        }

        /// <summary>
        /// Removes and returns the earliest chronological event in the queue.
        /// </summary>
        /// <returns>The earliest scheduled simulation event.</returns>
        /// <exception cref="InvalidOperationException">Thrown if the event list is empty.</exception>
        public SimulationEvent Dequeue()
        {
            lock (_lock)
            {
                if (_events.Count == 0)
                {
                    throw new InvalidOperationException("Future Event List is empty. Cannot dequeue.");
                }

                var earliest = _events.Min!;
                _events.Remove(earliest);
                return earliest;
            }
        }

        /// <summary>
        /// Returns the earliest chronological event in the queue without removing it.
        /// </summary>
        /// <returns>The earliest scheduled simulation event, or null if the list is empty.</returns>
        public SimulationEvent? Peek()
        {
            lock (_lock)
            {
                return _events.Count > 0 ? _events.Min : null;
            }
        }

        /// <summary>
        /// Clears all scheduled events from the queue.
        /// </summary>
        public void Clear()
        {
            lock (_lock)
            {
                _events.Clear();
            }
        }

        /// <summary>
        /// Safely cancels and removes all scheduled events associated with a specific entity.
        /// </summary>
        /// <param name="entity">The target entity whose scheduled events should be cancelled.</param>
        public int CancelEventsForEntity(Entity entity)
        {
            if (entity == null) throw new ArgumentNullException(nameof(entity));

            lock (_lock)
            {
                int count = 0;
                var toRemove = new List<SimulationEvent>();

                foreach (var ev in _events)
                {
                    if (ev.Entity != null && ev.Entity.Id == entity.Id)
                    {
                        toRemove.Add(ev);
                    }
                }

                foreach (var ev in toRemove)
                {
                    _events.Remove(ev);
                    count++;
                }

                return count;
            }
        }
    }
}
