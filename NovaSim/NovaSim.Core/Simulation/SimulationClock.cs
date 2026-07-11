using System;

namespace NovaSim.Core.Simulation
{
    /// <summary>
    /// Thread-safe double-precision simulation clock used to track virtual system time 
    /// and total processed simulation event steps.
    /// </summary>
    public class SimulationClock
    {
        private readonly object _lock = new();
        private double _currentTime;
        private long _stepCount;

        /// <summary>
        /// Gets the current virtual simulation time.
        /// </summary>
        public double CurrentTime
        {
            get
            {
                lock (_lock)
                {
                    return _currentTime;
                }
            }
        }

        /// <summary>
        /// Gets the total number of processed event steps.
        /// </summary>
        public long StepCount
        {
            get
            {
                lock (_lock)
                {
                    return _stepCount;
                }
            }
        }

        /// <summary>
        /// Advances the simulation clock to the target time.
        /// </summary>
        /// <param name="targetTime">The target timestamp to advance the clock to.</param>
        /// <exception cref="ArgumentException">Thrown if target time is less than current simulation time (temporal violation).</exception>
        public void AdvanceTo(double targetTime)
        {
            lock (_lock)
            {
                if (targetTime < _currentTime)
                {
                    throw new ArgumentException(
                        $"Temporal Violation: Cannot advance clock backward in time. " +
                        $"Current: {_currentTime}, Target: {targetTime}", 
                        nameof(targetTime));
                }

                _currentTime = targetTime;
                _stepCount++;
            }
        }

        /// <summary>
        /// Resets the clock time and step counter to zero.
        /// </summary>
        public void Reset()
        {
            lock (_lock)
            {
                _currentTime = 0.0;
                _stepCount = 0;
            }
        }
    }
}
