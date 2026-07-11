using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using NovaSim.Core.Enums;
using NovaSim.Core.Interfaces;
using NovaSim.Core.Simulation;
using NovaSim.Application.Services;

namespace NovaSim.Application.Simulation
{
    /// <summary>
    /// Thread-safe context implementing the runtime container for an active simulation.
    /// Combines clocks, schedulers, dispatchers, and entity/resource registration registries.
    /// </summary>
    public class SimulationContext : ISimulationContext
    {
        private readonly object _lock = new();
        private readonly ConcurrentDictionary<string, Entity> _entities = new();
        private readonly ConcurrentDictionary<string, Resource> _resources = new();

        /// <summary>
        /// Gets the virtual simulation clock.
        /// </summary>
        public SimulationClock Clock { get; }

        /// <summary>
        /// Gets the Future Event List.
        /// </summary>
        public FutureEventList EventList { get; }

        /// <summary>
        /// Gets the event scheduler.
        /// </summary>
        public IEventScheduler Scheduler { get; }

        /// <summary>
        /// Gets the event dispatcher.
        /// </summary>
        public IEventDispatcher Dispatcher { get; }

        /// <summary>
        /// Gets the pseudo-random number generator.
        /// </summary>
        public IRandomService Rng { get; }

        /// <summary>
        /// Gets the simulation configuration.
        /// </summary>
        public SimulationConfig Config { get; }

        /// <summary>
        /// Gets or sets the simulation execution state.
        /// </summary>
        public SimulationState State { get; set; } = SimulationState.Created;

        /// <summary>
        /// Gets a read-only list of registered entities.
        /// </summary>
        public IReadOnlyDictionary<string, Entity> Entities => _entities;

        /// <summary>
        /// Gets a read-only list of registered resources.
        /// </summary>
        public IReadOnlyDictionary<string, Resource> Resources => _resources;

        /// <summary>
        /// Initializes a new instance of the <see cref="SimulationContext"/> class.
        /// </summary>
        /// <param name="config">The simulation configuration settings.</param>
        public SimulationContext(SimulationConfig config)
        {
            Config = config ?? throw new ArgumentNullException(nameof(config));
            Clock = new SimulationClock();
            EventList = new FutureEventList();
            Scheduler = new EventScheduler(EventList);
            Dispatcher = new EventDispatcher();
            Rng = new RandomService(config.Seed);
        }

        /// <summary>
        /// Registers a dynamic simulation entity and triggers its OnInit callback hook.
        /// </summary>
        /// <param name="entity">The entity instance to register.</param>
        public void RegisterEntity(Entity entity)
        {
            if (entity == null) throw new ArgumentNullException(nameof(entity));

            lock (_lock)
            {
                if (!_entities.TryAdd(entity.Id, entity))
                {
                    throw new InvalidOperationException($"Registry Duplicate Violation: An Entity with ID '{entity.Id}' is already registered.");
                }

                entity.OnInit(this);
                LogTrace($"Registered entity: '{entity.Name}' (ID: {entity.Id})", "CONTEXT");
            }
        }

        /// <summary>
        /// Unregisters an entity and invokes its OnDestroy lifecycle hook.
        /// </summary>
        /// <param name="entityId">The target entity's unique ID.</param>
        public bool UnregisterEntity(string entityId)
        {
            if (string.IsNullOrWhiteSpace(entityId)) throw new ArgumentException("Entity ID cannot be empty.");

            lock (_lock)
            {
                if (_entities.TryRemove(entityId, out var entity))
                {
                    EventList.CancelEventsForEntity(entity);
                    entity.OnDestroy(this);
                    LogTrace($"Unregistered entity: '{entity.Name}' (ID: {entityId})", "CONTEXT");
                    return true;
                }
                return false;
            }
        }

        /// <summary>
        /// Registers a shared capacity resource into the context.
        /// </summary>
        /// <param name="resource">The resource to register.</param>
        public void RegisterResource(Resource resource)
        {
            if (resource == null) throw new ArgumentNullException(nameof(resource));

            lock (_lock)
            {
                if (!_resources.TryAdd(resource.Id, resource))
                {
                    throw new InvalidOperationException($"Registry Duplicate Violation: A Resource with ID '{resource.Id}' is already registered.");
                }

                LogTrace($"Registered resource: '{resource.Name}' (Capacity: {resource.Capacity})", "CONTEXT");
            }
        }

        /// <summary>
        /// Removes a resource from the context registry, resetting it first to unblock queues safely.
        /// </summary>
        /// <param name="resourceId">The target resource ID.</param>
        public bool UnregisterResource(string resourceId)
        {
            if (string.IsNullOrWhiteSpace(resourceId)) throw new ArgumentException("Resource ID cannot be empty.");

            lock (_lock)
            {
                if (_resources.TryRemove(resourceId, out var resource))
                {
                    resource.Reset();
                    LogTrace($"Unregistered resource: '{resource.Name}' (ID: {resourceId})", "CONTEXT");
                    return true;
                }
                return false;
            }
        }

        /// <summary>
        /// Proxies simulation trace messages cleanly to the infrastructure logging provider.
        /// </summary>
        public void LogTrace(string message, string category = "SIMULATION")
        {
            var logger = InfrastructureReference.Logger;
            if (logger != null)
            {
                logger.Trace(message, category);
            }
            else
            {
                Console.WriteLine($"[{DateTime.UtcNow:HH:mm:ss.fff}] [TRACE] [{category}] {message}");
            }
        }

        /// <summary>
        /// Resets all child clocks, registries, seeds, and lists.
        /// </summary>
        public void Reset()
        {
            lock (_lock)
            {
                State = SimulationState.Created;
                Clock.Reset();
                EventList.Clear();
                
                // Invoke OnDestroy on all currently registered entities
                foreach (var entity in _entities.Values)
                {
                    entity.OnDestroy(this);
                }
                _entities.Clear();

                // Reset resources
                foreach (var resource in _resources.Values)
                {
                    resource.Reset();
                }
                _resources.Clear();

                // Re-initialize random generator
                Rng.Initialize(Config.Seed);

                LogTrace("Simulation context successfully reset to initial states.", "CONTEXT");
            }
        }
    }
}
