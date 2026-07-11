using System;
using System.Diagnostics;
using System.Threading.Tasks;
using NovaSim.Core.Interfaces;
using NovaSim.Core.Simulation;

namespace NovaSim.Application.Simulation
{
    /// <summary>
    /// Thread-safe class responsible for coordinating, executing, and logging individual discrete simulation events.
    /// </summary>
    public class EventDispatcher : IEventDispatcher
    {
        /// <summary>
        /// Executes an event payload asynchronously under strict monitoring, capturing performance and logging statistics.
        /// </summary>
        /// <param name="event">The simulation event to execute.</param>
        /// <param name="context">The running simulation context.</param>
        public async Task DispatchAsync(SimulationEvent @event, ISimulationContext context)
        {
            if (@event == null) throw new ArgumentNullException(nameof(@event));
            if (context == null) throw new ArgumentNullException(nameof(context));

            string eventName = @event.GetType().Name;
            string entityMsg = @event.Entity != null ? $" (Entity: {@event.Entity.Name} [{@event.Entity.Id}])" : string.Empty;

            context.LogTrace(
                $"[DISPATCH] Processing event '{eventName}' scheduled at Time {@event.Time:F4}{entityMsg}. " +
                $"Current clock: {context.Clock.CurrentTime:F4}",
                "DISPATCHER");

            var watch = Stopwatch.StartNew();
            try
            {
                // Advance clock to the event's scheduled time
                context.Clock.AdvanceTo(@event.Time);

                // Execute the concrete event payload
                await @event.ExecuteAsync(context);

                watch.Stop();
                context.LogTrace(
                    $"[DISPATCH] Successfully processed event '{eventName}' in {watch.Elapsed.TotalMilliseconds:F3}ms.",
                    "DISPATCHER");
            }
            catch (Exception ex)
            {
                watch.Stop();
                context.LogTrace(
                    $"[ERROR] Fatal error during execution of event '{eventName}': {ex.Message} (Duration: {watch.Elapsed.TotalMilliseconds:F3}ms)",
                    "DISPATCHER");
                
                // Re-throw to allow the simulation controller to handle the failure and halt appropriately.
                throw;
            }
        }
    }
}
