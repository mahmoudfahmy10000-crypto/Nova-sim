export enum ServiceState {
  UNINITIALIZED = "UNINITIALIZED",
  INITIALIZING = "INITIALIZING",
  RUNNING = "RUNNING",
  PAUSED = "PAUSED",
  STOPPED = "STOPPED",
  FAILED = "FAILED"
}

export interface ServiceHealth {
  status: "healthy" | "degraded" | "unhealthy";
  message: string;
  timestamp: Date;
  details?: Record<string, any>;
}

export interface IService {
  readonly id: string;
  readonly name: string;
  readonly dependencies: string[];
  readonly state: ServiceState;

  init(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  healthCheck(): Promise<ServiceHealth>;
}
