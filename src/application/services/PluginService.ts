import { Plugin } from "../../domain/entities/Plugin";
import { Logger } from "../../shared/logging/Logger";

export interface IPluginHook {
  onStartup?(): void;
  onShutdown?(): void;
  onSimulationStep?(tick: number, state: any): void;
  onBeforeSave?(layout: any): any;
}

export class PluginService {
  private static instance: PluginService | null = null;
  private plugins: Map<string, { meta: Plugin; hooks?: IPluginHook }> = new Map();
  private logger = Logger.getInstance();

  private constructor() {
    this.registerDefaultPlugins();
  }

  public static getInstance(): PluginService {
    if (!PluginService.instance) {
      PluginService.instance = new PluginService();
    }
    return PluginService.instance;
  }

  private registerDefaultPlugins() {
    // 1. PINN Solver
    this.registerPlugin(
      {
        id: "solver_pinn",
        name: "PINN Solver Module",
        description: "Direct Fourier Neural Operator model acceleration for Navier-Stokes boundary equations.",
        enabled: true,
        author: "NovaSim AI Core Team",
        version: "1.0.0"
      },
      {
        onSimulationStep: (tick, state) => {
          this.logger.debug(`PINN Solver surrogate intercept at tick ${tick}`, "PLUGIN-PINN");
          // Apply surrogate neural corrections here
        }
      }
    );

    // 2. Telemetry Hook
    this.registerPlugin(
      {
        id: "sensor_telemetry",
        name: "IoT Live Telemetry Hook",
        description: "Streams dynamic external sensor events to system queues via MQTT protocols.",
        enabled: false,
        author: "Enterprise Integrations Group",
        version: "0.8.2"
      }
    );

    // 3. Report Exporter
    this.registerPlugin(
      {
        id: "report_exporter",
        name: "PDF Analytics Report Generator",
        description: "Generates beautiful, ready-to-print industrial throughput reports dynamically.",
        enabled: true,
        author: "NovaSim AI Core Team",
        version: "1.1.0"
      }
    );
  }

  public registerPlugin(meta: Plugin, hooks?: IPluginHook): void {
    this.plugins.set(meta.id, { meta, hooks });
    this.logger.info(`Registered dynamic system plugin '${meta.name}' [${meta.id}] v${meta.version}`, "PLUGINS");
    
    if (meta.enabled && hooks?.onStartup) {
      hooks.onStartup();
    }
  }

  public getPlugins(): Plugin[] {
    return Array.from(this.plugins.values()).map((p) => p.meta);
  }

  public enablePlugin(id: string): void {
    const plugin = this.plugins.get(id);
    if (plugin && !plugin.meta.enabled) {
      plugin.meta.enabled = true;
      this.logger.info(`Activating system plugin: ${plugin.meta.name}`, "PLUGINS");
      if (plugin.hooks?.onStartup) {
        try {
          plugin.hooks.onStartup();
        } catch (e) {
          this.logger.error(`Error during plugin '${id}' onStartup hook`, e, "PLUGINS");
        }
      }
    }
  }

  public disablePlugin(id: string): void {
    const plugin = this.plugins.get(id);
    if (plugin && plugin.meta.enabled) {
      plugin.meta.enabled = false;
      this.logger.info(`Deactivating system plugin: ${plugin.meta.name}`, "PLUGINS");
      if (plugin.hooks?.onShutdown) {
        try {
          plugin.hooks.onShutdown();
        } catch (e) {
          this.logger.error(`Error during plugin '${id}' onShutdown hook`, e, "PLUGINS");
        }
      }
    }
  }

  public triggerStepHooks(tick: number, state: any): void {
    for (const [id, plugin] of this.plugins.entries()) {
      if (plugin.meta.enabled && plugin.hooks?.onSimulationStep) {
        try {
          plugin.hooks.onSimulationStep(tick, state);
        } catch (e) {
          // Keep failure isolated
        }
      }
    }
  }
}
