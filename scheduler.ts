/**
 * Background sync scheduler for Garmin Health Sync
 * Automatically triggers sync at configured intervals
 */

import { EventEmitter } from 'node:events';

export interface SchedulerOptions {
  intervalMs: number;
  onSync: () => Promise<void>;
  onError?: (error: Error) => void;
}

export class SyncScheduler extends EventEmitter {
  private intervalMs: number;
  private onSync: () => Promise<void>;
  private onError?: (error: Error) => void;
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastSyncAt: Date | null = null;
  private nextSyncAt: Date | null = null;

  constructor(options: SchedulerOptions) {
    super();
    this.intervalMs = options.intervalMs;
    this.onSync = options.onSync;
    this.onError = options.onError;
  }

  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.scheduleNext();
    this.emit('started', { intervalMs: this.intervalMs });
    console.log(`[scheduler] Auto-sync enabled (interval: ${this.formatInterval(this.intervalMs)})`);
  }

  stop(): void {
    if (!this.isRunning) return;
    
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    this.nextSyncAt = null;
    this.emit('stopped');
    console.log('[scheduler] Auto-sync disabled');
  }

  triggerNow(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.runSync();
  }

  getStatus(): { 
    enabled: boolean; 
    intervalMs: number; 
    lastSyncAt: Date | null; 
    nextSyncAt: Date | null;
    isSyncing: boolean;
  } {
    return {
      enabled: this.isRunning,
      intervalMs: this.intervalMs,
      lastSyncAt: this.lastSyncAt,
      nextSyncAt: this.nextSyncAt,
      isSyncing: false, // Could track this if needed
    };
  }

  private scheduleNext(): void {
    if (!this.isRunning) return;
    
    this.nextSyncAt = new Date(Date.now() + this.intervalMs);
    this.timer = setTimeout(() => this.runSync(), this.intervalMs);
  }

  private async runSync(): Promise<void> {
    if (!this.isRunning) return;
    
    this.emit('sync:start');
    console.log('[scheduler] Running scheduled sync...');
    
    try {
      await this.onSync();
      this.lastSyncAt = new Date();
      this.emit('sync:success', { timestamp: this.lastSyncAt });
      console.log('[scheduler] Scheduled sync completed');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit('sync:error', err);
      this.onError?.(err);
      console.error('[scheduler] Scheduled sync failed:', err.message);
    } finally {
      this.scheduleNext();
    }
  }

  private formatInterval(ms: number): string {
    const hours = ms / (60 * 60 * 1000);
    if (hours >= 1) return `${Math.round(hours)}h`;
    const mins = ms / (60 * 1000);
    return `${Math.round(mins)}m`;
  }
}
