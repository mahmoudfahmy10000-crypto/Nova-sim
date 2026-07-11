using System;

namespace NovaSim.Core.Interfaces
{
    /// <summary>
    /// Contract for high-performance, deterministic, and seedable pseudo-random distribution generators
    /// critical for replicable engineering and queue-modeling simulations.
    /// </summary>
    public interface IRandomService
    {
        /// <summary>
        /// Reseed the random generator to a specific value to enforce deterministic execution.
        /// </summary>
        /// <param name="seed">The integer seed.</param>
        void Initialize(int seed);

        /// <summary>
        /// Generates a standard uniform random double between 0.0 (inclusive) and 1.0 (exclusive).
        /// </summary>
        double NextDouble();

        /// <summary>
        /// Generates a uniform real value within a specified range [min, max).
        /// </summary>
        double Uniform(double min, double max);

        /// <summary>
        /// Generates a value following an Exponential distribution with a given mean rate.
        /// Frequently used to model inter-arrival times or resource service durations.
        /// </summary>
        double Exponential(double mean);

        /// <summary>
        /// Generates a value following a Normal (Gaussian) distribution with a given mean and standard deviation.
        /// </summary>
        double Normal(double mean, double stdDev);

        /// <summary>
        /// Generates a value following a discrete Poisson distribution with a given lambda rate parameters.
        /// Useful for estimating discrete event counts in fixed intervals.
        /// </summary>
        int Poisson(double lambda);
    }
}
