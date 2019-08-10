const EventEmitter = require('events').EventEmitter;


module.exports = class TimeQueue extends EventEmitter {
  /**
   * @constructor
   * @extends {EventEmitter}
   * @param {Function(..., Function(!Error, ...)} worker
   * @param {Object} options
   * @param {number} options.concurrency
   * @param {number} options.time
   */
  constructor(worker, options) {
    super();

    this.worker = worker;
    options = options || {};
    this.concurrency = options.concurrency || 1;
    this.every = options.every || 0;
    this.maxQueued = options.maxQueued || Infinity;
    this.timeout = options.timeout || 0;
    this._queue = [];
    this._timers = [];

    // How many tasks are currently active.
    TimeQueue.prototype.active = 0;

    // How many tasks are still being waited on,
    // in case the `every` option was used.
    TimeQueue.prototype.intransit = 0;

    // How many tasks are in the queue.
    TimeQueue.prototype.queued = 0;

    // How many tasks have finished.
    TimeQueue.prototype.finished = 0;
  }


  /**
   * Pushes a task onto the queue.
   *
   * @param {Object} ...args
   * @param {Function(!Error, ...)} callback
   */
  push(...args) {
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
  _process(args) {
    const callback = args.splice(this.worker.length - 1, 1)[0];
    let finished = false;
    let every = ~~this.every;
    let timedOut;

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
    let tid;

    const taskCallback = (err, ...args) => {
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

      if (typeof callback === 'function') {
        // If a callback was given with the task,
        // call it when the task is finished.
        callback(err, ...args);

      } else if (err) {
        // Otherwise emit an `error` event if there was an error with the task.
        this.emit('error', err);
      }

      finished = true;
      if (timedOut) {
        this._next();
      }
    };

    if (timeout) {
      tid = setTimeout(() => {
        const err = Error('Task timed out');
        err.args = args;
        taskCallback(err);
        taskTimedOut = true;
      }, timeout);
    }

    // Add missing arguments.
    while (args.length < this.worker.length - 1) {
      args.push(undefined);
    }

    // Add custom callback to args.
    const args2 = args.slice();
    args2.push(taskCallback);

    // Call the worker.
    this.worker(...args2);
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
};
