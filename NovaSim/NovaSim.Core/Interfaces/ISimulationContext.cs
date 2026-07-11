using System;
using System.Collections.Generic;
using NovaSim.Core.Enums;
using NovaSim.Core.Simulation;

namespace NovaSim.Core.Interfaces
{
    /// <summary>
    /// Represents the full runtime environment of an active simulation execution, 
    /// exposing all core utilities, registries, and state attributes.
    /// </summary>
    public interface ISimulationContext
    {
        /// <summary>
        /// Gets the virtual simulation clock.
        /// </summary>
        SimulationClock Clock { get; }

        /// <summary>
        /// Gets the Future Event List priority queue managing scheduled events.
        /// </summary>
        FutureEventList EventList { get; }

        /// <summary>
        /// Gets the scheduler utility used to enqueue events.
        /// </summary>
        IEventScheduler Scheduler { get; }

        /// <summary>
        /// Gets the event dispatcher executing events.
        /// </summary>
        IEventDispatcher Dispatcher { get; }

        /// <summary>
        /// Gets the pseudo-random distribution service.
        /// </summary>
        IRandomService Rng { get; }

        /// <summary>
        /// Gets the configuration rules set for the run.
        /// </summary>
        SimulationConfig Config { get; }

        /// <summary>
        /// Gets the current state of the simulation engine.
        /// </summary>
        SimulationState State { get; }

        /// <summary>
        /// Gets a read-only dictionary of registered active simulation entities.
        /// </summary>
        IReadOnlyDictionary<string, Entity> Entities { get; }

        /// <summary>
        /// Gets a read-only dictionary of registered active simulation resources.
        /// </summary>
        IReadOnlyDictionary<string, Resource> Resources { get; }

        /// <summary>
        /// Registers a new entity into the simulation environment.
        /// </summary>
        /// <param name="entity">The entity to register.</param>
        void RegisterEntity(Entity entity);

        /// <summary>
        /// Removes an entity from the simulation registry.
        /// </summary>
        /// <param name="entityId">The unique ID of the target entity.</param>
        /// <returns>True if the entity was found and removed; False otherwise.</returns>
        bool UnregisterEntity(string entityId);

        /// <summary>
        /// Registers a shared capacity-constrained resource into the simulation registry.
        /// </summary>
        /// <param name="resource">The resource to register.</param>
        void RegisterResource(Resource resource);

        /// <summary>
        /// Removes a resource from the simulation registry.
        /// </summary>
        /// <param name="resourceId">The unique ID of the target resource.</param>
        /// <returns>True if the resource was found and removed; False otherwise.</returns>
        bool UnregisterResource(string resourceId);

        /// <summary>
        /// Dispatches a trace/logging log to the infrastructure logger context.
        /// </summary>
        void LogTrace(string message, string category = "SIMULATION");

        /// <summary>
        /// Resets the full context to standard initial states.
        /// </summary>
        void Reset();
    }
}
