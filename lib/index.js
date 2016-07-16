var EventEmitter = require('events').EventEmitter;
var util = require('util');


/**
 * @constructor
 * @extends {EventEmitter}
 * @param {Function(..., Function(!Error, ...)} worker
 * @param {Object} options
 * @param   {Number} concurrency
 * @param   {Number} time
 */
var TimeQueue = module.exports = function TimeQueue(worker, options) {
  EventEmitter.call(this);

  this.worker = worker;
  options = options || {};
  this.concurrency = options.concurrency || 1;
  this.every = options.every || 0;
  this.maxQueued = options.maxQueued || Infinity;
  this.timeout = options.timeout || 0;
  this._queue = [];
  this._timers = [];
};

util.inherits(TimeQueue, EventEmitter);


/**
 * How many tasks are currently active.
 */
TimeQueue.prototype.active = 0;


/**
 * How many tasks are still being waited on,
 * in case the `every` option was used.
 */
TimeQueue.prototype.intransit = 0;


/**
 * How many tasks are in the queue.
 */
TimeQueue.prototype.queued = 0;


/**
 * How many tasks have finished.
 */
TimeQueue.prototype.finished = 0;


/**
 * Pushes a task onto the queue.
 *
 * @param {Object} args...
 * @param {Function(!Error, ...)} callback
 */
TimeQueue.prototype.push = function() {
  if (this.maxQueued === this.queued) {
    return;
  }

  if (this.intransit < this.concurrency) {
    this.intransit++;
    this.active++;
    if (this.intransit === this.concurrency) {
      this.emit('full');
    }
    this._process(arguments);
  } else {
    this._queue.push(arguments);
    this.queued++;
  }
};


/**
 * Starts a task
 *
 * @param {Object} arguments
 */
TimeQueue.prototype._process = function(args) {
  args = Array.prototype.slice.call(args);
  var callback = args.splice(this.worker.length - 1, 1)[0];
  var self = this;
  var finished = false;

  var every = ~~this.every;
  var timedOut;

  if (every) {
    timedOut = false;

    self._timers.push(setTimeout(function everyTimeout() {
      timedOut = true;
      self._timers.shift();
      if (finished) {
        self._next();
      }
    }, every));

  } else {
    timedOut = true;
  }

  // If `timeout` option is set, set a timeout to check the task doesn't lag.
  var taskTimedOut = false;
  var callbackCalled = false;
  var timeout = ~~this.timeout;

  if (timeout) {
    var tid = setTimeout(function taskTimeout() {
      var err = new Error('Task timed out');
      err.args = args;
      taskCallback(err);
      taskTimedOut = true;
    }, timeout);
  }

  // Add missing arguments.
  while (args.length < this.worker.length - 1) {
    args.push(undefined);
  }

  function taskCallback(err) {
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

    self.finished++;
    self.active--;

    if (typeof callback === 'function') {
      // If a callback was given with the task,
      // call it when the task is finished.
      callback.apply(null, arguments);

    } else if (err) {
      // Otherwise emit an `error` event if there was an error with the task.
      self.emit('error', err);
    }

    finished = true;
    if (timedOut) {
      self._next();
    }

  }

  // Add custom callback to args.
  var args2 = args.slice();
  args2.push(taskCallback);

  // Call the worker.
  this.worker.apply(null, args2);
};


/**
 * Called when a task finishes. Looks at the queue and processes the next
 * waiting task.
 */
TimeQueue.prototype._next = function() {
  if (this.intransit <= this.concurrency && this._queue.length) {
    var task = this._queue.shift();
    this.queued--;
    this.active++;
    this._process(task);

    if (this._queue.length === 0) {
      this.emit('empty');
    }

  } else if (--this.intransit === 0) {
    this.emit('drain');
  }
};


/**
 * Empties the queue and kills the timers. Active tasks will still be completed.
 */
TimeQueue.prototype.die = function() {
  this._queue = [];
  this._timers.forEach(clearTimeout);
  this._timers = [];
  this.intransit = 0;
  this.active = 0;
  this.queued = 0;
};
