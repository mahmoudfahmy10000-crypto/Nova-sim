export enum EngineEvents {
  STARTUP_INIT = "startup:init",
  STARTUP_COMPLETE = "startup:complete",
  SERVICE_REGISTERED = "service:registered",
  SERVICE_BOOTING = "service:booting",
  SERVICE_RUNNING = "service:running",
  SERVICE_STOPPED = "service:stopped",
  HEALTH_CHECK = "health:check",
  SELF_TEST_RUN = "selftest:run",
  SELF_TEST_RESULT = "selftest:result",
  CONFIG_UPDATED = "config:updated",
  USER_ACTION = "user:action"
}

export interface EventPayload {
  timestamp: Date;
  sender: string;
  data?: any;
}

export type EventCallback = (payload: EventPayload) => void;
