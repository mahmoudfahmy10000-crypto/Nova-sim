import { IService, ServiceState, ServiceHealth } from "./IService";
import { Logger } from "../logging/Logger";
import { EventBus, EngineEvents } from "./EventBus";

export class ServiceRegistry {
  private static instance: ServiceRegistry | null = null;
  private services: Map<string, IService> = new Map();
  private logger = Logger.getInstance();
  private eventBus = EventBus.getInstance();

  private constructor() {}

  public static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }

  public register(service: IService): void {
    if (this.services.has(service.id)) {
      throw new Error(`ServiceRegistry Error: Service with ID '${service.id}' is already registered.`);
    }
    this.services.set(service.id, service);
    this.logger.trace(`Registered service: ${service.name} (${service.id})`, "REGISTRY");
    this.eventBus.publish(EngineEvents.SERVICE_REGISTERED, "REGISTRY", { id: service.id, name: service.name });
  }

  public get(id: string): IService | undefined {
    return this.services.get(id);
  }

  public getServices(): IService[] {
    return Array.from(this.services.values());
  }

  public clearRegistry(): void {
    this.services.clear();
  }

  /**
   * Topological Sort using Depth First Search (DFS) for Dependency Resolution
   * Ensures services start only after their dependencies are fully running.
   */
  public resolveDependencyOrder(): IService[] {
    const visited = new Map<string, "visiting" | "visited">();
    const ordered: IService[] = [];

    const visit = (serviceId: string) => {
      const state = visited.get(serviceId);
      if (state === "visiting") {
        throw new Error(`Circular Dependency Detected in service registration involving service: '${serviceId}'`);
      }
      if (state === "visited") return;

      visited.set(serviceId, "visiting");

      const service = this.services.get(serviceId);
      if (!service) {
        throw new Error(`Missing Dependency Error: Service '${serviceId}' is not registered, but required.`);
      }

      for (const depId of service.dependencies) {
        visit(depId);
      }

      visited.set(serviceId, "visited");
      ordered.push(service);
    };

    for (const serviceId of this.services.keys()) {
      if (!visited.has(serviceId)) {
        visit(serviceId);
      }
    }

    return ordered;
  }

  /**
   * Initiates the load/init phase of all registered services in topological order.
   */
  public async initializeAll(): Promise<void> {
    const ordered = this.resolveDependencyOrder();
    this.logger.info(`Initializing ${ordered.length} services in dependency order...`, "REGISTRY");

    for (const service of ordered) {
      if (service.state !== ServiceState.UNINITIALIZED) {
        this.logger.warn(`Service '${service.name}' is already in state ${service.state}. Skipping init.`, "REGISTRY");
        continue;
      }

      this.logger.debug(`Initializing service: ${service.name}...`, "REGISTRY");
      this.eventBus.publish(EngineEvents.SERVICE_BOOTING, "REGISTRY", { id: service.id, state: ServiceState.INITIALIZING });
      
      try {
        await service.init();
        this.logger.trace(`Service '${service.name}' initialized successfully.`, "REGISTRY");
      } catch (err: any) {
        this.logger.error(`Failed to initialize service '${service.name}': ${err.message}`, err, "REGISTRY");
        throw err;
      }
    }
  }

  /**
   * Boots up all registered services in topological order.
   */
  public async startAll(): Promise<void> {
    const ordered = this.resolveDependencyOrder();
    this.logger.info(`Starting ${ordered.length} services...`, "REGISTRY");

    for (const service of ordered) {
      this.logger.debug(`Starting service: ${service.name}...`, "REGISTRY");
      
      try {
        await service.start();
        this.eventBus.publish(EngineEvents.SERVICE_RUNNING, "REGISTRY", { id: service.id, state: ServiceState.RUNNING });
        this.logger.info(`Service '${service.name}' is now RUNNING.`, "REGISTRY");
      } catch (err: any) {
        this.logger.fatal(`Failed to start service '${service.name}': ${err.message}`, err, "REGISTRY");
        throw err;
      }
    }
  }

  /**
   * Shuts down all services in reverse topological order.
   */
  public async stopAll(): Promise<void> {
    const ordered = [...this.resolveDependencyOrder()].reverse();
    this.logger.info(`Shutting down services in reverse order...`, "REGISTRY");

    for (const service of ordered) {
      if (service.state === ServiceState.STOPPED || service.state === ServiceState.UNINITIALIZED) {
        continue;
      }

      this.logger.debug(`Stopping service: ${service.name}...`, "REGISTRY");
      
      try {
        await service.stop();
        this.eventBus.publish(EngineEvents.SERVICE_STOPPED, "REGISTRY", { id: service.id, state: ServiceState.STOPPED });
        this.logger.info(`Service '${service.name}' stopped successfully.`, "REGISTRY");
      } catch (err: any) {
        this.logger.error(`Error encountered while stopping service '${service.name}': ${err.message}`, err, "REGISTRY");
        // We continue shutting down other services even if one fails
      }
    }
  }

  /**
   * Runs safety audits and health checks on all registered services.
   */
  public async checkSystemHealth(): Promise<Record<string, ServiceHealth>> {
    const reports: Record<string, ServiceHealth> = {};
    let overallHealthy = true;

    for (const [id, service] of this.services) {
      try {
        const report = await service.healthCheck();
        reports[id] = report;
        if (report.status === "unhealthy") {
          overallHealthy = false;
        }
      } catch (err: any) {
        reports[id] = {
          status: "unhealthy",
          message: `Healthcheck threw an exception: ${err.message}`,
          timestamp: new Date()
        };
        overallHealthy = false;
      }
    }

    this.logger.debug(`System health check completed. Overall status: ${overallHealthy ? "HEALTHY" : "DEGRADED"}`, "HEALTH");
    this.eventBus.publish(EngineEvents.HEALTH_CHECK, "REGISTRY", { healthy: overallHealthy, details: reports });
    
    return reports;
  }
}
