'use strict';

const NOOP_RELEASE = () => {};

// Per-origin download gate with abort-aware queueing and cooldown. Slots are
// counted only after a waiter is granted, so cancellation cannot strand
// capacity or leave a delayed grant alive in the background.
class DownloadLane {
  constructor(limit, signal) {
    this.limit = Math.max(1, Math.floor(Number(limit) || 1));
    this.signal = signal || null;
    this.active = 0;
    this.waiters = [];
    this.cooldownUntil = 0;
    this.cooldownTimer = null;
    this.disposed = false;
    this.handleAbort = () => this.abortWaiters();
    this.signal?.addEventListener('abort', this.handleAbort, { once: true });
  }

  acquire() {
    if (this.disposed || this.signal?.aborted) return Promise.resolve(NOOP_RELEASE);

    if (this.active < this.limit && this.cooldownUntil <= Date.now() && this.waiters.length === 0) {
      this.active++;
      return Promise.resolve(this.createRelease());
    }

    return new Promise(resolve => {
      this.waiters.push({ resolve });
      this.drain();
    });
  }

  createRelease() {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active = Math.max(0, this.active - 1);
      this.drain();
    };
  }

  coolDown(ms) {
    if (this.disposed || this.signal?.aborted) return;
    this.cooldownUntil = Math.max(this.cooldownUntil, Date.now() + Math.max(0, Number(ms) || 0));
    this.scheduleCooldownDrain();
  }

  scheduleCooldownDrain() {
    if (this.cooldownTimer || this.disposed || this.signal?.aborted || this.waiters.length === 0) return;
    const delay = Math.max(0, this.cooldownUntil - Date.now());
    this.cooldownTimer = setTimeout(() => {
      this.cooldownTimer = null;
      this.drain();
    }, delay);
  }

  drain() {
    if (this.disposed || this.signal?.aborted) {
      this.abortWaiters();
      return;
    }

    if (this.cooldownUntil > Date.now()) {
      this.scheduleCooldownDrain();
      return;
    }

    if (this.cooldownTimer) {
      clearTimeout(this.cooldownTimer);
      this.cooldownTimer = null;
    }

    while (this.active < this.limit && this.waiters.length > 0) {
      const waiter = this.waiters.shift();
      this.active++;
      waiter.resolve(this.createRelease());
    }
  }

  abortWaiters() {
    if (this.cooldownTimer) {
      clearTimeout(this.cooldownTimer);
      this.cooldownTimer = null;
    }
    this.cooldownUntil = 0;
    const waiters = this.waiters.splice(0);
    for (const waiter of waiters) waiter.resolve(NOOP_RELEASE);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.signal?.removeEventListener('abort', this.handleAbort);
    this.abortWaiters();
  }
}

module.exports = { DownloadLane };
