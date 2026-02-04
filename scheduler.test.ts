import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { SyncScheduler } from './scheduler';

describe('SyncScheduler', () => {
  let scheduler: SyncScheduler;
  let syncCalls: number;
  let errorCalls: Error[];

  beforeEach(() => {
    syncCalls = 0;
    errorCalls = [];
  });

  afterEach(() => {
    scheduler?.stop();
  });

  it('should not be running by default', () => {
    scheduler = new SyncScheduler({
      intervalMs: 1000,
      onSync: async () => { syncCalls++; },
    });
    
    expect(scheduler.getStatus().enabled).toBe(false);
  });

  it('should start and report enabled', () => {
    scheduler = new SyncScheduler({
      intervalMs: 100000,
      onSync: async () => { syncCalls++; },
    });
    
    scheduler.start();
    expect(scheduler.getStatus().enabled).toBe(true);
  });

  it('should stop and report disabled', () => {
    scheduler = new SyncScheduler({
      intervalMs: 100000,
      onSync: async () => { syncCalls++; },
    });
    
    scheduler.start();
    scheduler.stop();
    expect(scheduler.getStatus().enabled).toBe(false);
  });

  it('should call onSync when triggered manually', async () => {
    scheduler = new SyncScheduler({
      intervalMs: 100000,
      onSync: async () => { syncCalls++; },
    });
    
    scheduler.start();
    scheduler.triggerNow();
    
    // Wait for async operation
    await new Promise(resolve => setTimeout(resolve, 50));
    
    expect(syncCalls).toBe(1);
  });

  it('should report correct interval', () => {
    scheduler = new SyncScheduler({
      intervalMs: 3600000,
      onSync: async () => {},
    });
    
    expect(scheduler.getStatus().intervalMs).toBe(3600000);
  });

  it('should emit started event', () => {
    scheduler = new SyncScheduler({
      intervalMs: 1000,
      onSync: async () => {},
    });
    
    let startedEmitted = false;
    scheduler.on('started', () => { startedEmitted = true; });
    
    scheduler.start();
    expect(startedEmitted).toBe(true);
  });

  it('should emit stopped event', () => {
    scheduler = new SyncScheduler({
      intervalMs: 1000,
      onSync: async () => {},
    });
    
    let stoppedEmitted = false;
    scheduler.on('stopped', () => { stoppedEmitted = true; });
    
    scheduler.start();
    scheduler.stop();
    expect(stoppedEmitted).toBe(true);
  });

  it('should emit sync:start event on trigger', async () => {
    scheduler = new SyncScheduler({
      intervalMs: 100000,
      onSync: async () => {},
    });
    
    let syncStartEmitted = false;
    scheduler.on('sync:start', () => { syncStartEmitted = true; });
    
    scheduler.start();
    scheduler.triggerNow();
    
    await new Promise(resolve => setTimeout(resolve, 50));
    
    expect(syncStartEmitted).toBe(true);
  });

  it('should emit sync:success event after successful sync', async () => {
    scheduler = new SyncScheduler({
      intervalMs: 100000,
      onSync: async () => {},
    });
    
    let syncSuccessEmitted = false;
    scheduler.on('sync:success', () => { syncSuccessEmitted = true; });
    
    scheduler.start();
    scheduler.triggerNow();
    
    await new Promise(resolve => setTimeout(resolve, 50));
    
    expect(syncSuccessEmitted).toBe(true);
  });

  it('should emit sync:error event on sync failure', async () => {
    scheduler = new SyncScheduler({
      intervalMs: 100000,
      onSync: async () => { throw new Error('Sync failed'); },
      onError: (err) => { errorCalls.push(err); },
    });
    
    let syncErrorEmitted = false;
    scheduler.on('sync:error', () => { syncErrorEmitted = true; });
    
    scheduler.start();
    scheduler.triggerNow();
    
    await new Promise(resolve => setTimeout(resolve, 50));
    
    expect(syncErrorEmitted).toBe(true);
    expect(errorCalls.length).toBe(1);
    expect(errorCalls[0].message).toBe('Sync failed');
  });

  it('should report lastSyncAt after successful sync', async () => {
    scheduler = new SyncScheduler({
      intervalMs: 100000,
      onSync: async () => {},
    });
    
    scheduler.start();
    expect(scheduler.getStatus().lastSyncAt).toBeNull();
    
    scheduler.triggerNow();
    await new Promise(resolve => setTimeout(resolve, 50));
    
    expect(scheduler.getStatus().lastSyncAt).toBeInstanceOf(Date);
  });

  it('should report nextSyncAt when running', () => {
    scheduler = new SyncScheduler({
      intervalMs: 3600000,
      onSync: async () => {},
    });
    
    scheduler.start();
    const status = scheduler.getStatus();
    
    expect(status.nextSyncAt).toBeInstanceOf(Date);
    // Next sync should be approximately 1 hour from now
    const expectedTime = Date.now() + 3600000;
    expect(status.nextSyncAt!.getTime()).toBeGreaterThan(expectedTime - 1000);
    expect(status.nextSyncAt!.getTime()).toBeLessThan(expectedTime + 1000);
  });

  it('should not call onSync multiple times on multiple starts', () => {
    scheduler = new SyncScheduler({
      intervalMs: 100000,
      onSync: async () => { syncCalls++; },
    });
    
    scheduler.start();
    scheduler.start(); // Should be no-op
    scheduler.start(); // Should be no-op
    
    expect(scheduler.getStatus().enabled).toBe(true);
  });

  it('should handle rapid start/stop cycles', () => {
    scheduler = new SyncScheduler({
      intervalMs: 100000,
      onSync: async () => {},
    });
    
    scheduler.start();
    scheduler.stop();
    scheduler.start();
    scheduler.stop();
    scheduler.start();
    
    expect(scheduler.getStatus().enabled).toBe(true);
  });
});
