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

export class EventBus {
  private static instance: EventBus | null = null;
  private listeners: Map<string, Array<{ callback: EventCallback; id: string }>> = new Map();
  private wildcardListeners: Array<{ callback: (event: string, payload: EventPayload) => void; id: string }> = [];

  private constructor() {}

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  public subscribe(event: EngineEvents | string, callback: EventCallback): () => void {
    const id = Math.random().toString(36).substring(2, 11);
    
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    
    this.listeners.get(event)!.push({ callback, id });

    return () => {
      const list = this.listeners.get(event);
      if (list) {
        this.listeners.set(
          event,
          list.filter((l) => l.id !== id)
        );
      }
    };
  }

  public subscribeAll(callback: (event: string, payload: EventPayload) => void): () => void {
    const id = Math.random().toString(36).substring(2, 11);
    this.wildcardListeners.push({ callback, id });

    return () => {
      this.wildcardListeners = this.wildcardListeners.filter((w) => w.id !== id);
    };
  }

  public publish(event: EngineEvents | string, sender: string, data?: any): void {
    const payload: EventPayload = {
      timestamp: new Date(),
      sender,
      data
    };

    // Dispatch exact match
    const exactListeners = this.listeners.get(event);
    if (exactListeners) {
      for (const listener of exactListeners) {
        try {
          listener.callback(payload);
        } catch (err) {
          // Keep failures in individual handlers isolated from other handlers
          console.error(`[EventBus] Error in listener for event ${event} triggered by ${sender}:`, err);
        }
      }
    }

    // Dispatch wildcards
    for (const wild of this.wildcardListeners) {
      try {
        wild.callback(event, payload);
      } catch (err) {
        console.error(`[EventBus] Error in wildcard subscriber for event ${event}:`, err);
      }
    }
  }

  public clearAllListeners(): void {
    this.listeners.clear();
    this.wildcardListeners = [];
  }
}
