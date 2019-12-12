const EventEmitter = require('events').EventEmitter;

namespace TimeQueue {
  export type Worker = (...args: any[]) => void | Promise<any>;
  export interface Options {
    concurrency?: number;
    every?: number;
    maxQueued?: number;
    timeout?: number;
  }
  export interface TaskError extends Error {
    args: any[];
  }
}

class TimeQueue extends EventEmitter {
  // TimeQueue options can be changed after initialization.
  public worker: TimeQueue.Worker;
  public concurrency: number;
  public every: number;
  public maxQueued: number;
  public timeout: number;

  private _workerAsync: boolean;
  private _queue: any[][];
  private _timers: NodeJS.Timer[];

  // How many tasks are currently active.
  public active: number;

  // How many tasks are still being waited on,
  // in case the `every` option was used.
  public intransit: number;

  // How many tasks are in the queue.
  public queued: number;

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
    this._workerAsync = worker.constructor.name == 'AsyncFunction';
    this.concurrency = options.concurrency || 1;
    this.every = options.every || 0;
    this.maxQueued = options.maxQueued || Infinity;
    this.timeout = options.timeout || 0;
    this._queue = [];
    this._timers = [];
    this.active = 0;
    this.intransit = 0;
    this.queued = 0;
    this.finished = 0;
  }


  /**
   * Pushes a task onto the queue.
   *
   * @param {Object} ...args
   * @param {Function(!Error, ...)} callback
   * @return {Promise?}
   */
  push(...args: any[]) {
    // Returns a promise no `callback` is given.
    if (this._workerAsync && args.length === this.worker.length ||
      !this._workerAsync && args.length < this.worker.length) {
      return new Promise((resolve, reject) => {
        // Add any missing arguments.
        if (!this._workerAsync) {
          while (args.length < this.worker.length - 1) {
            args.push(undefined);
          }
        }
        this.push(...args, (err: Error | null, results: any) => {
          if (err) return reject(err);
          resolve(results);
        });
      });
    }

    if (this.isFull()) {
      return;
    }

    if (this.intransit < this.concurrency) {
      this.intransit++;
      this.active++;
      if (this.intransit === this.concurrency) {
        this.emit('full');
      }
      this._process(args);
    } else {
      this._queue.push(args);
      this.queued++;
    }
  }


  /**
   * Returns true if queue is full.
   *
   * @return {boolean}
   */
  isFull() {
    return this.maxQueued === this.queued;
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
    let timedOut: boolean;

    if (every) {
      timedOut = false;

      this._timers.push(setTimeout(() => {
        timedOut = true;
        this._timers.shift();
        if (finished) {
          this._next();
        }
      }, every));

    } else {
      timedOut = true;
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
      if (timedOut) {
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
    if (this._workerAsync) {
      try {
        taskCallback(null, await this.worker(...args));
      } catch (err) {
        taskCallback(err);
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
  _next() {
    if (this.intransit <= this.concurrency && this._queue.length) {
      this.queued--;
      this.active++;
      this._process(this._queue.shift());

      if (this._queue.length === 0) {
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
    this._queue = [];
    this._timers.forEach(clearTimeout);
    this._timers = [];
    this.intransit = 0;
    this.active = 0;
    this.queued = 0;
  }
}

export = TimeQueue;
