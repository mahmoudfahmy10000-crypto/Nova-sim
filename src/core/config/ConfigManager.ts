export type ConfigProfile = "development" | "testing" | "production";

export interface LoggingConfig {
  minLevel: "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL";
  enableConsole: boolean;
  enableRingBuffer: boolean;
  ringBufferCapacity: number;
  format: "text" | "json";
}

export interface EngineLimits {
  maxWorkerThreads: number;
  memorySlabSizeBytes: number;
  maxActiveEntities: number;
  physicsTickRateHz: number;
}

export interface NovaSimConfig {
  profile: ConfigProfile;
  port: number;
  logging: LoggingConfig;
  limits: EngineLimits;
  apiVersion: string;
}

export class ConfigManager {
  private static instance: ConfigManager | null = null;
  private currentConfig!: NovaSimConfig;

  private readonly DEFAULTS: Record<ConfigProfile, NovaSimConfig> = {
    development: {
      profile: "development",
      port: 3000,
      apiVersion: "1.0.0-beta.1",
      logging: {
        minLevel: "TRACE",
        enableConsole: true,
        enableRingBuffer: true,
        ringBufferCapacity: 200,
        format: "text",
      },
      limits: {
        maxWorkerThreads: 4,
        memorySlabSizeBytes: 1024 * 1024 * 512, // 512 MB
        maxActiveEntities: 10000,
        physicsTickRateHz: 60,
      },
    },
    testing: {
      profile: "testing",
      port: 8080,
      apiVersion: "1.0.0-beta.1",
      logging: {
        minLevel: "DEBUG",
        enableConsole: false,
        enableRingBuffer: true,
        ringBufferCapacity: 500,
        format: "text",
      },
      limits: {
        maxWorkerThreads: 2,
        memorySlabSizeBytes: 1024 * 1024 * 128, // 128 MB
        maxActiveEntities: 5000,
        physicsTickRateHz: 100,
      },
    },
    production: {
      profile: "production",
      port: 80,
      apiVersion: "1.0.0-beta.1",
      logging: {
        minLevel: "INFO",
        enableConsole: true,
        enableRingBuffer: true,
        ringBufferCapacity: 100,
        format: "json",
      },
      limits: {
        maxWorkerThreads: 16,
        memorySlabSizeBytes: 1024 * 1024 * 1024 * 8, // 8 GB
        maxActiveEntities: 1000000,
        physicsTickRateHz: 120,
      },
    },
  };

  private constructor(profile: ConfigProfile = "development") {
    this.loadProfile(profile);
  }

  public static getInstance(profile?: ConfigProfile): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager(profile);
    } else if (profile && ConfigManager.instance.currentConfig.profile !== profile) {
      ConfigManager.instance.loadProfile(profile);
    }
    return ConfigManager.instance;
  }

  public getConfig(): NovaSimConfig {
    return { ...this.currentConfig };
  }

  public loadProfile(profile: ConfigProfile): void {
    const base = this.DEFAULTS[profile];
    
    // Attempt environment variable overrides if present (e.g. process.env equivalents)
    const envOverrides: Partial<NovaSimConfig> = {};
    const envLimits: Partial<EngineLimits> = {};
    const envLogging: Partial<LoggingConfig> = {};

    // In browser/node environments, check common global properties safely
    const isNode = typeof process !== "undefined" && process.env;
    
    if (isNode) {
      if (process.env.PORT) {
        envOverrides.port = parseInt(process.env.PORT, 10);
      }
      if (process.env.NOVASIM_MAX_THREADS) {
        envLimits.maxWorkerThreads = parseInt(process.env.NOVASIM_MAX_THREADS, 10);
      }
      if (process.env.NOVASIM_SLAB_SIZE) {
        envLimits.memorySlabSizeBytes = parseInt(process.env.NOVASIM_SLAB_SIZE, 10);
      }
      if (process.env.NOVASIM_LOG_LEVEL) {
        const level = process.env.NOVASIM_LOG_LEVEL.toUpperCase();
        if (["TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL"].includes(level)) {
          envLogging.minLevel = level as any;
        }
      }
    }

    this.currentConfig = {
      ...base,
      ...envOverrides,
      logging: { ...base.logging, ...envLogging },
      limits: { ...base.limits, ...envLimits },
    };

    this.validateConfig(this.currentConfig);
  }

  public updateConfig(patch: Partial<NovaSimConfig> | ((current: NovaSimConfig) => Partial<NovaSimConfig>)): void {
    const updateObj = typeof patch === "function" ? patch(this.currentConfig) : patch;
    
    const merged = {
      ...this.currentConfig,
      ...updateObj,
      logging: { ...this.currentConfig.logging, ...updateObj.logging },
      limits: { ...this.currentConfig.limits, ...updateObj.limits },
    };

    this.validateConfig(merged);
    this.currentConfig = merged;
  }

  private validateConfig(config: NovaSimConfig): void {
    if (config.port < 1 || config.port > 65535) {
      throw new Error(`Configuration Error: Invalid port number ${config.port}. Must be 1-65535.`);
    }

    if (config.limits.maxWorkerThreads < 1 || config.limits.maxWorkerThreads > 128) {
      throw new Error(`Configuration Error: maxWorkerThreads must be between 1 and 128. Got ${config.limits.maxWorkerThreads}`);
    }

    if (config.limits.memorySlabSizeBytes < 1024 * 1024 * 16) {
      throw new Error(`Configuration Error: memorySlabSizeBytes must be at least 16 MB. Got ${config.limits.memorySlabSizeBytes} bytes.`);
    }

    if (config.limits.maxActiveEntities < 100) {
      throw new Error(`Configuration Error: maxActiveEntities must be at least 100. Got ${config.limits.maxActiveEntities}`);
    }

    if (config.limits.physicsTickRateHz < 1 || config.limits.physicsTickRateHz > 1000) {
      throw new Error(`Configuration Error: physicsTickRateHz must be between 1 and 1000 Hz. Got ${config.limits.physicsTickRateHz}`);
    }

    if (config.logging.ringBufferCapacity < 10 || config.logging.ringBufferCapacity > 10000) {
      throw new Error(`Configuration Error: ringBufferCapacity must be between 10 and 10000. Got ${config.logging.ringBufferCapacity}`);
    }
  }
}
