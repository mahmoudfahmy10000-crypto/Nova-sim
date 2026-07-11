using System;
using System.Threading.Tasks;
using NovaSim.Core.Enums;

namespace NovaSim.Core.Interfaces
{
    public record ServiceHealth(string Status, string Message, DateTime Timestamp, Dictionary<string, object>? Details = null);

    public interface IService
    {
        string Id { get; }
        string Name { get; }
        string[] Dependencies { get; }
        ServiceState State { get; }

        Task InitAsync();
        Task StartAsync();
        Task StopAsync();
        Task<ServiceHealth> HealthCheckAsync();
    }
}
