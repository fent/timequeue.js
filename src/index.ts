import { EventEmitter } from 'node:events';
import MemoryStore from './mem-store';
import type * as store from './store';

class TaskError extends Error {
  public args: unknown[];
}

class TimeQueue extends EventEmitter {
  static TimeQueue = TimeQueue;
  static default = TimeQueue;
  static TaskError = TaskError;

  // TimeQueue options can be changed after initialization.
  public worker: TimeQueue.Worker;
  public concurrency: number;
  public every: number;
  public maxQueued: number;
  public timeout: number;

  private _isWorkerAsync: boolean;
  private _timers: NodeJS.Timeout[];
  private _generation = 0;
  private _clearing: Promise<void> | null = null;
  public store: TimeQueue.Store;

  // How many tasks are currently active.
  public active = 0;

  // How many tasks are still being waited on,
  // in case the `every` option was used.
  public intransit = 0;

  // How many tasks have finished.
  public finished = 0;

  constructor(worker: TimeQueue.Worker, options: TimeQueue.Options = {}) {
    super();

    this.worker = worker;
    this._isWorkerAsync = worker.constructor.name === 'AsyncFunction';
    this.concurrency = options.concurrency || 1;
    this.every = options.every || 0;
    this.maxQueued = options.maxQueued || Infinity;
    this.timeout = options.timeout || 0;
    this.store =
      options.store || new MemoryStore({ maxQueued: this.maxQueued });
    this._timers = [];
  }

  /**
   * Pushes a task onto the queue.
   */
  async push(...args: unknown[]) {
    while (this._clearing) {
      await this._clearing;
    }

    // Returns a promise when no `callback` is given.
    if (
      (this._isWorkerAsync && args.length === this.worker.length) ||
      (!this._isWorkerAsync && args.length < this.worker.length)
    ) {
      return new Promise((resolve, reject) => {
        // Add any missing arguments.
        if (!this._isWorkerAsync) {
          while (args.length < this.worker.length - 1) {
            args.push(undefined);
          }
        }

        // Calling from the prototype directly fixes an infinute loop bug that
        // occurs when this method is overwritten by a child class.
        TimeQueue.prototype.push.call(
          this,
          ...args,
          (err: Error | null, results: unknown) => {
            if (err) return reject(err);
            resolve(results);
          },
        );
      });
    }

    if (this.intransit < this.concurrency) {
      this.intransit++;
      this.active++;
      if (this.intransit === this.concurrency) {
        this.emit('full');
      }
      await this._process(args);
    } else {
      await this.store.pushTask(args);
    }
  }

  /**
   * Starts a task
   */
  async _process(args: unknown[]) {
    const callback = args.pop() as (
      err: Error | null,
      result?: unknown,
    ) => void;
    const generation = this._generation;
    let finished = false;
    const every = ~~this.every;
    let tookLongerThanEvery: boolean;

    if (every) {
      tookLongerThanEvery = false;

      this._timers.push(
        setTimeout(() => {
          tookLongerThanEvery = true;
          this._timers.shift();
          if (finished) {
            this._next();
          }
        }, every),
      );
    } else {
      tookLongerThanEvery = true;
    }

    // If `timeout` option is set, set a timeout to check the task doesn't lag.
    let taskTimedOut = false;
    let callbackCalled = false;
    const timeout = ~~this.timeout;
    let tid: NodeJS.Timeout;

    const taskCallback = (err: Error | null, result?: unknown) => {
      // If this task has timed out, and the callback is called again
      // from the worker, ignore it.
      if (!taskTimedOut) {
        clearTimeout(tid);
      } else {
        return;
      }

      // Check that this callback is only called once.
      if (callbackCalled && !taskTimedOut) {
        throw Error('Callback from worker should only be called once');
      }
      callbackCalled = true;
      // `finished` is a lifetime count, so stale tasks still count here.
      this.finished++;
      const isCurrent = generation === this._generation;
      if (isCurrent) this.active--;
      callback(err, result);

      finished = true;
      if (isCurrent && tookLongerThanEvery) {
        this._next();
      }
    };

    if (timeout) {
      tid = setTimeout(() => {
        const err = new TaskError('Task timed out');
        err.args = args;
        taskCallback(err);
        taskTimedOut = true;
      }, timeout);
    }

    // Call the worker.
    if (this._isWorkerAsync) {
      try {
        taskCallback(
          null,
          await (this.worker as (...args: unknown[]) => unknown)(...args),
        );
      } catch (err) {
        taskCallback(err as Error);
      }
    } else {
      // Add custom callback to args.
      const args2 = args.slice();
      args2.push(taskCallback);
      (this.worker as (...args: unknown[]) => unknown)(...args2);
    }
  }

  /**
   * Called when a task finishes. Looks at the queue and processes the next
   * waiting task.
   */
  async _next() {
    const generation = this._generation;
    if (this.intransit <= this.concurrency) {
      const task = await this.store.getNextTask();
      if (generation !== this._generation) return;
      if (task) {
        this.active++;
        await this._process(task);

        if (generation !== this._generation) return;
        if ((await this.store.getQueueLen()) === 0) {
          this.emit('empty');
        }
        return;
      }
    }
    if (--this.intransit === 0) {
      this.emit('drain');
    }
  }

  /**
   * Empties the queue and kills the timers.
   * Active tasks will still be completed, but no longer update queue state.
   */
  async die() {
    this._generation++;
    for (const t of this._timers) {
      clearTimeout(t);
    }
    this._timers = [];
    this.intransit = 0;
    this.active = 0;
    const clearing = this.store.clear();
    this._clearing = clearing;
    try {
      await clearing;
    } finally {
      if (this._clearing === clearing) {
        this._clearing = null;
      }
    }
  }
}

namespace TimeQueue {
  export type TaskError = typeof TaskError.prototype;
  // biome-ignore lint/suspicious/noExplicitAny: worker functions accept arbitrary parameters
  export type Worker = (...args: any[]) => unknown;
  export interface Options {
    concurrency?: number;
    every?: number;
    maxQueued?: number;
    timeout?: number;
    store?: store.Store;
  }
  export type Store = store.Store;
  export type StoreOptions = store.StoreOptions;
}

// Statically recognizable exports for Node.js cjs-module-lexer (ESM named import support)
module.exports = TimeQueue;
module.exports.default = TimeQueue;
module.exports.TimeQueue = TimeQueue;
module.exports.TaskError = TaskError;

export = TimeQueue;
