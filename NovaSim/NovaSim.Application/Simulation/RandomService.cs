using System;
using NovaSim.Core.Interfaces;

namespace NovaSim.Application.Simulation
{
    /// <summary>
    /// Thread-safe random number generator supporting standard continuous and discrete probability distributions.
    /// Supports seeding to ensure deterministic results.
    /// </summary>
    public class RandomService : IRandomService
    {
        private readonly object _lock = new();
        private Random _rng;

        /// <summary>
        /// Initializes a new instance of the <see cref="RandomService"/> class.
        /// </summary>
        /// <param name="seed">Optional initial seed value. Defaults to 42.</param>
        public RandomService(int seed = 42)
        {
            _rng = new Random(seed);
        }

        /// <summary>
        /// Reseeds the underlying generator.
        /// </summary>
        public void Initialize(int seed)
        {
            lock (_lock)
            {
                _rng = new Random(seed);
            }
        }

        /// <summary>
        /// Generates a standard uniform real double between [0.0, 1.0).
        /// </summary>
        public double NextDouble()
        {
            lock (_lock)
            {
                return _rng.NextDouble();
            }
        }

        /// <summary>
        /// Generates a continuous uniform real double in range [min, max).
        /// </summary>
        public double Uniform(double min, double max)
        {
            if (min >= max)
                throw new ArgumentException("Min boundary must be less than Max boundary.");

            lock (_lock)
            {
                return min + (_rng.NextDouble() * (max - min));
            }
        }

        /// <summary>
        /// Generates an exponential continuous random double with the specified mean rate.
        /// Useful for modeling Poisson process inter-arrival times.
        /// </summary>
        public double Exponential(double mean)
        {
            if (mean <= 0.0)
                throw new ArgumentException("Exponential distribution mean must be greater than zero.", nameof(mean));

            lock (_lock)
            {
                // Inverse transform sampling: x = -mean * ln(1 - u)
                // u is standard uniform [0, 1)
                double u = _rng.NextDouble();
                
                // Avoid Math.Log(0) by guarding u
                while (u == 0.0)
                {
                    u = _rng.NextDouble();
                }

                return -mean * Math.Log(1.0 - u);
            }
        }

        /// <summary>
        /// Generates a normal (Gaussian) continuous random double with specified mean and standard deviation.
        /// Uses the Box-Muller polar coordinate transform.
        /// </summary>
        public double Normal(double mean, double stdDev)
        {
            if (stdDev < 0.0)
                throw new ArgumentException("Standard deviation cannot be negative.", nameof(stdDev));

            lock (_lock)
            {
                double u1 = _rng.NextDouble();
                double u2 = _rng.NextDouble();

                // Guard against ln(0)
                while (u1 == 0.0)
                {
                    u1 = _rng.NextDouble();
                }

                double randStdNormal = Math.Sqrt(-2.0 * Math.Log(u1)) * Math.Cos(2.0 * Math.PI * u2);
                return mean + (stdDev * randStdNormal);
            }
        }

        /// <summary>
        /// Generates a discrete Poisson random integer with parameter lambda (mean arrival count).
        /// Uses Knuth's multiplicative algorithm (effective for lambda < 30).
        /// For large lambda, falls back to normal approximation.
        /// </summary>
        public int Poisson(double lambda)
        {
            if (lambda <= 0.0)
                throw new ArgumentException("Poisson lambda parameter must be greater than zero.", nameof(lambda));

            lock (_lock)
            {
                if (lambda < 30.0)
                {
                    // Knuth's algorithm
                    double L = Math.Exp(-lambda);
                    int k = 0;
                    double p = 1.0;

                    do
                    {
                        k++;
                        p *= _rng.NextDouble();
                    } while (p > L && k < 10000); // Guard to prevent infinite loops

                    return k - 1;
                }
                else
                {
                    // Normal approximation for large lambda: Mean = lambda, StdDev = sqrt(lambda)
                    double normalVal = Normal(lambda, Math.Sqrt(lambda));
                    return Math.Max(0, (int)Math.Round(normalVal));
                }
            }
        }
    }
}
