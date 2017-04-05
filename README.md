# timequeue.js

A queue with custom concurrency and time limits. Inspired by [caolan/async#queue](https://github.com/caolan/async#queue), but with variable number of arguments in the worker, events, and with optional time limits.

[![Build Status](https://secure.travis-ci.org/fent/timequeue.js.svg)](http://travis-ci.org/fent/timequeue.js)
[![Dependency Status](https://david-dm.org/fent/timequeue.js.svg)](https://david-dm.org/fent/timequeue.js)
[![codecov](https://codecov.io/gh/fent/timequeue.js/branch/master/graph/badge.svg)](https://codecov.io/gh/fent/timequeue.js)

# Usage

```js
var TimeQueue = require('timequeue');

function worker(arg1, arg2, callback) {
  someAsyncFunction(calculation(arg1, arg2), callback);
}

// create a queue with max 5 concurrency every second
var q = new TimeQueue(worker, { concurrency: 5, every: 1000 });

// push tasks onto the queue
q.push(42, 24);
q.push(2, 74);

// optional callback when pushing tasks
q.push(2, 2, function(err) {
  // task finished
});
```


# API
### new TimeQueue(worker, [options])
Creates a new instance of a queue. Worker must be a function with a callback for its last argument. The callback must be called in order for the queue to know when the worker has finished a task. `options` defaults to the following

```js
{
  // Maximum tasks to execute concurrently.
  concurrency: 1

  // How much time in milliseconds to allow no more than
  // the max number of concurrent tasks to run.
  // If the max amount of concurrent tasks are finished faster than the limit,
  // they will be queued.
, every: 0

  // Maximum number of tasks to keep in the queue.
  // While full, pushed tasks will be ignored.
, maxQueued: Infinity

  // If set, will emit an `error` event if a tasks takes too much time.
  // if callback was given to that task,
  // it will be called with the error instead.
, timeout: 0
}
```

All of these options can later be edited on the queue instance.

### TimeQueue#active

How many tasks are currently active.

### TimeQueue#intransit

If you use the `every` option to queue up tasks, this property will be delayed from being updated until there are free spots open for new tasks to begin. `active` will be updated as soon as a task finishes, even if the next one is just a timeout around the corner.

### TimeQueue#queued

How many tasks are currently in the queue.

### TimeQueue#finished

How many tasks have finished in total.

### TimeQueue#push(data..., [callback])
Pushes a new task to the queue. Any number of arguments can be given. An optional callback can also be given as the last parameter. The callback will be called when the task is finished or if there was any error.

### TimeQueue#die()
Empties queue and clears the timeouts TimeQueue sets to keep track of running tasks. Currently running tasks will still complete.

# Events

### Event: 'error'
* `Error`

Emitted when there is an error processing a task and a callback isn't given to the `push` method.

### Event: 'full'

Queue is full.

### Event: 'empty'

Queue is empty, with tasks still running.

### Event: 'drain'

Queue is empty and last task has finished.


# Install

    npm install timequeue


# Tests
Tests are written with [mocha](https://mochajs.org)

```bash
npm test
```

# License
MIT
