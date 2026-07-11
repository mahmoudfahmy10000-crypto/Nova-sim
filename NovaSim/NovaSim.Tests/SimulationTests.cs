using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using NovaSim.Core.Enums;
using NovaSim.Core.Simulation;
using NovaSim.Core.Interfaces;
using NovaSim.Application.Simulation;
using NovaSim.Application.Services;

namespace NovaSim.Tests
{
    /// <summary>
    /// Comprehensive unit test suite verifying correctness, performance, and boundary constraints
    /// of the Phase 2 Simulation Core.
    /// </summary>
    public class SimulationTests
    {
        private readonly List<TestSuiteResult> _results = new();
        private TestSuiteResult? _currentSuite;
        private TestCaseResult? _currentCase;

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
                // Log via console if infrastructure is linked or unavailable
                Console.WriteLine($"[TEST-SUITE-ERROR] {name}: {ex.Message}");
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

        private void ExpectToBe<T>(T actual, T expected, string assertionMessage)
        {
            if (_currentCase == null) return;

            bool passed = EqualityComparer<T>.Default.Equals(actual, expected);
            var assert = new AssertionResult
            {
                Message = assertionMessage + $" (Expected: {expected}, Actual: {actual})",
                Passed = passed
            };

            _currentCase.Assertions.Add(assert);
            if (!passed)
            {
                _currentCase.Passed = false;
            }
        }

        private void ExpectTrue(bool condition, string assertionMessage)
        {
            ExpectToBe(condition, true, assertionMessage);
        }

        /// <summary>
        /// Simple mock entity for testing purposes.
        /// </summary>
        private class TestEntity : Entity
        {
            public bool IsInitialized { get; private set; }
            public bool IsDestroyed { get; private set; }

            public TestEntity(string id, string name, double creationTime) 
                : base(id, name, creationTime) { }

            public override void OnInit(object context)
            {
                IsInitialized = true;
                base.OnInit(context);
            }

            public override void OnDestroy(object context)
            {
                IsDestroyed = true;
                base.OnDestroy(context);
            }
        }

        /// <summary>
        /// Simple mock event for testing execution pipelines.
        /// </summary>
        private class TestEvent : SimulationEvent
        {
            public bool Executed { get; private set; }
            public double? ClockTimeAtExecution { get; private set; }

            public TestEvent(double time, int priority = 0, Entity? entity = null) 
                : base(time, priority, entity) { }

            public override Task ExecuteAsync(ISimulationContext context)
            {
                Executed = true;
                ClockTimeAtExecution = context.Clock.CurrentTime;
                return Task.CompletedTask;
            }
        }

        /// <summary>
        /// Simple mock resource for testing metrics.
        /// </summary>
        private class TestResource : Resource
        {
            public TestResource(string id, string name, int capacity) 
                : base(id, name, capacity) { }
        }

        /// <summary>
        /// Executes all unit test cases for Phase 2 Simulation Core.
        /// </summary>
        public async Task<List<TestSuiteResult>> RunAllAsync()
        {
            // 1. SIMULATION CLOCK BOUNDARIES
            Describe("Simulation Clock Monotonic Progression", () =>
            {
                It("should initialize clock with zero values", () =>
                {
                    var clock = new SimulationClock();
                    ExpectToBe(clock.CurrentTime, 0.0, "Initial clock time is 0.0.");
                    ExpectToBe(clock.StepCount, 0L, "Initial step count is 0.");
                });

                It("should advance to future timestamps successfully", () =>
                {
                    var clock = new SimulationClock();
                    clock.AdvanceTo(15.75);
                    ExpectToBe(clock.CurrentTime, 15.75, "Clock advances cleanly to 15.75.");
                    ExpectToBe(clock.StepCount, 1L, "Step count incremented to 1.");

                    clock.AdvanceTo(42.0);
                    ExpectToBe(clock.CurrentTime, 42.0, "Clock advances cleanly to 42.0.");
                    ExpectToBe(clock.StepCount, 2L, "Step count incremented to 2.");
                });

                It("should throw error and block temporal backward navigation", () =>
                {
                    var clock = new SimulationClock();
                    clock.AdvanceTo(10.0);

                    bool exceptionThrown = false;
                    try
                    {
                        clock.AdvanceTo(5.0); // Backward jump
                    }
                    catch (ArgumentException)
                    {
                        exceptionThrown = true;
                    }

                    ExpectTrue(exceptionThrown, "Temporal Violation throws an exception on backward jumps.");
                    ExpectToBe(clock.CurrentTime, 10.0, "Clock remains at 10.0 after rejected backward jump.");
                });
            });

            // 2. RANDOM NUMBER SERVICE VERIFICATIONS
            Describe("Deterministic Random Service Distributions", () =>
            {
                It("should generate reproducible uniform sequences with a constant seed", () =>
                {
                    var service1 = new RandomService(42);
                    var service2 = new RandomService(42);

                    double val1_seq1 = service1.NextDouble();
                    double val1_seq2 = service2.NextDouble();
                    ExpectToBe(val1_seq1, val1_seq2, "First random doubles match exactly with seed 42.");

                    double val2_seq1 = service1.Uniform(10.0, 50.0);
                    double val2_seq2 = service2.Uniform(10.0, 50.0);
                    ExpectToBe(val2_seq1, val2_seq2, "Uniform doubles in range match exactly with seed 42.");
                });

                It("should generate correct Exponential distribution ranges", () =>
                {
                    var rng = new RandomService(12345);
                    double mean = 5.0;
                    
                    // Sample a small population and verify they are strictly positive
                    for (int i = 0; i < 50; i++)
                    {
                        double sample = rng.Exponential(mean);
                        ExpectTrue(sample >= 0.0, "Exponential samples are non-negative.");
                    }
                });

                It("should generate correct Box-Muller Normal distribution samples", () =>
                {
                    var rng = new RandomService(999);
                    double mean = 100.0;
                    double stdDev = 15.0;

                    // Samples should stay within standard probability bounds
                    for (int i = 0; i < 50; i++)
                    {
                        double sample = rng.Normal(mean, stdDev);
                        // Very safe bounds (8-sigma)
                        ExpectTrue(sample > (mean - 8 * stdDev) && sample < (mean + 8 * stdDev), "Normal sample lies within 8 standard deviations.");
                    }
                });
            });

            // 3. FUTURE EVENT LIST (PRIORITY QUEUE)
            Describe("Future Event List Priority Sorting", () =>
            {
                It("should dequeue scheduled events in strict chronological order", () =>
                {
                    var fel = new FutureEventList();
                    var ev1 = new TestEvent(10.0);
                    var ev2 = new TestEvent(5.0);
                    var ev3 = new TestEvent(25.0);

                    fel.Enqueue(ev1);
                    fel.Enqueue(ev2);
                    fel.Enqueue(ev3);

                    ExpectToBe(fel.Count, 3, "FEL count is 3 after enqueues.");

                    var first = fel.Dequeue();
                    ExpectToBe(first.Time, 5.0, "Earliest event scheduled at time 5.0 dequeues first.");

                    var second = fel.Dequeue();
                    ExpectToBe(second.Time, 10.0, "Intermediate event scheduled at time 10.0 dequeues second.");

                    var third = fel.Dequeue();
                    ExpectToBe(third.Time, 25.0, "Latest event scheduled at time 25.0 dequeues third.");
                    ExpectToBe(fel.Count, 0, "FEL is empty after full dequeue.");
                });

                It("should resolve concurrent events using priority tie-breakers", () =>
                {
                    var fel = new FutureEventList();
                    // Scheduled at same time, but evHigh has priority 1, evLow has priority 5 (lower value = higher priority)
                    var evLow = new TestEvent(10.0, priority: 5);
                    var evHigh = new TestEvent(10.0, priority: 1);

                    fel.Enqueue(evLow);
                    fel.Enqueue(evHigh);

                    var first = fel.Dequeue();
                    ExpectToBe(first.Priority, 1, "Lower priority integer (higher importance) tie-breaks first.");

                    var second = fel.Dequeue();
                    ExpectToBe(second.Priority, 5, "Higher priority integer (lower importance) processed second.");
                });

                It("should support safe bulk cancellations of events linked to specific entities", () =>
                {
                    var fel = new FutureEventList();
                    var entityA = new TestEntity("E_A", "Machine A", 0.0);
                    var entityB = new TestEntity("E_B", "Machine B", 0.0);

                    var evA1 = new TestEvent(10.0, entity: entityA);
                    var evA2 = new TestEvent(20.0, entity: entityA);
                    var evB1 = new TestEvent(15.0, entity: entityB);

                    fel.Enqueue(evA1);
                    fel.Enqueue(evA2);
                    fel.Enqueue(evB1);

                    int cancelledCount = fel.CancelEventsForEntity(entityA);
                    ExpectToBe(cancelledCount, 2, "Cancelled exactly 2 events belonging to Entity A.");
                    ExpectToBe(fel.Count, 1, "Only 1 event remains in FEL.");

                    var remaining = fel.Dequeue();
                    ExpectToBe(remaining.Entity?.Id, "E_B", "Remaining event is linked to Entity B.");
                });
            });

            // 4. RESOURCE TRANSACTION SCHEDULING
            Describe("Resource Transaction Queuing & Telemetry", () =>
            {
                It("should coordinate state, capacities, and statistics accurately", () =>
                {
                    var res = new TestResource("R_LATHE", "Lathe Machine", 2);
                    var ent1 = new TestEntity("E1", "Part 1", 0.0);
                    var ent2 = new TestEntity("E2", "Part 2", 0.0);
                    var ent3 = new TestEntity("E3", "Part 3", 0.0);

                    ExpectToBe(res.Capacity, 2, "Total capacity is 2.");
                    ExpectToBe(res.Available, 2, "Initially available capacity is 2.");

                    // Acquire 1 unit
                    bool acq1 = res.TryAcquire(ent1, 1, 0.0);
                    ExpectTrue(acq1, "Entity 1 immediately acquires 1 unit.");
                    ExpectToBe(res.Available, 1, "Available capacity drops to 1.");

                    // Acquire 1 unit (Capacity now full)
                    bool acq2 = res.TryAcquire(ent2, 1, 0.0);
                    ExpectTrue(acq2, "Entity 2 immediately acquires 1 unit.");
                    ExpectToBe(res.Available, 0, "Available capacity drops to 0.");

                    // Try to acquire 1 unit (Insufficient - should queue)
                    bool acq3 = res.TryAcquire(ent3, 1, 10.0); // requested at simulation time 10.0
                    ExpectTrue(!acq3, "Entity 3 cannot acquire capacity and enters waiting queue.");
                    ExpectToBe(res.WaitQueue.Count, 1, "Resource wait queue size is 1.");
                    ExpectToBe(res.WaitQueue[0].Requester.Id, "E3", "Wait queue head is Entity 3.");

                    // Release 1 unit at time 20.0, unblocking Entity 3
                    res.Release(ent1, 1, 20.0, out var unblocked);
                    ExpectToBe(unblocked.Count, 1, "Exactly 1 queued requester was unblocked.");
                    ExpectToBe(unblocked[0].Requester.Id, "E3", "Unblocked requester is Entity 3.");
                    ExpectToBe(res.Available, 0, "Available capacity remains 0 as unblocked E3 consumed the slot.");
                    ExpectToBe(res.WaitQueue.Count, 0, "Wait queue is now empty.");

                    // Release remaining slots at time 50.0
                    res.Release(ent2, 1, 50.0, out _);
                    res.Release(ent3, 1, 50.0, out _);
                    ExpectToBe(res.Available, 2, "All capacity returned. Available is 2.");

                    // Check time-weighted average utilization percentage:
                    // From 0 to 50 (Total elapsed: 50.0):
                    // Busy units = 1 from 0.0 to 0.0 (elapsed 0.0) -> integrated area: 0
                    // Busy units = 2 from 0.0 to 20.0 (elapsed 20.0) -> integrated area: 2 * 20 = 40
                    // Busy units = 2 (ent2 and ent3) from 20.0 to 50.0 (elapsed 30.0) -> integrated area: 2 * 30 = 60
                    // Total Integrated Area = 40 + 60 = 100
                    // Max Integrated capacity = Capacity (2) * TotalTime (50) = 100
                    // Average utilization = (100 / 100) * 100% = 100%
                    double avgUtil = res.GetAverageUtilization(50.0, 0.0);
                    ExpectToBe(avgUtil, 100.0, "Time-weighted resource utilization from 0 to 50 is 100%.");
                });
            });

            // 5. SIMULATION CONTROLLER LIFE-CYCLE LOGS
            Describe("Simulation Controller Execution Pipeline", () =>
            {
                It("should run structured event schedules to completion", async () =>
                {
                    var config = new SimulationConfig { StartTime = 0.0, EndTime = 100.0, Mode = ExecutionMode.Fastest };
                    var controller = new SimulationController();
                    controller.Initialize(config);

                    var context = controller.Context;

                    var ev1 = new TestEvent(10.0);
                    var ev2 = new TestEvent(25.0);

                    context.Scheduler.Schedule(ev1);
                    context.Scheduler.Schedule(ev2);

                    ExpectToBe(context.State, SimulationState.Created, "Initial controller state is Created.");
                    ExpectToBe(context.EventList.Count, 2, "Event list count is 2.");

                    // Execute asynchronously
                    await controller.RunAsync();

                    ExpectToBe(context.State, SimulationState.Completed, "Controller state transitions to Completed after exhausting FEL.");
                    ExpectToBe(context.Clock.CurrentTime, 25.0, "Clock progressed to 25.0 (latest event time).");
                    ExpectTrue(ev1.Executed, "Event 1 executed successfully.");
                    ExpectTrue(ev2.Executed, "Event 2 executed successfully.");
                });

                It("should respect EndTime simulation parameters", async () =>
                {
                    var config = new SimulationConfig { StartTime = 0.0, EndTime = 50.0, Mode = ExecutionMode.Fastest };
                    var controller = new SimulationController();
                    controller.Initialize(config);

                    var context = controller.Context;

                    var evBefore = new TestEvent(30.0);
                    var evAfter = new TestEvent(80.0); // Beyond EndTime 50.0

                    context.Scheduler.Schedule(evBefore);
                    context.Scheduler.Schedule(evAfter);

                    await controller.RunAsync();

                    ExpectToBe(context.State, SimulationState.Completed, "Simulation completes upon encountering event exceeding EndTime.");
                    ExpectToBe(context.Clock.CurrentTime, 30.0, "Clock halts at 30.0, ignoring future event beyond limit.");
                    ExpectTrue(evBefore.Executed, "Event before boundary was processed.");
                    ExpectTrue(!evAfter.Executed, "Event after boundary was not executed.");
                });
            });

            await Task.CompletedTask;
            return _results;
        }
    }
}
