import { EngineEvents, EventPayload, EventCallback } from "../../shared/events/EngineEvents";

export interface IEventBus {
  subscribe(event: EngineEvents | string, callback: EventCallback): () => void;
  subscribeAll(callback: (event: string, payload: EventPayload) => void): () => void;
  publish(event: EngineEvents | string, sender: string, data?: any): void;
  clearAllListeners(): void;
}
