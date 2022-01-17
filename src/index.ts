import { EventEmitter } from 'events';
import MemoryStore from './mem-store';

namespace TimeQueue {
  export type Worker = (...args: any[]) => void | Promise<any>;
  export interface Options {
    concurrency?: number;
    every?: number;
    maxQueued?: number;
    timeout?: number;
    store?: Store;
  }
  export interface TaskError extends Error {
    args: any[];
  }
  export interface Store {
    isEmpty: () => Promise<boolean>;
    getQueued: () => Promise<number>;
    getNextTask: () => Promise<any[]>;
    pushTask: (...args: any[]) => void;
    clear: () => void;
  }
}

class TimeQueue extends EventEmitter {
  // TimeQueue options can be changed after initialization.
  public worker: TimeQueue.Worker;
  public concurrency: number;
  public every: number;
  public maxQueued: number;
  public timeout: number;

  private _isWorkerAsync: boolean;
  private _timers: NodeJS.Timer[];
  public store: TimeQueue.Store;

  // How many tasks are currently active.
  public active: number;

  // How many tasks are still being waited on,
  // in case the `every` option was used.
  public intransit: number;

  // How many tasks have finished.
  public finished: number;

  public static TaskError = class TaskError extends Error {
    public args: any[];
  }

  /**
   * @constructor
   * @extends {EventEmitter}
   * @param {Function(..., Function(!Error, ...)} worker
   * @param {Object?} options
   * @param {number?} options.concurrency
   * @param {number?} options.every
   * @param {number?} options.maxQueued
   * @param {number?} options.timeout
   */
  constructor(worker: TimeQueue.Worker, options: TimeQueue.Options = {}) {
    super();

    this.worker = worker;
    this._isWorkerAsync = worker.constructor.name == 'AsyncFunction';
    this.concurrency = options.concurrency || 1;
    this.every = options.every || 0;
    this.maxQueued = options.maxQueued || Infinity;
    this.timeout = options.timeout || 0;
    this.store = options.store || new MemoryStore({ maxQueued: this.maxQueued });
    this._timers = [];
    this.active = 0;
    this.intransit = 0;
    this.finished = 0;
  }


  /**
   * Pushes a task onto the queue.
   *
   * @param {Object} ...args
   * @param {Function(!Error, ...)} callback
   * @return {Promise?}
   */
  async push(...args: any[]) {
    // Returns a promise when no `callback` is given.
    if (this._isWorkerAsync && args.length === this.worker.length ||
      !this._isWorkerAsync && args.length < this.worker.length) {
      return new Promise((resolve, reject) => {
        // Add any missing arguments.
        if (!this._isWorkerAsync) {
          while (args.length < this.worker.length - 1) {
            args.push(undefined);
          }
        }
        TimeQueue.prototype.push.call(this, ...args, (err: Error | null, results: any) => {
          if (err) return reject(err);
          resolve(results);
        });
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
   *
   * @param {Array.<Object>} args
   */
  async _process(args: any[]) {
    const callback = args.pop();
    let finished = false;
    let every = ~~this.every;
    let tookLongerThanEvery: boolean;

    if (every) {
      tookLongerThanEvery = false;

      this._timers.push(setTimeout(() => {
        tookLongerThanEvery = true;
        this._timers.shift();
        if (finished) {
          this._next();
        }
      }, every));

    } else {
      tookLongerThanEvery = true;
    }

    // If `timeout` option is set, set a timeout to check the task doesn't lag.
    let taskTimedOut = false;
    let callbackCalled = false;
    let timeout = ~~this.timeout;
    let tid: NodeJS.Timer;

    const taskCallback = (err: Error | null, result?: any) => {
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
      this.finished++;
      this.active--;
      callback(err, result);

      finished = true;
      if (tookLongerThanEvery) {
        this._next();
      }
    };

    if (timeout) {
      tid = setTimeout(() => {
        const err = new TimeQueue.TaskError('Task timed out');
        err.args = args;
        taskCallback(err);
        taskTimedOut = true;
      }, timeout);
    }

    // Call the worker.
    if (this._isWorkerAsync) {
      try {
        taskCallback(null, await this.worker(...args));
      } catch (err) {
        taskCallback(err as Error);
      }
    } else {
      // Add custom callback to args.
      const args2 = args.slice();
      args2.push(taskCallback);
      this.worker(...args2);
    }
  }


  /**
   * Called when a task finishes. Looks at the queue and processes the next
   * waiting task.
   */
  async _next() {
    let task;
    if (this.intransit <= this.concurrency && (task = await this.store.getNextTask())) {
      this.active++;
      await this._process(task);

      if (await this.store.isEmpty()) {
        this.emit('empty');
      }

    } else if (--this.intransit === 0) {
      this.emit('drain');
    }
  }


  /**
   * Empties the queue and kills the timers.
   * Active tasks will still be completed.
   */
  die() {
    this.store.clear();
    this._timers.forEach(clearTimeout);
    this._timers = [];
    this.intransit = 0;
    this.active = 0;
  }
}

export = TimeQueue;
