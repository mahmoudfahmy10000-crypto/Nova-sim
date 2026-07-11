using System;
using System.Collections.Concurrent;

namespace NovaSim.Core.Simulation
{
    /// <summary>
    /// Base class representing a dynamic, discrete object or process in the simulation system.
    /// </summary>
    public abstract class Entity
    {
        /// <summary>
        /// Gets the unique identifier for the entity instance.
        /// </summary>
        public string Id { get; }

        /// <summary>
        /// Gets the human-readable descriptive name of the entity.
        /// </summary>
        public string Name { get; }

        /// <summary>
        /// Gets the simulation clock timestamp when this entity was instantiated and registered.
        /// </summary>
        public double CreationTime { get; }

        /// <summary>
        /// Gets a high-performance concurrent attribute map representing key-value parameters belonging to the entity.
        /// </summary>
        public ConcurrentDictionary<string, object> Attributes { get; }

        /// <summary>
        /// Initializes a new instance of the <see cref="Entity"/> base class.
        /// </summary>
        /// <param name="id">The unique identifier for the entity.</param>
        /// <param name="name">The descriptive name of the entity.</param>
        /// <param name="creationTime">The simulation timestamp when this entity entered the system.</param>
        protected Entity(string id, string name, double creationTime)
        {
            if (string.IsNullOrWhiteSpace(id))
                throw new ArgumentException("Entity ID cannot be null or empty.", nameof(id));

            Id = id;
            Name = name ?? id;
            CreationTime = creationTime;
            Attributes = new ConcurrentDictionary<string, object>();
        }

        /// <summary>
        /// Lifecycle hook invoked when the entity is registered within a simulation context.
        /// </summary>
        /// <param name="context">The active simulation context.</param>
        public virtual void OnInit(object context)
        {
            // Virtual placeholder for child customization
        }

        /// <summary>
        /// Lifecycle hook invoked when the entity is removed or destroyed within a simulation context.
        /// </summary>
        /// <param name="context">The active simulation context.</param>
        public virtual void OnDestroy(object context)
        {
            // Virtual placeholder for child customization
        }
    }
}
