import { EventEmitter } from 'events';

export interface AdminChangeEvent {
  seq: number;
  entityType: string;
  action: string;
  entityId?: string;
  sourceApp: string;
  timestamp: string;
}

class AdminEventBus extends EventEmitter {
  private seq = 1;
  private lastEvent: AdminChangeEvent = {
    seq: 1,
    entityType: 'system',
    action: 'INIT',
    sourceApp: 'backend',
    timestamp: new Date().toISOString(),
  };

  emitChange(input: Omit<AdminChangeEvent, 'seq' | 'timestamp'>): AdminChangeEvent {
    this.seq += 1;
    this.lastEvent = {
      ...input,
      seq: this.seq,
      timestamp: new Date().toISOString(),
    };
    this.emit('change', this.lastEvent);
    return this.lastEvent;
  }

  getState() {
    return {
      seq: this.seq,
      lastEvent: this.lastEvent,
    };
  }
}

export const adminEventBus = new AdminEventBus();
adminEventBus.setMaxListeners(100);

