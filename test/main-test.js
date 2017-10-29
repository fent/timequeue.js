const TimeQueue = require('..');
const assert = require('assert');


describe('Create a queue and add to it', () => {
  var full = false;

  var q = new TimeQueue(process.nextTick.bind(process), { concurrency: 3 });

  q.on('full', () => {
    full = true;
  });

  it('Does not execute more tasks than its concurrency', (done) => {
    q.push();
    assert.equal(q.active, 1);
    assert.equal(full, false);
    assert.equal(q.queued, 0);

    q.push();
    assert.equal(q.active, 2);
    assert.equal(full, false);
    assert.equal(q.queued, 0);

    q.push();
    assert.equal(q.active, 3);
    assert.equal(full, true);
    assert.equal(q.queued, 0);

    q.push();
    assert.equal(q.active, 3);
    assert.equal(full, true);
    assert.equal(q.queued, 1);

    q.push();
    assert.equal(q.active, 3);
    assert.equal(full, true);
    assert.equal(q.queued, 2);

    q.push();
    assert.equal(q.active, 3);
    assert.equal(full, true);
    assert.equal(q.queued, 3);

    q.on('drain', () => {
      assert.equal(q.active, 0);
      done();
    });
  });

  describe('With default options', () => {
    var q = new TimeQueue(process.nextTick.bind(process));
    it('Has defaults set', () => {
      assert.equal(q.concurrency, 1);
      assert.equal(q.every, 0);
      assert.equal(q.timeout, 0);
    });
  });
});


describe('Create a queue with variable number of arguments', () => {
  var lastA, lastB, lastC;
  var q = new TimeQueue((a, b, c, callback) => {
    lastA = a;
    lastB = b;
    lastC = c;
    process.nextTick(callback);
  }, { concurrency: 10, every: 1000 });

  it('Calls worker with correct arguments', () => {
    q.push(1, 2, 3);
    assert.equal(lastA, 1);
    assert.equal(lastB, 2);
    assert.equal(lastC, 3);

    q.push('a', 'b', 'hello');
    assert.equal(lastA, 'a');
    assert.equal(lastB, 'b');
    assert.equal(lastC, 'hello');
  });

  describe('Push with callback', () => {
    it('Calls callback when task finishes', (done) => {
      q.push(3, 2, 1, done);
      assert.equal(lastA, 3);
      assert.equal(lastB, 2);
      assert.equal(lastC, 1);
    });
  });

  describe('Push tasks without all of the arguments', () => {
    it('Considers arguments not provided undefined in the worker', () => {
      q.push(4, 2);
      assert.equal(lastA, 4);
      assert.equal(lastB, 2);
      assert.equal(lastC, undefined);

      q.push('not enough');
      assert.equal(lastA, 'not enough');
      assert.equal(lastB, undefined);
      assert.equal(lastC, undefined);

      q.push();
      assert.equal(lastA, undefined);
      assert.equal(lastB, undefined);
      assert.equal(lastC, undefined);
    });

    describe('Push with callback', () => {
      it('Calls callback when task finishes', (done) => {
        q.push('foo', 'bar', undefined, done);
        assert.equal(lastA, 'foo');
        assert.equal(lastB, 'bar');
        assert.equal(lastC, undefined);
      });
    });
  });
});


describe('Create a queue with a worker that always errors', () => {
  var q = new TimeQueue((callback) => {
    process.nextTick(() => {
      callback(new Error('gotcha'));
    });
  }, { concurrency: 10 });

  it('Emits an `error` event', (done) => {
    q.push();
    q.once('error', (err) => {
      assert.equal(err.message, 'gotcha');
      done();
    });
  });

  describe('Push task with callback', () => {
    it('Does not emit `error`, calls callback with error', (done) => {
      q.once('error', done);

      q.push((err) => {
        assert.equal(err.message, 'gotcha');
        done();
      });
    });
  });
});


describe('Create a queue with a callback called twice', () => {
  it('Throws an error', (done) => {
    var q = new TimeQueue((callback) => {
      assert.throws(() => {
        callback();
        callback();
      }, /should only be called once/);
      done();
    });
    q.push();
  });
});


describe('Create a queue then call its `die` method', () => {
  var n = 0;
  var q = new TimeQueue((callback) => {
    n++;
    process.nextTick(callback);
  }, { concurrency: 3 });

  it('Does not process queued tasks', (done) => {
    q.push();
    q.push();
    q.push();
    q.push();
    q.push();
    q.push();
    q.push();
    q.push();
    q.push();
    q.push();
    q.die();

    process.nextTick(() => {
      assert.equal(n, 3);
      done();
    });
  });
});
