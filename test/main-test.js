var TimeQueue = require('..')
  , assert = require('assert')
  ;


describe('Create a queue and add to it', function() {
  var n = 0;
  var full = false;

  var q = new TimeQueue(function(callback) {
    n++;
    process.nextTick(function() {
      n--;
      callback();
    });
  }, 3, 0);

  q.on('full', function() {
    full = true;
  });

  it('Does not execute more tasks than its concurrency', function(done) {
    q.push();
    assert.equal(n, 1);
    assert.equal(full, false);

    q.push();
    assert.equal(n, 2);
    assert.equal(full, false);

    q.push();
    assert.equal(n, 3);
    assert.equal(full, true);

    q.push();
    assert.equal(n, 3);
    assert.equal(full, true);

    q.push();
    assert.equal(n, 3);
    assert.equal(full, true);

    q.push();
    assert.equal(n, 3);
    assert.equal(full, true);

    q.on('drain', done);
  });
});


describe('Create a queue with variable number of arguments', function() {
  var lastA, lastB, lastC;
  var q = new TimeQueue(function(a, b, c, callback) {
    lastA = a;
    lastB = b;
    lastC = c;
    process.nextTick(callback);
  }, 10);

  it('Calls worker with correct arguments', function() {
    q.push(1, 2, 3);
    assert.equal(lastA, 1);
    assert.equal(lastB, 2);
    assert.equal(lastC, 3);

    q.push('a', 'b', 'hello');
    assert.equal(lastA, 'a');
    assert.equal(lastB, 'b');
    assert.equal(lastC, 'hello');
  });

  describe('Push with callback', function() {
    it('Calls callback when task finishes', function(done) {
      q.push(3, 2, 1, done);
      assert.equal(lastA, 3);
      assert.equal(lastB, 2);
      assert.equal(lastC, 1);
    });
  });

  describe('Push tasks without all of the arguments', function() {
    it('Considers arguments not provided undefined in the worker', function() {
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

    describe('Push with callback', function() {
      it('Calls callback when task finishes', function(done) {
        q.push('foo', 'bar', undefined, done);
        assert.equal(lastA, 'foo');
        assert.equal(lastB, 'bar');
        assert.equal(lastC, undefined);
      });
    });
  });
});


describe('Create a queue with a worker that always errors', function() {
  var q = new TimeQueue(function(callback) {
    process.nextTick(function() {
      callback(new Error('gotcha'));
    });
  }, 10);

  it('Emits an `error` event', function(done) {
    q.push('whatever');
    q.once('error', function(err) {
      assert.equal(err.message, 'gotcha');
      done();
    });
  });

  describe('Push task with callback', function() {
    it('Does not emit `error` event, calls calback with error', function(done) {
      q.once('error', function(err) {
        throw err;
      });

      q.push(function(err) {
        assert.equal(err.message, 'gotcha');
        done();
      });
    });
  });
});


describe('Create a queue with a time limit', function() {
  var concurrency = 3;
  var time = 100;
  var n = 0;

  var q = new TimeQueue(function(callback) {
    n++;
    setTimeout(function() {
      n--;
      callback();
    }, Math.floor(Math.random() * time * 2));
  }, concurrency, time);

  it('Concurrency does not exceed the time limit', function(done) {
    for (var i = 0; i < 10; i++) {
      q.push();
      assert.ok(n <= concurrency);
    }

    q.on('drain', done);
  });
});
