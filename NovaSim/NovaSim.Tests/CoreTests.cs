using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using NovaSim.Core.Config;
using NovaSim.Core.Enums;
using NovaSim.Infrastructure;
using NovaSim.Infrastructure.Config;
using NovaSim.Infrastructure.Events;
using NovaSim.Infrastructure.Logging;
using NovaSim.Application.Services;

namespace NovaSim.Tests
{
    public class AssertionResult
    {
        public string Message { get; set; } = "";
        public bool Passed { get; set; }
        public string? Error { get; set; }
    }

    public class TestCaseResult
    {
        public string Name { get; set; } = "";
        public bool Passed { get; set; }
        public List<AssertionResult> Assertions { get; set; } = new();
        public double DurationMs { get; set; }
    }

    public class TestSuiteResult
    {
        public string Name { get; set; } = "";
        public bool Passed { get; set; }
        public List<TestCaseResult> Cases { get; set; } = new();
        public double DurationMs { get; set; }
    }

    public class CoreTests
    {
        private readonly List<TestSuiteResult> _results = new();
        private TestSuiteResult? _currentSuite;
        private TestCaseResult? _currentCase;

        public CoreTests()
        {
            // Set up clean references before running
            NovaSim.Application.Services.InfrastructureReference.Logger = NovaSim.Infrastructure.Logging.Logger.Instance;
            NovaSim.Application.Services.InfrastructureReference.EventBus = NovaSim.Infrastructure.Events.EventBus.Instance;
            NovaSim.Application.Services.InfrastructureReference.ConfigManager = NovaSim.Infrastructure.Config.ConfigManager.Instance;
        }

        private void Describe(string name, Action runSuite)
        {
            var watch = System.Diagnostics.Stopwatch.StartNew();
            _currentSuite = new TestSuiteResult { Name = name, Passed = true };
            _results.Add(_currentSuite);

            try
            {
                runSuite();
            }
            catch (Exception ex)
            {
                _currentSuite.Passed = false;
                Logger.Instance.Error($"Suite execution threw a fatal error: {ex.Message}", ex, "TEST");
            }
            finally
            {
                watch.Stop();
                _currentSuite.DurationMs = watch.Elapsed.TotalMilliseconds;
            }
        }

        private void It(string name, Action runCase)
        {
            if (_currentSuite == null) return;

            var watch = System.Diagnostics.Stopwatch.StartNew();
            _currentCase = new TestCaseResult { Name = name, Passed = true };
            _currentSuite.Cases.Add(_currentCase);

            try
            {
                runCase();
            }
            catch (Exception ex)
            {
                _currentCase.Passed = false;
                _currentCase.Assertions.Add(new AssertionResult
                {
                    Message = $"Uncaught exception in test case: {ex.Message}",
                    Passed = false,
                    Error = ex.StackTrace
                });
            }
            finally
            {
                watch.Stop();
                _currentCase.DurationMs = watch.Elapsed.TotalMilliseconds;
                if (!_currentCase.Passed)
                {
                    _currentSuite.Passed = false;
                }
            }
        }

        private void ExpectToBe(object? actual, object? expected, string message)
        {
            if (_currentCase == null) return;

            bool passed = Equals(actual, expected);
            var assert = new AssertionResult
            {
                Message = $"{message} (Expected: {expected}, Actual: {actual})",
                Passed = passed,
                Error = passed ? null : "Assertion mismatch."
            };

            _currentCase.Assertions.Add(assert);
            if (!passed)
            {
                _currentCase.Passed = false;
            }
        }

        public async Task<List<TestSuiteResult>> RunAllTestsAsync()
        {
            _results.Clear();

            // 1. CONFIG MANAGER TESTS
            Describe("C# ConfigManager Suite", () =>
            {
                It("should load distinct defaults for profiles", () =>
                {
                    var manager = ConfigManager.Instance;
                    
                    manager.LoadProfile("development");
                    var devConfig = manager.GetConfig();
                    ExpectToBe(devConfig.Profile, "development", "Dev profile is loaded correctly.");
                    ExpectToBe(devConfig.Port, 3000, "Dev port matches.");

                    manager.LoadProfile("testing");
                    var testConfig = manager.GetConfig();
                    ExpectToBe(testConfig.Profile, "testing", "Testing profile is loaded correctly.");
                    ExpectToBe(testConfig.Port, 8080, "Testing port matches.");
                });

                It("should throw errors for invalid configurations", () =>
                {
                    var manager = ConfigManager.Instance;
                    
                    bool threw = false;
                    try
                    {
                        manager.UpdateConfig(new NovaSimConfig { Port = 999999 });
                    }
                    catch (ArgumentException)
                    {
                        threw = true;
                    }
                    ExpectToBe(threw, true, "Invalid port throws ArgumentException.");
                });
            });

            // 2. LOGGER TESTS
            Describe("C# Logger Core Suite", () =>
            {
                It("should properly configure minimum levels", () =>
                {
                    var logger = Logger.Instance;
                    logger.ClearRingBuffer();
                    logger.Configure(LogLevel.WARN, false, true, 50);

                    logger.Info("This info log should be filtered and ignored", "TEST");
                    ExpectToBe(logger.GetRingBuffer().Count, 0, "Info log ignored when min level is set to WARN.");

                    logger.Warn("This warn log should be captured", "TEST");
                    ExpectToBe(logger.GetRingBuffer().Count, 1, "Warn log is captured.");
                    ExpectToBe(logger.GetRingBuffer()[0].Message, "This warn log should be captured", "Captured log message matches.");
                });
            });

            // 3. EVENT BUS TESTS
            Describe("C# Type-safe EventBus Suite", () =>
            {
                It("should route published events to exact subscribers", () => {
                    var bus = EventBus.Instance;
                    bus.ClearAllListeners();

                    int count = 0;
                    string? payloadSender = null;

                    var unsubscribe = bus.Subscribe("test_event", (p) => {
                        count++;
                        payloadSender = p.Sender;
                    });

                    bus.Publish("test_event", "TEST_RUNNER");
                    ExpectToBe(count, 1, "Subscribed event triggers once.");
                    ExpectToBe(payloadSender, "TEST_RUNNER", "Payload sender is set correctly.");

                    unsubscribe();
                    bus.Publish("test_event", "TEST_RUNNER");
                    ExpectToBe(count, 1, "No further triggers after unsubscribe.");
                });
            });

            // 4. SERVICE REGISTRY & DEPENDENCY RESOLUTION
            Describe("C# ServiceRegistry Topological Resolve Suite", () =>
            {
                It("should prevent duplicate service registrations", () =>
                {
                    var registry = ServiceRegistry.Instance;
                    registry.ClearRegistry();

                    var s1 = new StorageService();
                    registry.Register(s1);

                    bool threw = false;
                    try
                    {
                        registry.Register(s1);
                    }
                    catch (InvalidOperationException)
                    {
                        threw = true;
                    }
                    ExpectToBe(threw, true, "Duplicate registrations throws InvalidOperationException.");
                });

                It("should resolve topological starts based on dependencies", () =>
                {
                    var registry = ServiceRegistry.Instance;
                    registry.ClearRegistry();

                    var storage = new StorageService();
                    var physics = new PhysicsService();

                    registry.Register(physics);
                    registry.Register(storage);

                    var order = registry.ResolveDependencyOrder();
                    int storageIdx = order.FindIndex(s => s.Id == storage.Id);
                    int physicsIdx = order.FindIndex(s => s.Id == physics.Id);

                    ExpectToBe(storageIdx != -1, true, "Storage is in registry.");
                    ExpectToBe(physicsIdx != -1, true, "Physics is in registry.");
                    ExpectToBe(storageIdx < physicsIdx, true, "Storage initialized before Physics.");
                });
            });

            // 5. BOOTSTRAPPER INTEGRATION TESTS
            Describe("C# Bootstrapper Startup Integration", () =>
            {
                It("should complete full startup cycle successfully", async () =>
                {
                    var boot = new Bootstrapper();
                    await boot.ExecuteBootSequenceAsync("testing");

                    var registry = ServiceRegistry.Instance;
                    var resolvedPhysics = registry.Get("physics_service");
                    ExpectToBe(resolvedPhysics != null, true, "Physics service is registered.");
                    ExpectToBe(resolvedPhysics?.State, ServiceState.RUNNING, "Physics service is in RUNNING state.");

                    await boot.ShutdownSequenceAsync();
                    ExpectToBe(resolvedPhysics?.State, ServiceState.STOPPED, "Physics service is in STOPPED state after shutdown.");
                });
            });

            await Task.CompletedTask;
            return _results;
        }
    }
}
