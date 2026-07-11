import { ConfigManager } from "../config/ConfigManager";
import { Logger, LogLevel } from "../logging/Logger";
import { EventBus, EngineEvents } from "../framework/EventBus";
import { ServiceRegistry } from "../framework/ServiceRegistry";
import { Bootstrapper } from "../startup/Bootstrapper";
import { StorageService, PhysicsService } from "../startup/Bootstrapper";

export interface AssertionResult {
  message: string;
  passed: boolean;
  error?: string;
}

export interface TestCaseResult {
  name: string;
  passed: boolean;
  assertions: AssertionResult[];
  durationMs: number;
}

export interface TestSuiteResult {
  name: string;
  passed: boolean;
  cases: TestCaseResult[];
  durationMs: number;
}

export class TestRunner {
  private suites: Array<{
    name: string;
    cases: Array<{ name: string; fn: () => void | Promise<void> }>;
  }> = [];

  private currentSuiteName = "";
  private currentCaseName = "";
  private currentAssertions: AssertionResult[] = [];

  constructor() {
    this.registerCoreTests();
  }

  public getSuites() {
    return this.suites;
  }

  private describe(name: string, fn: () => void) {
    this.currentSuiteName = name;
    const suite = { name, cases: [] as any };
    this.suites.push(suite);
    
    // Executes callback immediately to collect test cases via it()
    fn();
  }

  private it(name: string, fn: () => void | Promise<void>) {
    const suite = this.suites[this.suites.length - 1];
    if (suite) {
      suite.cases.push({ name, fn });
    }
  }

  private expect(actual: any) {
    const assertions = this.currentAssertions;
    return {
      toBe: (expected: any) => {
        const passed = actual === expected;
        assertions.push({
          message: `Expected ${JSON.stringify(actual)} to be ${JSON.stringify(expected)}`,
          passed,
          error: passed ? undefined : `Mismatch: Actual ${actual} !== Expected ${expected}`
        });
      },
      toBeDefined: () => {
        const passed = actual !== undefined && actual !== null;
        assertions.push({
          message: `Expected actual value to be defined`,
          passed,
          error: passed ? undefined : `Actual value is undefined or null`
        });
      },
      toContain: (element: any) => {
        const passed = Array.isArray(actual) && actual.includes(element);
        assertions.push({
          message: `Expected array to contain ${JSON.stringify(element)}`,
          passed,
          error: passed ? undefined : `Element not found in array`
        });
      },
      toThrow: (expectedErrMsgSubstr?: string) => {
        let threw = false;
        let caughtMsg = "";
        try {
          actual();
        } catch (e: any) {
          threw = true;
          caughtMsg = e.message || "";
        }
        
        let passed = threw;
        if (threw && expectedErrMsgSubstr) {
          passed = caughtMsg.includes(expectedErrMsgSubstr);
        }

        assertions.push({
          message: `Expected function to throw an error`,
          passed,
          error: passed ? undefined : (threw ? `Threw wrong error: '${caughtMsg}' instead of containing '${expectedErrMsgSubstr}'` : `Function did not throw an exception.`)
        });
      }
    };
  }

  private registerCoreTests() {
    // 1. CONFIG MANAGER TESTS
    this.describe("ConfigManager Suite", () => {
      this.it("should load distinct defaults for profiles", () => {
        const manager = ConfigManager.getInstance();
        
        manager.loadProfile("development");
        const devConfig = manager.getConfig();
        this.expect(devConfig.profile).toBe("development");
        this.expect(devConfig.port).toBe(3000);

        manager.loadProfile("testing");
        const testConfig = manager.getConfig();
        this.expect(testConfig.profile).toBe("testing");
        this.expect(testConfig.port).toBe(8080);
      });

      this.it("should throw errors for invalid configurations", () => {
        const manager = ConfigManager.getInstance();
        
        this.expect(() => {
          manager.updateConfig({ port: 999999 }); // Invalid port
        }).toThrow("Invalid port");

        this.expect(() => {
          manager.updateConfig({ limits: { ...manager.getConfig().limits, maxWorkerThreads: 0 } });
        }).toThrow("maxWorkerThreads");
      });
    });

    // 2. LOGGER TESTS
    this.describe("Logger Core Suite", () => {
      this.it("should properly configure minimum levels", () => {
        const logger = Logger.getInstance();
        logger.clearRingBuffer();
        
        logger.configure({
          minLevel: "WARN",
          enableConsole: false,
          enableRingBuffer: true,
          ringBufferCapacity: 50
        });

        logger.info("This info log should be filtered and ignored", "TEST_SUITE");
        this.expect(logger.getRingBuffer().length).toBe(0);

        logger.warn("This warn log should be captured", "TEST_SUITE");
        this.expect(logger.getRingBuffer().length).toBe(1);
        this.expect(logger.getRingBuffer()[0].message).toBe("This warn log should be captured");
      });
    });

    // 3. EVENT BUS TESTS
    this.describe("Type-safe EventBus Suite", () => {
      this.it("should route published events to exact subscribers", () => {
        const bus = EventBus.getInstance();
        bus.clearAllListeners();

        let receivedCount = 0;
        let receivedData = null;

        bus.subscribe(EngineEvents.CONFIG_UPDATED, (payload) => {
          receivedCount++;
          receivedData = payload.data;
        });

        bus.publish(EngineEvents.CONFIG_UPDATED, "TESTER", { profile: "testing" });
        this.expect(receivedCount).toBe(1);
        this.expect(receivedData?.profile).toBe("testing");
      });

      this.it("should isolate listener errors cleanly", () => {
        const bus = EventBus.getInstance();
        bus.clearAllListeners();

        let subsequentRan = false;

        bus.subscribe("test:error_isolation", () => {
          throw new Error("Simulated listener exception");
        });

        bus.subscribe("test:error_isolation", () => {
          subsequentRan = true;
        });

        bus.publish("test:error_isolation", "TESTER");
        this.expect(subsequentRan).toBe(true);
      });
    });

    // 4. SERVICE REGISTRY & DEPENDENCY RESOLUTION TESTS
    this.describe("ServiceRegistry Topological Resolve Suite", () => {
      this.it("should prevent duplicate service registrations", () => {
        const registry = ServiceRegistry.getInstance();
        registry.clearRegistry();

        const s1 = new StorageService();
        registry.register(s1);

        this.expect(() => {
          registry.register(s1); // Register same ID again
        }).toThrow("already registered");
      });

      this.it("should resolve topological starts based on dependencies", () => {
        const registry = ServiceRegistry.getInstance();
        registry.clearRegistry();

        const storage = new StorageService();
        const physics = new PhysicsService();

        registry.register(physics); // Registered first, but depends on storage
        registry.register(storage); // Registered second

        const order = registry.resolveDependencyOrder();
        
        // Storage should appear before Physics in topological execution order
        const storageIdx = order.findIndex((s) => s.id === storage.id);
        const physicsIdx = order.findIndex((s) => s.id === physics.id);

        this.expect(storageIdx !== -1).toBe(true);
        this.expect(physicsIdx !== -1).toBe(true);
        this.expect(storageIdx < physicsIdx).toBe(true);
      });
    });

    // 5. BOOTSTRAPPER INTEGRATION TESTS
    this.describe("Bootstrapper Startup Integration", () => {
      this.it("should complete full startup cycle successfully", async () => {
        const boot = new Bootstrapper();
        
        // Execute the bootstrapper sequence under "testing" profile
        await boot.executeBootSequence("testing");
        
        const registry = ServiceRegistry.getInstance();
        const physics = registry.get("physics_service");
        this.expect(physics?.state).toBe("RUNNING");

        const rendering = registry.get("rendering_service");
        this.expect(rendering?.state).toBe("RUNNING");

        // Cleanup after tests
        await boot.shutdownSequence();
      });
    });
  }

  public async runAllTests(): Promise<TestSuiteResult[]> {
    const suiteResults: TestSuiteResult[] = [];
    const logger = Logger.getInstance();

    logger.info("Executing NovaSim AI Phase 1 Test Runner...", "TEST_RUNNER");

    for (const suite of this.suites) {
      const suiteStart = performance.now();
      const caseResults: TestCaseResult[] = [];
      let suitePassed = true;

      for (const tcase of suite.cases) {
        const caseStart = performance.now();
        this.currentAssertions = [];
        this.currentCaseName = tcase.name;

        let passed = true;
        try {
          await tcase.fn();
        } catch (err: any) {
          passed = false;
          this.currentAssertions.push({
            message: `Uncaught Exception in test block: ${err.message}`,
            passed: false,
            error: err.stack || err.toString()
          });
        }

        // Aggregate individual assertion statuses
        const assertionsPassed = this.currentAssertions.every((a) => a.passed);
        if (!assertionsPassed) passed = false;

        if (!passed) suitePassed = false;

        const caseEnd = performance.now();
        caseResults.push({
          name: tcase.name,
          passed,
          assertions: [...this.currentAssertions],
          durationMs: caseEnd - caseStart
        });
      }

      const suiteEnd = performance.now();
      suiteResults.push({
        name: suite.name,
        passed: suitePassed,
        cases: caseResults,
        durationMs: suiteEnd - suiteStart
      });

      const symbol = suitePassed ? "✔" : "❌";
      logger.info(`Suite [${suite.name}] finished: ${symbol} ${suitePassed ? "PASSED" : "FAILED"}`, "TEST_RUNNER");
    }

    return suiteResults;
  }
}
