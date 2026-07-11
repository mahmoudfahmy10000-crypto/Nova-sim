using System;
using System.Collections.Generic;

namespace NovaSim.Core.Simulation
{
    /// <summary>
    /// Represents a pending request block for a capacity-constrained simulation resource.
    /// </summary>
    public record ResourceRequest(Entity Requester, int Quantity, double RequestTime);

    /// <summary>
    /// Base class representing a limited-capacity resource shared by simulation entities.
    /// Supports queuing, utilization tracking, and thread-safe operations.
    /// </summary>
    public abstract class Resource
    {
        private readonly object _lock = new();
        private readonly List<ResourceRequest> _waitQueue = new();

        /// <summary>
        /// Gets the unique identifier for the resource.
        /// </summary>
        public string Id { get; }

        /// <summary>
        /// Gets the human-readable descriptive name of the resource.
        /// </summary>
        public string Name { get; }

        /// <summary>
        /// Gets the total capacity limit of the resource.
        /// </summary>
        public int Capacity { get; }

        /// <summary>
        /// Gets the currently available capacity.
        /// </summary>
        public int Available { get; private set; }

        /// <summary>
        /// Gets a read-only list of currently queued pending requests.
        /// </summary>
        public IReadOnlyList<ResourceRequest> WaitQueue
        {
            get
            {
                lock (_lock)
                {
                    return _waitQueue.ToArray();
                }
            }
        }

        /// <summary>
        /// Gets the cumulative utilization time-integrated area (used to calculate average utilization).
        /// </summary>
        public double IntegratedUtilization { get; private set; }

        private double _lastUpdateTime;

        /// <summary>
        /// Initializes a new instance of the <see cref="Resource"/> class.
        /// </summary>
        /// <param name="id">Unique identifier.</param>
        /// <param name="name">Descriptive name.</param>
        /// <param name="capacity">Total capacity of the resource (must be greater than 0).</param>
        protected Resource(string id, string name, int capacity)
        {
            if (capacity <= 0)
                throw new ArgumentOutOfRangeException(nameof(capacity), "Resource capacity must be greater than zero.");

            Id = id ?? throw new ArgumentNullException(nameof(id));
            Name = name ?? id;
            Capacity = capacity;
            Available = capacity;
        }

        /// <summary>
        /// Attempts to acquire a specified capacity of the resource. 
        /// If insufficient capacity is available, the entity is placed in the waiting queue.
        /// </summary>
        /// <param name="requester">The entity initiating the request.</param>
        /// <param name="quantity">The requested capacity size.</param>
        /// <param name="currentTime">The current simulation clock timestamp.</param>
        /// <returns>True if the capacity was successfully allocated immediately; False if queued.</returns>
        public bool TryAcquire(Entity requester, int quantity, double currentTime)
        {
            if (quantity <= 0)
                throw new ArgumentOutOfRangeException(nameof(quantity), "Acquisition quantity must be greater than zero.");
            if (quantity > Capacity)
                throw new ArgumentException($"Requested quantity {quantity} exceeds total resource capacity {Capacity}.", nameof(quantity));

            lock (_lock)
            {
                UpdateStatistics(currentTime);

                if (Available >= quantity && _waitQueue.Count == 0)
                {
                    Available -= quantity;
                    return true;
                }

                _waitQueue.Add(new ResourceRequest(requester, quantity, currentTime));
                return false;
            }
        }

        /// <summary>
        /// Releases a specified capacity allocation back to the resource pool. 
        /// This will automatically trigger unblocking of queued requests in FIFO sequence.
        /// </summary>
        /// <param name="releaser">The entity releasing its capacity.</param>
        /// <param name="quantity">The released capacity size.</param>
        /// <param name="currentTime">The current simulation clock timestamp.</param>
        /// <param name="unblockedRequests">Out parameter returning any queued requests that were fully satisfied by this release.</param>
        public void Release(Entity releaser, int quantity, double currentTime, out List<ResourceRequest> unblockedRequests)
        {
            if (quantity <= 0)
                throw new ArgumentOutOfRangeException(nameof(quantity), "Release quantity must be greater than zero.");

            lock (_lock)
            {
                if (Available + quantity > Capacity)
                {
                    throw new InvalidOperationException(
                        $"Capacity Leak Violation: Releasing {quantity} units would exceed " +
                        $"total capacity boundary of {Capacity} (Current Available: {Available}).");
                }

                UpdateStatistics(currentTime);
                Available += quantity;
                unblockedRequests = new List<ResourceRequest>();

                // Check FIFO queue to satisfy waiting requests
                while (_waitQueue.Count > 0)
                {
                    var nextRequest = _waitQueue[0];
                    if (Available >= nextRequest.Quantity)
                    {
                        Available -= nextRequest.Quantity;
                        unblockedRequests.Add(nextRequest);
                        _waitQueue.RemoveAt(0);
                    }
                    else
                    {
                        // Stop trying if the first in line cannot be satisfied to preserve FIFO ordering
                        break;
                    }
                }
            }
        }

        /// <summary>
        /// Internal tracker updating the time-weighted resource utilization metrics.
        /// </summary>
        private void UpdateStatistics(double currentTime)
        {
            if (currentTime < _lastUpdateTime) return;

            double elapsed = currentTime - _lastUpdateTime;
            int busyUnits = Capacity - Available;
            IntegratedUtilization += busyUnits * elapsed;
            _lastUpdateTime = currentTime;
        }

        /// <summary>
        /// Calculates the overall average resource utilization percentage from start to current time.
        /// </summary>
        public double GetAverageUtilization(double currentTime, double startTime)
        {
            lock (_lock)
            {
                UpdateStatistics(currentTime);
                double totalTime = currentTime - startTime;
                if (totalTime <= 0.0) return 0.0;
                return (IntegratedUtilization / (Capacity * totalTime)) * 100.0;
            }
        }

        /// <summary>
        /// Resets the resource state, clearing the wait queues and utilization statistics.
        /// </summary>
        public virtual void Reset()
        {
            lock (_lock)
            {
                Available = Capacity;
                _waitQueue.Clear();
                IntegratedUtilization = 0.0;
                _lastUpdateTime = 0.0;
            }
        }
    }
}
