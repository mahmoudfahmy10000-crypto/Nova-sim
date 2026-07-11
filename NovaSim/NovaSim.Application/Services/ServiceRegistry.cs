using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using NovaSim.Core.Enums;
using NovaSim.Core.Interfaces;

namespace NovaSim.Application.Services
{
    public class ServiceRegistry
    {
        private static readonly Lazy<ServiceRegistry> _instance = new(() => new ServiceRegistry());
        private readonly Dictionary<string, IService> _services = new();
        private readonly ILogger _logger;
        private readonly IEventBus _eventBus;

        private ServiceRegistry()
        {
            // By Clean Architecture design, we get instances dynamically or via dependency injection frameworks.
            // For bootstrap simplicity, we use singleton lookup references.
            _logger = InfrastructureReference.Logger;
            _eventBus = InfrastructureReference.EventBus;
        }

        public static ServiceRegistry Instance => _instance.Value;

        public void Register(IService service)
        {
            if (_services.ContainsKey(service.Id))
            {
                throw new InvalidOperationException($"ServiceRegistry Error: Service with ID '{service.Id}' is already registered.");
            }
            _services[service.Id] = service;
            _logger.Trace($"Registered service: {service.Name} ({service.Id})", "REGISTRY");
            _eventBus.Publish("service:registered", "REGISTRY", new { id = service.Id, name = service.Name });
        }

        public IService? Get(string id)
        {
            return _services.TryGetValue(id, out var service) ? service : null;
        }

        public IReadOnlyList<IService> GetServices()
        {
            return _services.Values.ToList().AsReadOnly();
        }

        public void ClearRegistry()
        {
            _services.Clear();
        }

        public List<IService> ResolveDependencyOrder()
        {
            var visited = new Dictionary<string, string>(); // "visiting", "visited"
            var ordered = new List<IService>();

            void Visit(string serviceId)
            {
                if (visited.TryGetValue(serviceId, out var state))
                {
                    if (state == "visiting")
                    {
                        throw new InvalidOperationException($"Circular Dependency Detected in service registration involving service: '{serviceId}'");
                    }
                    if (state == "visited") return;
                }

                visited[serviceId] = "visiting";

                if (!_services.TryGetValue(serviceId, out var service))
                {
                    throw new InvalidOperationException($"Missing Dependency Error: Service '{serviceId}' is not registered, but required.");
                }

                foreach (var depId in service.Dependencies)
                {
                    Visit(depId);
                }

                visited[serviceId] = "visited";
                ordered.Add(service);
            }

            foreach (var serviceId in _services.Keys)
            {
                if (!visited.ContainsKey(serviceId))
                {
                    Visit(serviceId);
                }
            }

            return ordered;
        }

        public async Task InitializeAllAsync()
        {
            var ordered = ResolveDependencyOrder();
            _logger.Info($"Initializing {ordered.Count} C# services in topological dependency order...", "REGISTRY");

            foreach (var service in ordered)
            {
                if (service.State != ServiceState.UNINITIALIZED)
                {
                    _logger.Warn($"Service '{service.Name}' is already in state {service.State}. Skipping init.", "REGISTRY");
                    continue;
                }

                _logger.Debug($"Initializing service: {service.Name}...", "REGISTRY");
                _eventBus.Publish("service:booting", "REGISTRY", new { id = service.Id, state = ServiceState.INITIALIZING });

                try
                {
                    await service.InitAsync();
                    _logger.Trace($"Service '{service.Name}' initialized successfully.", "REGISTRY");
                }
                catch (Exception ex)
                {
                    _logger.Error($"Failed to initialize service '{service.Name}': {ex.Message}", ex, "REGISTRY");
                    throw;
                }
            }
        }

        public async Task StartAllAsync()
        {
            var ordered = ResolveDependencyOrder();
            _logger.Info($"Starting {ordered.Count} C# services...", "REGISTRY");

            foreach (var service in ordered)
            {
                _logger.Debug($"Starting service: {service.Name}...", "REGISTRY");

                try
                {
                    await service.StartAsync();
                    _eventBus.Publish("service:running", "REGISTRY", new { id = service.Id, state = ServiceState.RUNNING });
                    _logger.Info($"Service '{service.Name}' is now RUNNING.", "REGISTRY");
                }
                catch (Exception ex)
                {
                    _logger.Fatal($"Failed to start service '{service.Name}': {ex.Message}", ex, "REGISTRY");
                    throw;
                }
            }
        }

        public async Task StopAllAsync()
        {
            var ordered = ResolveDependencyOrder().AsEnumerable().Reverse().ToList();
            _logger.Info($"Shutting down {ordered.Count} C# services in reverse order...", "REGISTRY");

            foreach (var service in ordered)
            {
                if (service.State == ServiceState.STOPPED || service.State == ServiceState.UNINITIALIZED)
                {
                    continue;
                }

                _logger.Debug($"Stopping service: {service.Name}...", "REGISTRY");

                try
                {
                    await service.StopAsync();
                    _eventBus.Publish("service:stopped", "REGISTRY", new { id = service.Id, state = ServiceState.STOPPED });
                    _logger.Info($"Service '{service.Name}' stopped successfully.", "REGISTRY");
                }
                catch (Exception ex)
                {
                    _logger.Error($"Error encountered while stopping service '{service.Name}': {ex.Message}", ex, "REGISTRY");
                }
            }
        }

        public async Task<Dictionary<string, ServiceHealth>> CheckSystemHealthAsync()
        {
            var reports = new Dictionary<string, ServiceHealth>();
            bool overallHealthy = true;

            foreach (var (id, service) in _services)
            {
                try
                {
                    var report = await service.HealthCheckAsync();
                    reports[id] = report;
                    if (report.Status != "healthy")
                    {
                        overallHealthy = false;
                    }
                }
                catch (Exception ex)
                {
                    reports[id] = new ServiceHealth("unhealthy", $"Healthcheck threw an exception: {ex.Message}", DateTime.UtcNow);
                    overallHealthy = false;
                }
            }

            _logger.Debug($"C# System health check completed. Overall status: {(overallHealthy ? "HEALTHY" : "DEGRADED")}", "HEALTH");
            _eventBus.Publish("health:check", "REGISTRY", new { healthy = overallHealthy, details = reports });

            return reports;
        }
    }

    /// <summary>
    /// Decoupling helper to resolve Infrastructure singletons without strict dependency loops.
    /// </summary>
    public static class InfrastructureReference
    {
        public static ILogger Logger { get; set; } = null!;
        public static IEventBus EventBus { get; set; } = null!;
        public static IConfigManager ConfigManager { get; set; } = null!;
    }
}
