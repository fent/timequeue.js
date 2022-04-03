# timequeue.js

A queue with custom concurrency and time limits. Inspired by [async/queue](https://caolan.github.io/async/v3/docs.html#queue), but also with variable number of arguments in the worker, events, and with optional time limits.

![Depfu](https://img.shields.io/depfu/fent/timequeue.js)
[![codecov](https://codecov.io/gh/fent/timequeue.js/branch/master/graph/badge.svg)](https://codecov.io/gh/fent/timequeue.js)

# Usage

```js
const TimeQueue = require('timequeue');

const worker = (arg1, arg2, callback) => {
  someAsyncFunction(calculation(arg1, arg2), callback);
};

// Worker can be an async function.
const worker = async (arg1) => {
  let result1 = await anotherSyncFunction(arg1);
  return andAnotherOne(result1);
};

// create a queue with max 5 concurrency every second
let q = new TimeQueue(worker, { concurrency: 5, every: 1000 });

// Push tasks onto the queue.
q.push(42, 24);
q.push(2, 74);

// Optional callback when pushing tasks.
q.push(2, 2, (err, result) => {
  // task finished
});

// Can use promise/await syntax instead.
let result = await q.push(3, 5);
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
  // If the max amount of concurrent tasks finish faster than this time limit,
  // additional tasks will wait until enough time has passed before starting.
, every: 0

  // Maximum number of tasks to keep in the queue.
  // While full, pushed tasks will be ignored.
, maxQueued: Infinity

  // If set, tasks will error if they take too much time.
  // if callback was given to that task, it will be called with the error,
  // otherwise, the returned promise should be `caught`.
, timeout: 0

  // You can pass a custom store to share tasks between several queues.
  // Default is MemoryStore from `src/mem-store.ts`.
  // Look at `example/redis-store.js` for an example that saves tasks onto redis.
, store: MemoryStore
}
```

All of these options can later be edited on the queue instance.

### TimeQueue#active
How many tasks are currently active.

### TimeQueue#intransit
If you use the `every` option to queue up tasks, this property will be delayed from being updated until there are free spots open for new tasks to begin. `active` will be updated as soon as a task finishes, even if the next one is just a timeout around the corner.

### TimeQueue#finished
How many tasks have finished in total.

### async TimeQueue#push(data..., [callback])
Pushes a new task to the queue. Any number of arguments can be given. An optional callback can also be given as the last parameter. The callback will be called when the task is finished or if there was any error running the worker.

If the queue is full, pushed tasks will be ignored.

### async TimeQueue#store.getQueueLen()
How many tasks are currently in the queue.

### TimeQueue#isFull()
Returns true if queue is full.

### TimeQueue#die()
Empties queue and clears the timeouts TimeQueue sets to keep track of running tasks. Currently running tasks will still complete.

# Events

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
