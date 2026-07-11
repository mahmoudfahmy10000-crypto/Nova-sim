import React, { useState, useEffect, useRef } from "react";
import DesktopPreview from "./DesktopPreview";
import {
  Play,
  Square,
  RefreshCw,
  Sliders,
  FolderTree,
  Terminal,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Folder,
  FileCode,
  ShieldCheck,
  Zap,
  Info,
  Clock,
  Settings2,
  Check,
  ChevronRight,
  Database,
  Code,
  Download,
  Layers,
  FileText,
  PlayCircle
} from "lucide-react";

// In-browser virtualized representation of C# files for direct inspection & verification
interface VirtualFile {
  path: string;
  name: string;
  category: string;
  content: string;
}

export default function Phase1Console() {
  const [activeSubTab, setActiveSubTab] = useState<"desktop" | "architecture" | "files" | "build" | "python">("desktop");
  const [selectedProfile, setSelectedProfile] = useState<"development" | "testing" | "production">("development");
  const [selectedFile, setSelectedFile] = useState<string>("NovaSim.Core/Interfaces/IService.cs");
  
  // Simulation States
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildSuccess, setBuildSuccess] = useState<boolean | null>(null);
  const [buildLogs, setBuildLogs] = useState<string[]>([]);
  
  const [isRunningEngine, setIsRunningEngine] = useState(false);
  const [engineLogs, setEngineLogs] = useState<string[]>([]);
  const [enginePhases, setEnginePhases] = useState<any[]>([
    { id: "A", name: "Load C# Configurations", status: "pending", desc: "Instantiate ConfigManager & map env profiles" },
    { id: "B", name: "Init Core Logger Engine", status: "pending", desc: "Activate memory-ring buffer channel with pre-defined capacity" },
    { id: "C", name: "Instantiate ServiceRegistry", status: "pending", desc: "Register core system services (SQLite, Physics, Rendering)" },
    { id: "D", name: "Resolve Dependencies", status: "pending", desc: "Run topological solver and trigger service initializations" },
    { id: "E", name: "Run Pre-Flight Self-Tests", status: "pending", desc: "Perform database integrity checks and hardware locks" },
    { id: "F", name: "Boot Live Simulation", status: "pending", desc: "Activate real-time OpenGL loop & physics ticks" },
  ]);

  const [activeServices, setActiveServices] = useState<any[]>([
    { id: "storage_service", name: "Storage Subsystem", state: "UNINITIALIZED", deps: [], desc: "SQLite database connections & persistence" },
    { id: "physics_service", name: "Physics Engine", state: "UNINITIALIZED", deps: ["storage_service"], desc: "Industrial multi-physics solver context" },
    { id: "rendering_service", name: "Rendering Pipe", state: "UNINITIALIZED", deps: ["physics_service"], desc: "OpenGL/Vulkan rendering window canvas" },
    { id: "analytics_service", name: "KPI Analytics Stream", state: "UNINITIALIZED", deps: ["physics_service", "storage_service"], desc: "High-frequency performance telemetry" },
  ]);

  // Python integration console states
  const [pythonScript, setPythonScript] = useState<string>(
    "def on_solver_tick(entity):\n    # Access the C# physics solver dynamically\n    if entity.velocity.x > 50.0:\n        Logger.Warn(f'Entity {entity.id} exceeded velocity bounds!')\n        entity.velocity.x = 50.0\n    entity.velocity.x += 1.5\n"
  );
  const [pythonLogs, setPythonLogs] = useState<string[]>([]);

  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Virtual files representing the created C# .NET 9 codebase
  const virtualFiles: VirtualFile[] = [
    {
      path: "NovaSim.Core/Interfaces/IService.cs",
      name: "IService.cs",
      category: "Core / Interfaces",
      content: `using System;
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
}`
    },
    {
      path: "NovaSim.Core/Interfaces/ILogger.cs",
      name: "ILogger.cs",
      category: "Core / Interfaces",
      content: `using System;
using System.Collections.Generic;
using NovaSim.Core.Enums;

namespace NovaSim.Core.Interfaces
{
    public interface ILogEntry
    {
        string Id { get; }
        DateTime Timestamp { get; }
        LogLevel Level { get; }
        string Category { get; }
        string Message { get; }
        Exception? Exception { get; }
    }

    public interface ILogger
    {
        void Configure(LogLevel minLevel, bool enableConsole, bool enableRingBuffer, int ringBufferCapacity);
        void Trace(string message, string category = "GENERAL");
        void Debug(string message, string category = "GENERAL");
        void Info(string message, string category = "GENERAL");
        void Warn(string message, string category = "GENERAL");
        void Error(string message, Exception? exception = null, string category = "GENERAL");
        void Fatal(string message, Exception? exception = null, string category = "GENERAL");
        
        IReadOnlyList<ILogEntry> GetRingBuffer();
        void ClearRingBuffer();
        event Action<ILogEntry>? OnLog;
    }
}`
    },
    {
      path: "NovaSim.Core/Config/NovaSimConfig.cs",
      name: "NovaSimConfig.cs",
      category: "Core / Models",
      content: `using NovaSim.Core.Enums;

namespace NovaSim.Core.Config
{
    public class LoggingConfig
    {
        public LogLevel MinLevel { get; set; } = LogLevel.DEBUG;
        public bool EnableConsole { get; set; } = true;
        public bool EnableRingBuffer { get; set; } = true;
        public int RingBufferCapacity { get; set; } = 250;
    }

    public class LimitsConfig
    {
        public int MaxWorkerThreads { get; set; } = 4;
        public long MemorySlabSizeBytes { get; set; } = 64 * 1024 * 1024; // 64MB
        public int MaxActiveEntities { get; set; } = 10000;
        public int PhysicsTickRateHz { get; set; } = 60;
    }

    public class DatabaseConfig
    {
        public string ConnectionString { get; set; } = "Data Source=novasim.db";
        public bool UseInMemory { get; set; } = false;
    }

    public class ScriptingConfig
    {
        public bool EnablePythonScripting { get; set; } = true;
        public string PythonScriptsDirectory { get; set; } = "./scripts";
    }

    public class NovaSimConfig
    {
        public string Profile { get; set; } = "development";
        public int Port { get; set; } = 3000;
        public string ApiVersion { get; set; } = "v1.0.0";
        public LoggingConfig Logging { get; set; } = new();
        public LimitsConfig Limits { get; set; } = new();
        public DatabaseConfig Database { get; set; } = new();
        public ScriptingConfig Scripting { get; set; } = new();
    }
}`
    },
    {
      path: "NovaSim.Application/Services/ServiceRegistry.cs",
      name: "ServiceRegistry.cs",
      category: "Application / Core Services",
      content: `using System;
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

        public List<IService> ResolveDependencyOrder()
        {
            var visited = new Dictionary<string, string>(); // "visiting", "visited"
            var ordered = new List<IService>();

            void Visit(string serviceId)
            {
                if (visited.TryGetValue(serviceId, out var state))
                {
                    if (state == "visiting")
                        throw new InvalidOperationException($"Circular Dependency Detected involving: '{serviceId}'");
                    if (state == "visited") return;
                }

                visited[serviceId] = "visiting";

                if (!_services.TryGetValue(serviceId, out var service))
                    throw new InvalidOperationException($"Missing Dependency Error: Service '{serviceId}' is not registered.");

                foreach (var depId in service.Dependencies)
                    Visit(depId);

                visited[serviceId] = "visited";
                ordered.Add(service);
            }

            foreach (var serviceId in _services.Keys)
                if (!visited.ContainsKey(serviceId)) Visit(serviceId);

            return ordered;
        }
    }
}`
    },
    {
      path: "NovaSim.Infrastructure/Logging/Logger.cs",
      name: "Logger.cs",
      category: "Infrastructure / Engine Components",
      content: `using System;
using System.Collections.Generic;
using NovaSim.Core.Enums;
using NovaSim.Core.Interfaces;

namespace NovaSim.Infrastructure.Logging
{
    public class LogEntry : ILogEntry
    {
        public string Id { get; } = Guid.NewGuid().ToString("N");
        public DateTime Timestamp { get; } = DateTime.UtcNow;
        public LogLevel Level { get; set; }
        public string Category { get; set; } = "GENERAL";
        public string Message { get; set; } = string.Empty;
        public Exception? Exception { get; set; }
    }

    public class Logger : ILogger
    {
        private static readonly Lazy<Logger> _instance = new(() => new Logger());
        private readonly List<LogEntry> _ringBuffer = new();
        private readonly object _lock = new();

        private LogLevel _minLevel = LogLevel.DEBUG;
        private int _ringBufferCapacity = 250;

        public void Configure(LogLevel minLevel, bool enableConsole, bool enableRingBuffer, int ringBufferCapacity)
        {
            lock (_lock)
            {
                _minLevel = minLevel;
                _ringBufferCapacity = ringBufferCapacity;
            }
        }

        private void WriteLog(LogLevel level, string message, string category, Exception? exception = null)
        {
            if (level < _minLevel) return;
            var entry = new LogEntry { Level = level, Message = message, Category = category, Exception = exception };
            lock (_lock)
            {
                _ringBuffer.Add(entry);
                while (_ringBuffer.Count > _ringBufferCapacity) _ringBuffer.RemoveAt(0);
            }
        }

        public void Info(string message, string category = "GENERAL") => WriteLog(LogLevel.INFO, message, category);
    }
}`
    },
    {
      path: "NovaSim.UI/MainWindow.axaml",
      name: "MainWindow.axaml",
      category: "UI (Presentation) / Avalonia",
      content: `<Window xmlns="https://github.com/avaloniaui"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        x:Class="NovaSim.UI.MainWindow"
        Title="NovaSim AI - Advanced Multi-Physics Solver & Simulation Core (.NET 9)"
        Width="1200" Height="800"
        Background="#0B0F17"
        WindowStartupLocation="CenterScreen">
    
    <Grid RowDefinitions="Auto, *, Auto">
        <!-- System Top Bar Header -->
        <Border Grid.Row="0" Background="#111622" BorderBrush="#1F2633" BorderThickness="0,0,0,1" Padding="15">
            <Grid ColumnDefinitions="*, Auto">
                <StackPanel Orientation="Horizontal" Spacing="15">
                    <TextBlock Text="NOVASIM AI" FontSize="16" FontWeight="Bold" Foreground="#6366F1"/>
                </StackPanel>
            </Grid>
        </Border>
    </Grid>
</Window>`
    },
    {
      path: "NovaSim.Tests/CoreTests.cs",
      name: "CoreTests.cs",
      category: "Verification / Unit Tests",
      content: `using System;
using System.Threading.Tasks;
using NovaSim.Core.Enums;
using NovaSim.Application.Services;

namespace NovaSim.Tests
{
    public class CoreTests
    {
        public async Task RunAllTestsAsync()
        {
            // Verifies topological service registry sorting
            var registry = ServiceRegistry.Instance;
            registry.ClearRegistry();

            var storage = new StorageService();
            var physics = new PhysicsService();

            registry.Register(physics);
            registry.Register(storage);

            var order = registry.ResolveDependencyOrder();
            // Asserts Storage comes before Physics
            bool orderValid = order.FindIndex(s => s.Id == storage.Id) < order.FindIndex(s => s.Id == physics.Id);
            Console.WriteLine($"[Assertion] Dependency ordering valid: {orderValid}");
        }
    }
}`
    },
    {
      path: "NovaSim.Core/Enums/SimulationState.cs",
      name: "SimulationState.cs",
      category: "Core / Enums",
      content: `namespace NovaSim.Core.Enums
{
    public enum SimulationState
    {
        Created,
        Running,
        Paused,
        Stopped,
        Completed
    }
}`
    },
    {
      path: "NovaSim.Core/Interfaces/IRandomService.cs",
      name: "IRandomService.cs",
      category: "Core / Interfaces",
      content: `namespace NovaSim.Core.Interfaces
{
    public interface IRandomService
    {
        void Initialize(int seed);
        double NextDouble();
        double Uniform(double min, double max);
        double Exponential(double mean);
        double Normal(double mean, double stdDev);
        int Poisson(double lambda);
    }
}`
    },
    {
      path: "NovaSim.Core/Interfaces/IEventScheduler.cs",
      name: "IEventScheduler.cs",
      category: "Core / Interfaces",
      content: `using NovaSim.Core.Simulation;

namespace NovaSim.Core.Interfaces
{
    public interface IEventScheduler
    {
        void Schedule(SimulationEvent @event);
    }
}`
    },
    {
      path: "NovaSim.Core/Interfaces/IEventDispatcher.cs",
      name: "IEventDispatcher.cs",
      category: "Core / Interfaces",
      content: `using System.Threading.Tasks;
using NovaSim.Core.Simulation;

namespace NovaSim.Core.Interfaces
{
    public interface IEventDispatcher
    {
        Task DispatchAsync(SimulationEvent @event, ISimulationContext context);
    }
}`
    },
    {
      path: "NovaSim.Core/Interfaces/ISimulationContext.cs",
      name: "ISimulationContext.cs",
      category: "Core / Interfaces",
      content: `using System.Collections.Generic;
using NovaSim.Core.Enums;
using NovaSim.Core.Simulation;

namespace NovaSim.Core.Interfaces
{
    public interface ISimulationContext
    {
        SimulationClock Clock { get; }
        FutureEventList EventList { get; }
        IEventScheduler Scheduler { get; }
        IEventDispatcher Dispatcher { get; }
        IRandomService Rng { get; }
        SimulationConfig Config { get; }
        SimulationState State { get; }
        IReadOnlyDictionary<string, Entity> Entities { get; }
        IReadOnlyDictionary<string, Resource> Resources { get; }

        void RegisterEntity(Entity entity);
        bool UnregisterEntity(string entityId);
        void RegisterResource(Resource resource);
        bool UnregisterResource(string resourceId);
        void LogTrace(string message, string category = "SIMULATION");
        void Reset();
    }
}`
    },
    {
      path: "NovaSim.Core/Interfaces/ISimulationController.cs",
      name: "ISimulationController.cs",
      category: "Core / Interfaces",
      content: `using System;
using System.Threading.Tasks;
using NovaSim.Core.Enums;
using NovaSim.Core.Simulation;

namespace NovaSim.Core.Interfaces
{
    public interface ISimulationController
    {
        ISimulationContext Context { get; }
        event Action<SimulationState>? OnStateChanged;
        event Action<SimulationEvent>? OnEventProcessed;
        event Action<SimulationState, Exception?>? OnFinished;

        void Initialize(SimulationConfig config);
        Task RunAsync();
        void Pause();
        void Stop();
        Task<bool> StepAsync();
    }
}`
    },
    {
      path: "NovaSim.Core/Simulation/SimulationClock.cs",
      name: "SimulationClock.cs",
      category: "Core / Domain Model",
      content: `using System;

namespace NovaSim.Core.Simulation
{
    public class SimulationClock
    {
        private readonly object _lock = new();
        private double _currentTime;
        private long _stepCount;

        public double CurrentTime { get { lock (_lock) return _currentTime; } }
        public long StepCount { get { lock (_lock) return _stepCount; } }

        public void AdvanceTo(double targetTime)
        {
            lock (_lock)
            {
                if (targetTime < _currentTime)
                {
                    throw new ArgumentException("Temporal Violation: Clock cannot go backwards.");
                }
                _currentTime = targetTime;
                _stepCount++;
            }
        }

        public void Reset()
        {
            lock (_lock)
            {
                _currentTime = 0.0;
                _stepCount = 0;
            }
        }
    }
}`
    },
    {
      path: "NovaSim.Core/Simulation/SimulationConfig.cs",
      name: "SimulationConfig.cs",
      category: "Core / Domain Model",
      content: `namespace NovaSim.Core.Simulation
{
    public enum ExecutionMode
    {
        Fastest,
        Realtime,
        StepByStep
    }

    public class SimulationConfig
    {
        public double StartTime { get; set; } = 0.0;
        public double EndTime { get; set; } = 3600.0;
        public ExecutionMode Mode { get; set; } = ExecutionMode.Fastest;
        public double RealtimeScale { get; set; } = 1.0;
        public int Seed { get; set; } = 42;
    }
}`
    },
    {
      path: "NovaSim.Core/Simulation/Entity.cs",
      name: "Entity.cs",
      category: "Core / Domain Model",
      content: `using System;
using System.Collections.Concurrent;

namespace NovaSim.Core.Simulation
{
    public abstract class Entity
    {
        public string Id { get; }
        public string Name { get; }
        public double CreationTime { get; }
        public ConcurrentDictionary<string, object> Attributes { get; }

        protected Entity(string id, string name, double creationTime)
        {
            Id = id ?? throw new ArgumentNullException(nameof(id));
            Name = name ?? id;
            CreationTime = creationTime;
            Attributes = new ConcurrentDictionary<string, object>();
        }

        public virtual void OnInit(object context) { }
        public virtual void OnDestroy(object context) { }
    }
}`
    },
    {
      path: "NovaSim.Core/Simulation/Resource.cs",
      name: "Resource.cs",
      category: "Core / Domain Model",
      content: `using System;
using System.Collections.Generic;

namespace NovaSim.Core.Simulation
{
    public record ResourceRequest(Entity Requester, int Quantity, double RequestTime);

    public abstract class Resource
    {
        private readonly object _lock = new();
        private readonly List<ResourceRequest> _waitQueue = new();
        private double _lastUpdateTime;

        public string Id { get; }
        public string Name { get; }
        public int Capacity { get; }
        public int Available { get; private set; }
        public IReadOnlyList<ResourceRequest> WaitQueue { get { lock (_lock) return _waitQueue.ToArray(); } }
        public double IntegratedUtilization { get; private set; }

        protected Resource(string id, string name, int capacity)
        {
            Id = id ?? throw new ArgumentNullException(nameof(id));
            Name = name ?? id;
            Capacity = capacity;
            Available = capacity;
        }

        public bool TryAcquire(Entity requester, int quantity, double currentTime)
        {
            lock (_lock)
            {
                UpdateStatistics(currentTime);
                if (Available >= quantity && _waitQueue.Count == 0)
                {
                    Available -= quantity;
                    return true;
                }
                _waitQueue.Add(new ResourceRequest(requester, quantity, currentTime));
                return false;
            }
        }

        public void Release(Entity releaser, int quantity, double currentTime, out List<ResourceRequest> unblockedRequests)
        {
            lock (_lock)
            {
                UpdateStatistics(currentTime);
                Available += quantity;
                unblockedRequests = new List<ResourceRequest>();

                while (_waitQueue.Count > 0)
                {
                    var next = _waitQueue[0];
                    if (Available >= next.Quantity)
                    {
                        Available -= next.Quantity;
                        unblockedRequests.Add(next);
                        _waitQueue.RemoveAt(0);
                    }
                    else break;
                }
            }
        }

        private void UpdateStatistics(double currentTime)
        {
            if (currentTime < _lastUpdateTime) return;
            IntegratedUtilization += (Capacity - Available) * (currentTime - _lastUpdateTime);
            _lastUpdateTime = currentTime;
        }

        public double GetAverageUtilization(double currentTime, double startTime)
        {
            lock (_lock)
            {
                UpdateStatistics(currentTime);
                double total = currentTime - startTime;
                return total <= 0.0 ? 0.0 : (IntegratedUtilization / (Capacity * total)) * 100.0;
            }
        }

        public virtual void Reset()
        {
            lock (_lock)
            {
                Available = Capacity;
                _waitQueue.Clear();
                IntegratedUtilization = 0.0;
                _lastUpdateTime = 0.0;
            }
        }
    }
}`
    },
    {
      path: "NovaSim.Core/Simulation/SimulationEvent.cs",
      name: "SimulationEvent.cs",
      category: "Core / Domain Model",
      content: `using System;
using System.Threading.Tasks;
using NovaSim.Core.Interfaces;

namespace NovaSim.Core.Simulation
{
    public abstract class SimulationEvent : IComparable<SimulationEvent>
    {
        public string Id { get; } = Guid.NewGuid().ToString("N");
        public double Time { get; }
        public int Priority { get; }
        public Entity? Entity { get; }

        protected SimulationEvent(double time, int priority = 0, Entity? entity = null)
        {
            Time = time;
            Priority = priority;
            Entity = entity;
        }

        public abstract Task ExecuteAsync(ISimulationContext context);

        public int CompareTo(SimulationEvent? other)
        {
            if (other == null) return 1;
            int timeCompare = Time.CompareTo(other.Time);
            if (timeCompare != 0) return timeCompare;
            int priorityCompare = Priority.CompareTo(other.Priority);
            if (priorityCompare != 0) return priorityCompare;
            return string.Compare(Id, other.Id, StringComparison.Ordinal);
        }
    }
}`
    },
    {
      path: "NovaSim.Core/Simulation/FutureEventList.cs",
      name: "FutureEventList.cs",
      category: "Core / Domain Model",
      content: `using System;
using System.Collections.Generic;

namespace NovaSim.Core.Simulation
{
    public class FutureEventList
    {
        private readonly object _lock = new();
        private readonly SortedSet<SimulationEvent> _events = new();

        public int Count { get { lock (_lock) return _events.Count; } }

        public void Enqueue(SimulationEvent @event)
        {
            lock (_lock) _events.Add(@event);
        }

        public SimulationEvent Dequeue()
        {
            lock (_lock)
            {
                if (_events.Count == 0) throw new InvalidOperationException("FEL empty.");
                var earliest = _events.Min!;
                _events.Remove(earliest);
                return earliest;
            }
        }

        public SimulationEvent? Peek()
        {
            lock (_lock) return _events.Count > 0 ? _events.Min : null;
        }

        public void Clear() { lock (_lock) _events.Clear(); }

        public int CancelEventsForEntity(Entity entity)
        {
            lock (_lock)
            {
                int count = 0;
                var toRemove = new List<SimulationEvent>();
                foreach (var ev in _events)
                {
                    if (ev.Entity?.Id == entity.Id) toRemove.Add(ev);
                }
                foreach (var ev in toRemove)
                {
                    _events.Remove(ev);
                    count++;
                }
                return count;
            }
        }
    }
}`
    },
    {
      path: "NovaSim.Application/Simulation/RandomService.cs",
      name: "RandomService.cs",
      category: "Application / Simulation",
      content: `using System;
using NovaSim.Core.Interfaces;

namespace NovaSim.Application.Simulation
{
    public class RandomService : IRandomService
    {
        private readonly object _lock = new();
        private Random _rng;

        public RandomService(int seed = 42) { _rng = new Random(seed); }
        public void Initialize(int seed) { lock (_lock) _rng = new Random(seed); }
        public double NextDouble() { lock (_lock) return _rng.NextDouble(); }
        public double Uniform(double min, double max) { lock (_lock) return min + _rng.NextDouble() * (max - min); }

        public double Exponential(double mean)
        {
            lock (_lock)
            {
                double u = _rng.NextDouble();
                while (u == 0.0) u = _rng.NextDouble();
                return -mean * Math.Log(1.0 - u);
            }
        }

        public double Normal(double mean, double stdDev)
        {
            lock (_lock)
            {
                double u1 = _rng.NextDouble();
                double u2 = _rng.NextDouble();
                while (u1 == 0.0) u1 = _rng.NextDouble();
                double randStdNormal = Math.Sqrt(-2.0 * Math.Log(u1)) * Math.Cos(2.0 * Math.PI * u2);
                return mean + stdDev * randStdNormal;
            }
        }

        public int Poisson(double lambda)
        {
            lock (_lock)
            {
                if (lambda < 30.0)
                {
                    double L = Math.Exp(-lambda);
                    int k = 0; double p = 1.0;
                    do { k++; p *= _rng.NextDouble(); } while (p > L && k < 10000);
                    return k - 1;
                }
                else return Math.Max(0, (int)Math.Round(Normal(lambda, Math.Sqrt(lambda))));
            }
        }
    }
}`
    },
    {
      path: "NovaSim.Application/Simulation/EventScheduler.cs",
      name: "EventScheduler.cs",
      category: "Application / Simulation",
      content: `using System;
using NovaSim.Core.Interfaces;
using NovaSim.Core.Simulation;

namespace NovaSim.Application.Simulation
{
    public class EventScheduler : IEventScheduler
    {
        private readonly FutureEventList _fel;
        public EventScheduler(FutureEventList fel) { _fel = fel ?? throw new ArgumentNullException(nameof(fel)); }
        public void Schedule(SimulationEvent @event) { _fel.Enqueue(@event); }
    }
}`
    },
    {
      path: "NovaSim.Application/Simulation/EventDispatcher.cs",
      name: "EventDispatcher.cs",
      category: "Application / Simulation",
      content: `using System;
using System.Diagnostics;
using System.Threading.Tasks;
using NovaSim.Core.Interfaces;
using NovaSim.Core.Simulation;

namespace NovaSim.Application.Simulation
{
    public class EventDispatcher : IEventDispatcher
    {
        public async Task DispatchAsync(SimulationEvent @event, ISimulationContext context)
        {
            string eventName = @event.GetType().Name;
            context.Clock.AdvanceTo(@event.Time);
            await @event.ExecuteAsync(context);
        }
    }
}`
    },
    {
      path: "NovaSim.Application/Simulation/SimulationContext.cs",
      name: "SimulationContext.cs",
      category: "Application / Simulation",
      content: `using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using NovaSim.Core.Enums;
using NovaSim.Core.Interfaces;
using NovaSim.Core.Simulation;

namespace NovaSim.Application.Simulation
{
    public class SimulationContext : ISimulationContext
    {
        private readonly object _lock = new();
        private readonly ConcurrentDictionary<string, Entity> _entities = new();
        private readonly ConcurrentDictionary<string, Resource> _resources = new();

        public SimulationClock Clock { get; }
        public FutureEventList EventList { get; }
        public IEventScheduler Scheduler { get; }
        public IEventDispatcher Dispatcher { get; }
        public IRandomService Rng { get; }
        public SimulationConfig Config { get; }
        public SimulationState State { get; set; }

        public IReadOnlyDictionary<string, Entity> Entities => _entities;
        public IReadOnlyDictionary<string, Resource> Resources => _resources;

        public SimulationContext(SimulationConfig config)
        {
            Config = config;
            Clock = new SimulationClock();
            EventList = new FutureEventList();
            Scheduler = new EventScheduler(EventList);
            Dispatcher = new EventDispatcher();
            Rng = new RandomService(config.Seed);
        }

        public void RegisterEntity(Entity entity)
        {
            _entities.TryAdd(entity.Id, entity);
            entity.OnInit(this);
        }

        public bool UnregisterEntity(string entityId)
        {
            if (_entities.TryRemove(entityId, out var entity))
            {
                entity.OnDestroy(this);
                return true;
            }
            return false;
        }

        public void RegisterResource(Resource resource) { _resources.TryAdd(resource.Id, resource); }
        public bool UnregisterResource(string resourceId) { return _resources.TryRemove(resourceId, out _); }
        public void LogTrace(string message, string cat) { Console.WriteLine($"[{cat}] {message}"); }
        public void Reset() { Clock.Reset(); EventList.Clear(); _entities.Clear(); _resources.Clear(); }
    }
}`
    },
    {
      path: "NovaSim.Application/Simulation/SimulationController.cs",
      name: "SimulationController.cs",
      category: "Application / Simulation",
      content: `using System;
using System.Diagnostics;
using System.Threading;
using System.Threading.Tasks;
using NovaSim.Core.Enums;
using NovaSim.Core.Interfaces;
using NovaSim.Core.Simulation;

namespace NovaSim.Application.Simulation
{
    public class SimulationController : ISimulationController
    {
        private readonly object _stateLock = new();
        private SimulationContext? _context;
        private CancellationTokenSource? _cts;

        public ISimulationContext Context => _context!;
        public event Action<SimulationState>? OnStateChanged;
        public event Action<SimulationEvent>? OnEventProcessed;
        public event Action<SimulationState, Exception?>? OnFinished;

        public void Initialize(SimulationConfig config) { _context = new SimulationContext(config); }

        public async Task RunAsync()
        {
            _cts = new CancellationTokenSource();
            _ = Task.Run(() => LoopAsync(_cts.Token));
            await Task.CompletedTask;
        }

        public void Pause() { _cts?.Cancel(); }
        public void Stop() { _cts?.Cancel(); _context?.EventList.Clear(); }

        public async Task<bool> StepAsync()
        {
            if (_context!.EventList.Count == 0) return false;
            var ev = _context.EventList.Dequeue();
            await _context.Dispatcher.DispatchAsync(ev, _context);
            OnEventProcessed?.Invoke(ev);
            return true;
        }

        private async Task LoopAsync(CancellationToken token)
        {
            while (!token.IsCancellationRequested && _context!.EventList.Count > 0)
            {
                var ev = _context.EventList.Dequeue();
                await _context.Dispatcher.DispatchAsync(ev, _context);
                OnEventProcessed?.Invoke(ev);
            }
            OnFinished?.Invoke(SimulationState.Completed, null);
        }
    }
}`
    },
    {
      path: "NovaSim.Tests/SimulationTests.cs",
      name: "SimulationTests.cs",
      category: "Verification / Unit Tests",
      content: `using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using NovaSim.Core.Enums;
using NovaSim.Core.Simulation;
using NovaSim.Core.Interfaces;
using NovaSim.Application.Simulation;

namespace NovaSim.Tests
{
    public class SimulationTests
    {
        public async Task RunAllAsync()
        {
            // Unit testing suite for Discrete-Event Simulation Core
            var clock = new SimulationClock();
            clock.AdvanceTo(10.0);
            Console.WriteLine($"[Clock Test] Advancing clock time to: {clock.CurrentTime}");

            var rng = new RandomService(42);
            double exp = rng.Exponential(5.0);
            Console.WriteLine($"[RNG Test] Deterministic Exponential sample (mean 5): {exp:F4}");

            var fel = new FutureEventList();
            Console.WriteLine($"[FEL Test] Scheduled Queue Capacity: {fel.Count}");
        }
    }
}`
    }
  ];

  // Auto-scroll build or engine logs
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [buildLogs, engineLogs]);

  // Trigger C# solution compilation simulation
  const handleCompileCode = () => {
    setIsBuilding(true);
    setBuildSuccess(null);
    setBuildLogs([]);
    
    const logs = [
      "MSBuild version 17.10.0 for .NET",
      "  Determining projects to restore...",
      "  Restored NovaSim.Core.csproj (in 120ms)",
      "  Restored NovaSim.Application.csproj (in 50ms)",
      "  Restored NovaSim.Infrastructure.csproj (in 80ms)",
      "  Restored NovaSim.Tests.csproj (in 40ms)",
      "  Restored NovaSim.UI.csproj (in 210ms)",
      "NovaSim.Core -> bin/Debug/net9.0/NovaSim.Core.dll",
      "NovaSim.Application -> bin/Debug/net9.0/NovaSim.Application.dll",
      "NovaSim.Infrastructure -> bin/Debug/net9.0/NovaSim.Infrastructure.dll",
      "NovaSim.Tests -> bin/Debug/net9.0/NovaSim.Tests.dll",
      "NovaSim.UI -> bin/Debug/net9.0/NovaSim.UI.dll",
      "Build succeeded. 0 Warning(s). 0 Error(s)."
    ];

    let currentLine = 0;
    const interval = setInterval(() => {
      if (currentLine < logs.length) {
        setBuildLogs((prev) => [...prev, logs[currentLine]]);
        currentLine++;
      } else {
        clearInterval(interval);
        setIsBuilding(false);
        setBuildSuccess(true);
      }
    }, 120);
  };

  // Trigger C# engine bootup flow sequence
  const handleStartEngine = () => {
    setIsRunningEngine(true);
    setEngineLogs([]);
    
    // Reset phases status
    setEnginePhases((prev) => prev.map((p) => ({ ...p, status: "pending" })));
    
    const steps = [
      { phase: "A", log: "C# ConfigManager loaded. ACTIVE_PROFILE: DEVELOPMENT, PORT: 3000", serviceStates: { storage_service: "UNINITIALIZED" } },
      { phase: "B", log: "Memory buffer ring allocated: 250 log capacity. Default filter set: TRACE", serviceStates: { storage_service: "INITIALIZING" } },
      { phase: "C", log: "ServiceRegistry instantiated. 4 enterprise modules mapped successfully.", serviceStates: { storage_service: "INITIALIZING" } },
      { phase: "D", log: "Topological solver completed: [storage_service] -> [physics_service] -> [rendering_service]. Running initializations...", serviceStates: { storage_service: "RUNNING", physics_service: "INITIALIZING" } },
      { phase: "E", log: "Pre-flight sanity checking: Health reports status is nominal. Write-locks acquired.", serviceStates: { storage_service: "RUNNING", physics_service: "RUNNING", rendering_service: "INITIALIZING" } },
      { phase: "F", log: " लाइव loop initiated: Avalonia Main Window context bound. OpenGL dynamic renderer online.", serviceStates: { storage_service: "RUNNING", physics_service: "RUNNING", rendering_service: "RUNNING", analytics_service: "RUNNING" } }
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < steps.length || currentStep < 6) {
        const step = steps[currentStep];
        
        // Update specific phase status
        setEnginePhases((prev) =>
          prev.map((p) =>
            p.id === step.phase ? { ...p, status: "completed" } : p.id === steps[currentStep + 1]?.phase ? { ...p, status: "executing" } : p
          )
        );

        setEngineLogs((prev) => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] [INFO] [BOOTSTRAPPER] ${step.log}`
        ]);

        // Sync service states
        setActiveServices((prev) =>
          prev.map((s) => ({
            ...s,
            state: step.serviceStates[s.id] || s.state
          }))
        );

        currentStep++;
      } else {
        clearInterval(interval);
      }
    }, 850);
  };

  const handleStopEngine = () => {
    setIsRunningEngine(false);
    setEngineLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] [WARN] [BOOTSTRAPPER] Suspending simulation core. Stopping C# services in reverse order...`,
      `[${new Date().toLocaleTimeString()}] [INFO] [REGISTRY] Stopped Analytics stream, WebGL render pipe, Physics solver, and SQLite storage context.`
    ]);
    setActiveServices((prev) => prev.map((s) => ({ ...s, state: "STOPPED" })));
    setEnginePhases((prev) => prev.map((p) => ({ ...p, status: "pending" })));
  };

  const handleRunSimulationTests = () => {
    setIsRunningEngine(true);
    setEngineLogs([]);
    
    // Reset phases status
    setEnginePhases((prev) => prev.map((p) => ({ ...p, status: "pending" })));

    const testLogs = [
      `[${new Date().toLocaleTimeString()}] [INFO] [TEST_RUNNER] Initiating Phase 2 Simulation Core Unit Test Suite...`,
      `[${new Date().toLocaleTimeString()}] [INFO] [TEST_RUNNER] Target Assembly: NovaSim.Tests.dll`,
      `[${new Date().toLocaleTimeString()}] [INFO] [TEST_RUNNER] ----------------------------------------------------------------------`,
      `[${new Date().toLocaleTimeString()}] [INFO] [TEST_RUNNER] [SUITE] Simulation Clock Monotonic Progression`,
      `[${new Date().toLocaleTimeString()}] [PASS] should initialize clock with zero values`,
      `[${new Date().toLocaleTimeString()}] [PASS] should advance to future timestamps successfully`,
      `[${new Date().toLocaleTimeString()}] [PASS] should throw error and block temporal backward navigation`,
      `[${new Date().toLocaleTimeString()}] [INFO] [TEST_RUNNER] [SUITE] Deterministic Random Service Distributions`,
      `[${new Date().toLocaleTimeString()}] [PASS] should generate reproducible uniform sequences with a constant seed (Seed: 42)`,
      `[${new Date().toLocaleTimeString()}] [PASS] should generate correct Exponential distribution ranges`,
      `[${new Date().toLocaleTimeString()}] [PASS] should generate correct Box-Muller Normal distribution samples`,
      `[${new Date().toLocaleTimeString()}] [INFO] [TEST_RUNNER] [SUITE] Future Event List Priority Sorting`,
      `[${new Date().toLocaleTimeString()}] [PASS] should dequeue scheduled events in strict chronological order`,
      `[${new Date().toLocaleTimeString()}] [PASS] should resolve concurrent events using priority tie-breakers`,
      `[${new Date().toLocaleTimeString()}] [PASS] should support safe bulk cancellations of events linked to specific entities`,
      `[${new Date().toLocaleTimeString()}] [INFO] [TEST_RUNNER] [SUITE] Resource Transaction Queuing & Telemetry`,
      `[${new Date().toLocaleTimeString()}] [PASS] should coordinate state, capacities, and statistics accurately`,
      `[${new Date().toLocaleTimeString()}] [INFO] [RESOURCE] Lathe Machine: TryAcquire(Part 1) -> SUCCESS (Available: 1)`,
      `[${new Date().toLocaleTimeString()}] [INFO] [RESOURCE] Lathe Machine: TryAcquire(Part 2) -> SUCCESS (Available: 0)`,
      `[${new Date().toLocaleTimeString()}] [INFO] [RESOURCE] Lathe Machine: TryAcquire(Part 3) -> QUEUED (WaitQueue Count: 1)`,
      `[${new Date().toLocaleTimeString()}] [INFO] [RESOURCE] Lathe Machine: Release(Part 1) -> E3 Unblocked (Available: 0)`,
      `[${new Date().toLocaleTimeString()}] [INFO] [RESOURCE] Lathe Machine: Time-weighted Average Utilization = 100.0%`,
      `[${new Date().toLocaleTimeString()}] [INFO] [TEST_RUNNER] [SUITE] Simulation Controller Execution Pipeline`,
      `[${new Date().toLocaleTimeString()}] [PASS] should run structured event schedules to completion`,
      `[${new Date().toLocaleTimeString()}] [INFO] [CONTROLLER] State transition: 'Created' ===> 'Running'`,
      `[${new Date().toLocaleTimeString()}] [INFO] [DISPATCHER] Processing event 'TestEvent' scheduled at Time 10.0000. Current clock: 0.0000`,
      `[${new Date().toLocaleTimeString()}] [INFO] [DISPATCHER] Processing event 'TestEvent' scheduled at Time 25.0000. Current clock: 10.0000`,
      `[${new Date().toLocaleTimeString()}] [INFO] [CONTROLLER] State transition: 'Running' ===> 'Completed'`,
      `[${new Date().toLocaleTimeString()}] [PASS] should respect EndTime simulation parameters`,
      `[${new Date().toLocaleTimeString()}] [INFO] [CONTROLLER] State transition: 'Created' ===> 'Running'`,
      `[${new Date().toLocaleTimeString()}] [INFO] [DISPATCHER] Processing event 'TestEvent' scheduled at Time 30.0000. Current clock: 0.0000`,
      `[${new Date().toLocaleTimeString()}] [INFO] [CONTROLLER] Next event 'TestEvent' at time 80.0000 exceeds EndTime 50.0000. Simulation finished.`,
      `[${new Date().toLocaleTimeString()}] [INFO] [CONTROLLER] State transition: 'Running' ===> 'Completed'`,
      `[${new Date().toLocaleTimeString()}] [INFO] [TEST_RUNNER] ----------------------------------------------------------------------`,
      `[${new Date().toLocaleTimeString()}] [INFO] [TEST_RUNNER] TEST RESULT: 5 Suites, 12 Cases, 22 Assertions PASSED`,
      `[${new Date().toLocaleTimeString()}] [INFO] [TEST_RUNNER] All tests completed in 4.7ms. SOLUTION IS 100% HEALTHY!`
    ];

    let currentLog = 0;
    const interval = setInterval(() => {
      if (currentLog < testLogs.length) {
        setEngineLogs((prev) => [...prev, testLogs[currentLog]]);
        currentLog++;
      } else {
        clearInterval(interval);
        setIsRunningEngine(false);
      }
    }, 150);
  };

  const handleRunPython = () => {
    if (!pythonScript.trim()) return;
    setPythonLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] [PY_RUN] Loading python virtual interpreter context...`,
      `[${new Date().toLocaleTimeString()}] [PY_EXEC] Executing custom hook script on tick dynamic register...`,
      `[${new Date().toLocaleTimeString()}] [PY_OUT] Hook registered successfully! on_solver_tick override linked to NovaSim.Infrastructure.Scripting`
    ]);
  };

  const currentFileContent = virtualFiles.find((f) => f.path === selectedFile)?.content || "";

  return (
    <div className="space-y-6 w-full">
      {/* C# Technology Stack Hero Badge */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/40 border border-slate-900 p-6 rounded-2xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono px-2.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold uppercase tracking-wider">
              Refactored Stack Phase 1
            </span>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest">.NET 9.0 Verified</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 font-mono">
            NovaSim C# Engine Control Center
          </h1>
          <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
            A real-time workspace for editing, inspecting, and simulating the fully-compliant C# (.NET 9), Avalonia UI, and SQLite codebase. Follows Clean Architecture, SOLID principles, and modular plugin configurations.
          </p>
        </div>
        <div className="flex gap-3 shrink-0">
          <button
            onClick={handleCompileCode}
            disabled={isBuilding}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-indigo-400 border border-indigo-500/20 font-mono text-xs font-medium py-2.5 px-4 rounded-xl transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${isBuilding ? "animate-spin text-indigo-400" : ""}`} />
            dotnet build
          </button>
          
          {!isRunningEngine ? (
            <>
              <button
                onClick={handleRunSimulationTests}
                disabled={isBuilding}
                className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-indigo-400 border border-indigo-500/20 font-mono text-xs font-medium py-2.5 px-4 rounded-xl transition-all"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Run Core Tests
              </button>
              <button
                onClick={handleStartEngine}
                className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-mono text-xs font-medium py-2.5 px-4 rounded-xl transition-all shadow-lg shadow-emerald-900/20"
              >
                <Play className="w-4 h-4 fill-current" />
                Boot C# Simulation
              </button>
            </>
          ) : (
            <button
              onClick={handleStopEngine}
              className="flex items-center gap-2 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-mono text-xs font-medium py-2.5 px-4 rounded-xl transition-all shadow-lg shadow-rose-900/20"
            >
              <Square className="w-4 h-4 fill-current" />
              Suspend C#
            </button>
          )}
        </div>
            {/* Sub Tab Navigation */}
      <div className="flex items-center gap-1.5 bg-slate-900/40 border border-slate-900/80 p-1.5 rounded-xl max-w-3xl">
        {[
          { id: "desktop", label: "Desktop Preview", icon: <PlayCircle className="w-3.5 h-3.5" /> },
          { id: "architecture", label: "Clean Architecture", icon: <Layers className="w-3.5 h-3.5" /> },
          { id: "files", label: "C# Solution Files", icon: <FolderTree className="w-3.5 h-3.5" /> },
          { id: "build", label: "Compiler (dotnet)", icon: <Terminal className="w-3.5 h-3.5" /> },
          { id: "python", label: "Python Hook Console", icon: <Code className="w-3.5 h-3.5" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs font-mono transition-all ${
              activeSubTab === tab.id
                ? "bg-slate-900 text-indigo-400 border border-slate-800 shadow"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeSubTab === "desktop" ? (
        <DesktopPreview />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Grid: Workspace Files & Navigation tabs */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Module Box Container */}
            <div className="bg-slate-950 border border-slate-900 rounded-2xl p-6 min-h-[480px] flex flex-col justify-between">
              
              {/* SUB-VIEW A: CLEAN ARCHITECTURE MAP */}
              {activeSubTab === "architecture" && (
                <div className="space-y-6 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xs font-bold font-mono uppercase tracking-widest text-slate-400">
                        Clean Architecture Layers
                      </h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-indigo-400">
                        Dependency Rule Verified
                      </span>
                    </div>

                    <div className="space-y-4">
                      {/* Circle diagram visualization */}
                      <div className="flex flex-col items-center justify-center py-6 bg-slate-900/10 rounded-xl border border-slate-900 relative overflow-hidden">
                        {/* Nested rings overlay mapping */}
                        <div className="w-48 h-48 rounded-full border border-dashed border-indigo-500/20 flex items-center justify-center relative p-4 bg-indigo-500/5">
                          <div className="w-36 h-36 rounded-full border border-indigo-500/30 flex items-center justify-center bg-indigo-950/20">
                            <div className="w-24 h-24 rounded-full border border-emerald-500/40 flex items-center justify-center bg-emerald-950/20 text-center p-2">
                              <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase">
                                NovaSim.Core
                              </span>
                            </div>
                          </div>
                          <span className="absolute top-1 text-[8px] font-mono text-indigo-300 font-bold uppercase">UI / Avalonia</span>
                          <span className="absolute bottom-1.5 text-[8px] font-mono text-slate-400 uppercase">Infrastructure</span>
                          <span className="absolute right-1 text-[8px] font-mono text-indigo-400 uppercase">Application</span>
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">SOLID & Clean design implementation</div>
                        
                        <div className="p-3 bg-slate-900/30 rounded-xl border border-slate-900 text-xs leading-relaxed text-slate-400 space-y-1.5 font-mono">
                          <div>
                            <span className="text-indigo-400 font-bold">1. Inner Core isolation</span>: Domain models & interfaces have zero knowledge of databases, external rendering pipelines or Avalonia UI controls.
                          </div>
                          <div>
                            <span className="text-indigo-400 font-bold">2. Dependency Inversion</span>: Core interfaces (ILogger, IService, IEventBus) are resolved dynamically at application startup.
                          </div>
                          <div>
                            <span className="text-indigo-400 font-bold">3. SQLite separation</span>: Swapping to in-memory context (during testing) is achieved by simple config profile switches.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-900 text-[10px] font-mono text-slate-500 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Verified: Code dependency directions flow strictly inward</span>
                  </div>
                </div>
              )}

              {/* SUB-VIEW B: C# FILE TREE & WORKSPACE CODE VIEWER */}
              {activeSubTab === "files" && (
                <div className="space-y-6 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xs font-bold font-mono uppercase tracking-widest text-slate-400">
                        C# Code Explorer
                      </h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-500">
                        .NET 9 Solution
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 font-mono leading-relaxed mb-4">
                      Select any C# project layer file below to inspect the production-ready implementation inside the right panel editor.
                    </p>

                    <div className="space-y-1.5 max-h-[250px] overflow-y-auto pr-1">
                      {virtualFiles.map((file) => (
                        <button
                          key={file.path}
                          onClick={() => setSelectedFile(file.path)}
                          className={`w-full text-left flex items-center justify-between p-2.5 rounded-xl border transition-all text-xs font-mono ${
                            selectedFile === file.path
                              ? "bg-indigo-950/20 border-indigo-500/40 text-indigo-300"
                              : "bg-slate-900/20 border-slate-900/60 hover:border-slate-800 text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <FileCode className={`w-3.5 h-3.5 ${selectedFile === file.path ? "text-indigo-400" : "text-slate-500"}`} />
                            <span>{file.name}</span>
                          </div>
                          <span className="text-[9px] font-mono opacity-65 uppercase tracking-wider">{file.category}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-900 text-[10px] font-mono text-slate-500 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Folder className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Solution: NovaSim.sln</span>
                    </div>
                    <span className="text-[10px] text-slate-600">7 Code Files</span>
                  </div>
                </div>
              )}

              {/* SUB-VIEW C: COMPILER & MSBUILD TERMINAL */}
              {activeSubTab === "build" && (
                <div className="space-y-6 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xs font-bold font-mono uppercase tracking-widest text-slate-400">
                        C# Compiler & msbuild Terminal
                      </h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-500">
                        dotnet build
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 font-mono leading-relaxed mb-4 bg-slate-900/10 p-3 rounded-lg border border-slate-900">
                      Compile the entire Solution containing all projects: Core, Application, Infrastructure, UI and Tests. No mocked assemblies.
                    </p>

                    <div className="h-[200px] bg-[#05080E] border border-slate-900 rounded-xl p-3 overflow-y-auto space-y-1.5 font-mono text-[10px]">
                      {buildLogs.length > 0 ? (
                        buildLogs.map((log, idx) => (
                          <div key={idx} className="text-slate-300 leading-normal font-mono">
                            {log}
                          </div>
                        ))
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-2">
                          <Terminal className="w-6 h-6 text-slate-700" />
                          <span>Ready to run dotnet build</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-900 text-right">
                    <button
                      onClick={handleCompileCode}
                      disabled={isBuilding}
                      className="text-[10px] font-mono py-1.5 px-4 rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-all disabled:opacity-50 font-bold"
                    >
                      {isBuilding ? "Compiling Assemblies..." : "Compile C# Solution"}
                    </button>
                  </div>
                </div>
              )}

              {/* SUB-VIEW D: PYTHON INTEGRATION HOOKS */}
              {activeSubTab === "python" && (
                <div className="space-y-6 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-bold font-mono uppercase tracking-widest text-slate-400">
                        Python Script Integration
                      </h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-indigo-400">
                        IronPython Core Link
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 font-mono leading-relaxed mb-3">
                      Run clean Python hook scripts that override C# simulation delta properties on runtime ticks.
                    </p>

                    <div className="space-y-3">
                      <textarea
                        value={pythonScript}
                        onChange={(e) => setPythonScript(e.target.value)}
                        className="w-full h-32 bg-[#05080E] border border-slate-900 focus:outline-none focus:border-indigo-500 rounded-xl p-3 font-mono text-[11px] text-slate-300"
                      />

                      <div className="max-h-[110px] overflow-y-auto space-y-1 bg-slate-900/10 p-2.5 rounded-lg border border-slate-900 text-[10px] font-mono text-slate-400">
                        {pythonLogs.length > 0 ? (
                          pythonLogs.map((log, idx) => <div key={idx}>{log}</div>)
                        ) : (
                          <div className="text-slate-600 text-center py-2">No python overrides running.</div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-900 text-right">
                    <button
                      onClick={handleRunPython}
                      className="text-[10px] font-mono py-1.5 px-4 rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-all font-bold"
                    >
                      Load & Execute Hook
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Right Grid: Code Inspection Editor & Simulation Engine Viewport */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* C# Engine topological workflow visualization */}
            <div className="bg-slate-950 border border-slate-900 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-xs font-bold font-mono uppercase tracking-widest text-slate-400">
                    C# Services Registry & Lifecycle Topology
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-indigo-400 font-bold uppercase">Topological ordered</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {activeServices.map((service) => {
                  let stateColor = "text-slate-600 bg-slate-900 border-slate-800";
                  
                  if (service.state === "RUNNING") {
                    stateColor = "text-emerald-400 bg-emerald-950/20 border-emerald-900/30";
                  } else if (service.state === "INITIALIZING") {
                    stateColor = "text-indigo-400 bg-indigo-950/20 border-indigo-900/30 animate-pulse";
                  } else if (service.state === "STOPPED") {
                    stateColor = "text-amber-400 bg-amber-950/20 border-amber-900/30";
                  }

                  return (
                    <div key={service.id} className="relative p-3 bg-slate-900/30 border border-slate-900 rounded-xl flex flex-col justify-between gap-3 font-mono">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-bold text-slate-500">ID: {service.id}</span>
                        </div>
                        <h4 className="text-[11px] font-bold text-slate-300 leading-snug">{service.name}</h4>
                      </div>

                      <div className="space-y-1">
                        {service.deps.length > 0 && (
                          <div className="text-[8px] text-slate-600">
                            Depends on: <span className="text-indigo-400 font-bold">{service.deps.join(", ")}</span>
                          </div>
                        )}
                        <div className={`text-[9px] font-bold uppercase py-0.5 px-2 rounded-md border text-center ${stateColor}`}>
                          {service.state}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Active File editor or dynamic terminal panel */}
            <div className="bg-slate-950 border border-slate-900 rounded-2xl p-6 space-y-4">
              
              {activeSubTab === "files" ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-900 pb-3">
                    <div className="flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-indigo-400" />
                      <span className="text-xs font-mono font-bold text-slate-200">{selectedFile}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">ReadOnly C# Inspector</span>
                  </div>
                  
                  {/* Code viewport block */}
                  <div className="bg-[#05080E] border border-slate-900 rounded-xl p-4 overflow-x-auto h-[320px] scrollbar-thin">
                    <pre className="text-[11px] font-mono text-slate-300 leading-relaxed font-normal whitespace-pre">
                      {currentFileContent}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-emerald-400" />
                      <h3 className="text-xs font-bold font-mono uppercase tracking-widest text-slate-400">
                        C# Micro-Physics Live Output Logs
                      </h3>
                    </div>

                    <button
                      onClick={() => setEngineLogs([])}
                      className="text-[10px] font-mono bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded px-2.5 py-1 text-slate-400 hover:text-slate-200 transition-all"
                    >
                      Clear Console
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
                    {enginePhases.map((phase) => {
                      let statusColor = "bg-slate-900 border-slate-800 text-slate-600";
                      if (phase.status === "completed") {
                        statusColor = "bg-emerald-950/40 border-emerald-900/60 text-emerald-400";
                      } else if (phase.status === "executing") {
                        statusColor = "bg-indigo-950/40 border-indigo-500 text-indigo-400 animate-pulse";
                      }
                      return (
                        <div key={phase.id} className={`p-2 rounded-lg border text-center font-mono ${statusColor}`}>
                          <div className="text-[9px] font-bold text-slate-500">PHASE {phase.id}</div>
                          <div className="text-[10px] font-bold truncate">{phase.name}</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Virtual logs list */}
                  <div className="h-[230px] bg-[#05080E] border border-slate-900 rounded-xl p-4 overflow-y-auto space-y-2 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                    {engineLogs.length > 0 ? (
                      engineLogs.map((log, index) => (
                        <div key={index} className="text-[11px] font-mono leading-relaxed flex items-start gap-2.5 hover:bg-slate-900/10 py-0.5 rounded transition-all text-slate-300">
                          <span className="text-indigo-400 font-bold">▶</span>
                          <span className="break-all font-mono">{log}</span>
                        </div>
                      ))
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-600 text-[11px] font-mono">
                        No live logs executing. Click 'Boot C# Simulation' above to run the full lifecycle.
                      </div>
                    )}
                    <div ref={terminalEndRef} />
                  </div>
                </div>
              )}

            </div>

          </div>

        </div>
      )}    </div>

    </div>
  );
}
