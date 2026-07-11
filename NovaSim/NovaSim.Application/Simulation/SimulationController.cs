using System;
using System.Diagnostics;
using System.Threading;
using System.Threading.Tasks;
using NovaSim.Core.Enums;
using NovaSim.Core.Interfaces;
using NovaSim.Core.Simulation;

namespace NovaSim.Application.Simulation
{
    /// <summary>
    /// Thread-safe controller responsible for driving the main asynchronous discrete-event simulation run loop.
    /// Manages execution flows, real-time wall-clock sync speed, step-by-step executions, and lifecycle events.
    /// </summary>
    public class SimulationController : ISimulationController
    {
        private readonly object _stateLock = new();
        private SimulationContext? _context;
        private CancellationTokenSource? _cts;
        private TaskCompletionSource<bool>? _runTaskCompletion;
        private readonly Stopwatch _realtimeStopwatch = new();
        private double _realtimeVirtualPauseTimeOffset;

        /// <summary>
        /// Gets the active runtime simulation context.
        /// </summary>
        public ISimulationContext Context
        {
            get
            {
                if (_context == null)
                {
                    throw new InvalidOperationException("SimulationController is not initialized. Call Initialize() first.");
                }
                return _context;
            }
        }

        /// <summary>
        /// Invoked when the simulation state transitions.
        /// </summary>
        public event Action<SimulationState>? OnStateChanged;

        /// <summary>
        /// Invoked immediately after an event has been processed.
        /// </summary>
        public event Action<SimulationEvent>? OnEventProcessed;

        /// <summary>
        /// Invoked when the simulation loop completes or halts.
        /// </summary>
        public event Action<SimulationState, Exception?>? OnFinished;

        /// <summary>
        /// Configures the controller with a configuration profile, creating a fresh simulation context.
        /// </summary>
        /// <param name="config">The target configuration parameters.</param>
        public void Initialize(SimulationConfig config)
        {
            if (config == null) throw new ArgumentNullException(nameof(config));

            lock (_stateLock)
            {
                _context = new SimulationContext(config);
                _realtimeStopwatch.Reset();
                _realtimeVirtualPauseTimeOffset = 0.0;
                TransitionToState(SimulationState.Created);
            }
        }

        /// <summary>
        /// Starts or resumes the asynchronous simulation execution loop.
        /// </summary>
        public async Task RunAsync()
        {
            if (_context == null)
            {
                throw new InvalidOperationException("Cannot start simulation: Controller is not initialized.");
            }

            lock (_stateLock)
            {
                if (_context.State == SimulationState.Running)
                {
                    return; // Already running
                }

                if (_context.State == SimulationState.Completed || _context.State == SimulationState.Stopped)
                {
                    _context.Reset();
                }

                _cts = new CancellationTokenSource();
                _runTaskCompletion = new TaskCompletionSource<bool>();
                
                if (_context.Config.Mode == ExecutionMode.Realtime)
                {
                    _realtimeStopwatch.Start();
                }

                TransitionToState(SimulationState.Running);
            }

            // Launch run loop on background thread pool to prevent blocking UI/calling threads
            _ = Task.Run(() => ExecuteLoopAsync(_cts.Token));

            await _runTaskCompletion.Task;
        }

        /// <summary>
        /// Suspends the simulation run loop safely, maintaining the current event queues and clock timestamp.
        /// </summary>
        public void Pause()
        {
            lock (_stateLock)
            {
                if (_context == null || _context.State != SimulationState.Running)
                {
                    return;
                }

                _cts?.Cancel();
                if (_context.Config.Mode == ExecutionMode.Realtime)
                {
                    _realtimeStopwatch.Stop();
                }

                TransitionToState(SimulationState.Paused);
                _runTaskCompletion?.TrySetResult(true);
            }
        }

        /// <summary>
        /// Terminates simulation execution, clearing all future events and resetting states.
        /// </summary>
        public void Stop()
        {
            lock (_stateLock)
            {
                if (_context == null) return;

                _cts?.Cancel();
                _realtimeStopwatch.Reset();
                _realtimeVirtualPauseTimeOffset = 0.0;

                TransitionToState(SimulationState.Stopped);
                _context.EventList.Clear();
                _runTaskCompletion?.TrySetResult(true);
                
                OnFinished?.Invoke(SimulationState.Stopped, null);
            }
        }

        /// <summary>
        /// Processes a single earliest scheduled event, advances clock, and pauses.
        /// </summary>
        /// <returns>True if an event was processed; False if the event list was empty.</returns>
        public async Task<bool> StepAsync()
        {
            if (_context == null)
            {
                throw new InvalidOperationException("Controller is not initialized.");
            }

            lock (_stateLock)
            {
                if (_context.State == SimulationState.Running)
                {
                    throw new InvalidOperationException("Cannot step manually while the simulation is actively running.");
                }
            }

            if (_context.EventList.Count == 0)
            {
                Context.LogTrace("[STEP] Attempted step but Future Event List is empty.", "CONTROLLER");
                lock (_stateLock)
                {
                    TransitionToState(SimulationState.Completed);
                }
                OnFinished?.Invoke(SimulationState.Completed, null);
                return false;
            }

            var ev = _context.EventList.Dequeue();

            // Guard: Check if event violates the configured EndTime bounds
            if (ev.Time > _context.Config.EndTime)
            {
                _context.LogTrace($"[STEP] Next event '{ev.GetType().Name}' at time {ev.Time:F4} exceeds EndTime {_context.Config.EndTime:F4}. Simulation finished.", "CONTROLLER");
                lock (_stateLock)
                {
                    TransitionToState(SimulationState.Completed);
                }
                OnFinished?.Invoke(SimulationState.Completed, null);
                return false;
            }

            try
            {
                await _context.Dispatcher.DispatchAsync(ev, _context);
                OnEventProcessed?.Invoke(ev);
                return true;
            }
            catch (Exception ex)
            {
                Context.LogTrace($"[STEP-ERROR] Simulation crashed during manual step: {ex.Message}", "CONTROLLER");
                lock (_stateLock)
                {
                    TransitionToState(SimulationState.Stopped);
                }
                OnFinished?.Invoke(SimulationState.Stopped, ex);
                throw;
            }
        }

        /// <summary>
        /// Main core loop processing popped events from Future Event List sequentially.
        /// </summary>
        private async Task ExecuteLoopAsync(CancellationToken token)
        {
            Exception? terminationException = null;
            SimulationState finalState = SimulationState.Completed;

            try
            {
                while (!token.IsCancellationRequested)
                {
                    // 1. Step-by-Step validation
                    if (_context!.Config.Mode == ExecutionMode.StepByStep)
                    {
                        Pause();
                        break;
                    }

                    // 2. Queue empty termination
                    if (_context.EventList.Count == 0)
                    {
                        _context.LogTrace("[LOOP] Future Event List is empty. Run completed successfully.", "CONTROLLER");
                        finalState = SimulationState.Completed;
                        break;
                    }

                    // Peek to evaluate boundaries
                    var nextEvent = _context.EventList.Peek();
                    if (nextEvent == null) break;

                    // 3. Time bounds termination
                    if (nextEvent.Time > _context.Config.EndTime)
                    {
                        _context.LogTrace($"[LOOP] Next event time {nextEvent.Time:F4} exceeds limit EndTime {_context.Config.EndTime:F4}. Simulation completed.", "CONTROLLER");
                        finalState = SimulationState.Completed;
                        break;
                    }

                    // 4. Real-time Synchronization Delay
                    if (_context.Config.Mode == ExecutionMode.Realtime)
                    {
                        double virtualElapsedTime = nextEvent.Time - _context.Config.StartTime;
                        double realElapsedTime = _realtimeStopwatch.Elapsed.TotalSeconds * _context.Config.RealtimeScale;

                        if (virtualElapsedTime > realElapsedTime)
                        {
                            double delaySecs = (virtualElapsedTime - realElapsedTime) / _context.Config.RealtimeScale;
                            int delayMs = (int)(delaySecs * 1000);

                            if (delayMs > 0)
                            {
                                try
                                {
                                    await Task.Delay(delayMs, token);
                                }
                                catch (TaskCanceledException)
                                {
                                    // Loop cancelled during real-time sync pause sleep
                                    break;
                                }
                            }
                        }
                    }

                    // Dequeue the sorted target event
                    var ev = _context.EventList.Dequeue();

                    // 5. Dispatch Event
                    try
                    {
                        await _context.Dispatcher.DispatchAsync(ev, _context);
                        OnEventProcessed?.Invoke(ev);
                    }
                    catch (Exception ex)
                    {
                        _context.LogTrace($"[CRITICAL] Run loop aborted due to unhandled event exception: {ex.Message}", "CONTROLLER");
                        terminationException = ex;
                        finalState = SimulationState.Stopped;
                        break;
                    }
                }
            }
            catch (Exception ex)
            {
                _context!.LogTrace($"[LOOP-ERROR] Unexpected exception occurred in simulation loop: {ex.Message}", "CONTROLLER");
                terminationException = ex;
                finalState = SimulationState.Stopped;
            }
            finally
            {
                lock (_stateLock)
                {
                    // Check if halted naturally rather than canceled/paused
                    if (!token.IsCancellationRequested || finalState == SimulationState.Stopped)
                    {
                        if (_context!.Config.Mode == ExecutionMode.Realtime)
                        {
                            _realtimeStopwatch.Stop();
                        }
                        TransitionToState(finalState);
                        _runTaskCompletion?.TrySetResult(true);
                        OnFinished?.Invoke(finalState, terminationException);
                    }
                }
            }
        }

        private void TransitionToState(SimulationState newState)
        {
            if (_context == null) return;

            var oldState = _context.State;
            if (oldState == newState) return;

            _context.State = newState;
            _context.LogTrace($"State transition: '{oldState}' ===> '{newState}'", "CONTROLLER");
            OnStateChanged?.Invoke(newState);
        }
    }
}
