import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";
import type { TriageEvent, TriageEventName } from "./types";

export class TriageEventBus {
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(50);
  }

  emit<T>(name: TriageEventName, ticketId: string, payload: T): void {
    const event: TriageEvent<T> = {
      id: uuidv4(),
      name,
      ticketId,
      timestamp: new Date().toISOString(),
      payload,
    };
    this.emitter.emit(name, event);
    this.emitter.emit("*", event);
  }

  on<T>(name: TriageEventName | "*", handler: (event: TriageEvent<T>) => void): void {
    this.emitter.on(name, handler as (event: unknown) => void);
  }

  off<T>(name: TriageEventName | "*", handler: (event: TriageEvent<T>) => void): void {
    this.emitter.off(name, handler as (event: unknown) => void);
  }
}

// Process-level singleton
export const eventBus = new TriageEventBus();
