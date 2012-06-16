# timequeue.js [![Build Status](https://secure.travis-ci.org/fent/timequeue.js.png)](http://travis-ci.org/fent/timequeue.js)

A queue with custom concurrency and time limits. Inspired by [caolan/async#queue](https://github.com/caolan/async#queue), but with variable number of arguments in the worker, events, and with optional time limits.


# Usage

```js
var TimeQueue = require('timequeue');

function worker(arg1, arg2, callback) {
  someAsyncFunction(transform(arg1, arg2), callback);
}

// create a queue with max 5 concurrency every second
var q = new TimeQueue(worker, 5, 1000);

// push tasks onto the queue
q.push({ some: 'data' });
q.push({ more: 'data' });
```


# API
### new TimeQueue(worker, [concurrency], [time])
Creates a new instance of a queue. Worker must be a function with a callback for its last argument. The callback must be called in order for the queue to know when the worker has finished a task. `concurrency` defaults to `1` and `time` to `1000`. Meaning one task in the queue will be executed a maximum of one time per second. If `time` is set to `0`, there will be no time limit.

`worker`, `concurrency` and `time` properties can later be edited on the queue instance.

### TimeQueue#push(data..., [callback])
Pushes a new task to the queue. Any number of arguments can be given. An optional callback can also be given as the last parameter. The callback will be called when the task is finished or if there was any error.

# Events

### Event: 'error'
`function (err) { }`

Emitted when there is an error processing a task and a callback isn't given to the `push` method.

### Event: 'full'
`function () { }`

Queue is full.

### Event: 'empty'
`function () { }`

Queue is empty, some tasks might still be running.

### Event: 'drain'
`function () { }`

Queue is empty and last task has finished.


# Install

    npm install timequeue


# Tests
Tests are written with [mocha](http://visionmedia.github.com/mocha/)

```bash
npm test
```

# License
MIT
