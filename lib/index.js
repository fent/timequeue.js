var EventEmitter = require('events').EventEmitter
  , util = require('util')
  ;


/**
 * @constructor
 * @extends (EventEmitter)
 * @param (Function(..., Function(!Error, ...)) worker
 * @param (number) concurrency
 * @param (number) time
 */
var TimeQueue = module.exports = function(worker, concurrency, time) {
  EventEmitter.call(this);

  this.worker = worker;
  this.concurrency = concurrency || 1;
  this.time = typeof time === 'undefined' ? 1000 : time;
  this._queue = [];
  this._timers = [];
};

util.inherits(TimeQueue, EventEmitter);


/**
 * How many tasks are currently active.
 */
TimeQueue.prototype.active = 0;


/**
 * How many tasks are in the queue.
 */
TimeQueue.prototype.queued = 0;


/**
 * Pushes a task onto the queue.
 *
 * @param (Object) args...
 * @param (Function(!Error, ...)) callback
 */
TimeQueue.prototype.push = function() {
  if (this.active < this.concurrency) {
    if (++this.active === this.concurrency) {
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
 * @param (Object) arguments
 */
TimeQueue.prototype._process = function(args) {
  args = Array.prototype.slice.call(args);
  var callback = args.splice(this.worker.length - 1, 1)[0];
  var self = this;
  var finished = false;

  var time = ~~this.time;
  var timedOut;
  if (time) {
    timedOut = false;

    self._timers.push(setTimeout(function() {
      timedOut = true;
      self._timers.shift();
      if (finished) {
        self._next();
      }
    }, time));

  } else {
    timedOut = true;
  }

  // add missing arguments
  while (args.length < this.worker.length - 1) {
    args.push(undefined);
  }

  // add custom callback to args
  args.push(function(err) {

    if (typeof callback === 'function') {
      // if a callback was given with the task,
      // call it when the task is finished
      callback.apply(null, arguments);

    } else if (err) {
      // otherwise emit an `error` event if there was an error with the task
      self.emit('error', err);
    }

    finished = true;
    if (timedOut) {
      self._next();
    }

  });

  this.worker.apply(null, args);
};


/**
 * Called when a task finishes. Looks at the queue and processes the next
 * waiting task.
 */
TimeQueue.prototype._next = function() {
  if (this.active <= this.concurrency && this._queue.length) {
    var task = this._queue.shift();
    this.queued--;
    this._process(task);

    if (this._queue.length === 0) {
      this.emit('empty');
    }

  } else if (--this.active === 0) {
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
  this.active = 0;
  this.queued = 0;
};
