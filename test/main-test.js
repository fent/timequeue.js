const TimeQueue = require('..');
const assert = require('assert');


describe('Create a queue and add to it', () => {
  it('Does not execute more tasks than its concurrency', (done) => {
    const q = new TimeQueue(callback => process.nextTick(callback), { concurrency: 3 });

    let full = false;
    q.on('full', () => { full = true; });

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
    const q = new TimeQueue(process.nextTick.bind(process));
    it('Has defaults set', () => {
      assert.equal(q.concurrency, 1);
      assert.equal(q.every, 0);
      assert.equal(q.timeout, 0);
    });
  });

  describe('with an async worker', () => {
    it('Still respects concurrency', (done) => {
      const q = new TimeQueue(async (a, b) => {
        return await new Promise((resolve) => {
          process.nextTick(() => resolve(a + b));
        });
      }, { concurrency: 2 });
      let result1, result2, result3;
      q.push(1, 2, (err, result) => {
        assert.ifError(err);
        result1 = result;
      });
      q.push(3, 4, (err, result) => {
        assert.ifError(err);
        result2 = result;
      });
      q.push(5, 6, (err, result) => {
        assert.ifError(err);
        result3 = result;
      });
      assert.equal(q.active, 2);
      q.on('drain', () => {
        assert.equal(result1, 3);
        assert.equal(result2, 7);
        assert.equal(result3, 11);
        done();
      });
    });
    it('Pushing to worker can be awaited', async () => {
      const q = new TimeQueue(async (a, b) => {
        return new Promise((resolve) => {
          process.nextTick(() => resolve(a + b));
        });
      }, { concurrency: 1 });
      let result1 = await q.push(1, 2);
      let result2 = await q.push(3, 4);
      assert.equal(result1, 3);
      assert.equal(result2, 7);
    });
    describe('that errors', () => {
      it('Calls callback with error', (done) => {
        const q = new TimeQueue(async (a) => {
          return new Promise((resolve, reject) => {
            process.nextTick(() => reject(Error('no: ' + a)));
          });
        });
        q.push('one', (err) => {
          assert.ok(err);
          assert.equal(err.message, 'no: one');
          done();
        });
      });
      it('Throws when awaited', async () => {
        const q = new TimeQueue(async (a) => {
          return new Promise((resolve, reject) => {
            process.nextTick(() => reject(Error('no: ' + a)));
          });
        });
        try {
          await q.push('okay');
        } catch (err) {
          assert.ok(err);
          assert.equal(err.message, 'no: okay');
          return;
        }
        throw Error('shoult not get here');
      });
    });
  });
});


describe('Create a queue with variable number of arguments', () => {
  it('Calls worker with correct arguments', () => {
    let lastA, lastB, lastC;
    const q = new TimeQueue((a, b, c, callback) => {
      lastA = a;
      lastB = b;
      lastC = c;
      process.nextTick(callback);
    }, { concurrency: 10 });

    q.push(1, 2, 3);
    assert.equal(lastA, 1);
    assert.equal(lastB, 2);
    assert.equal(lastC, 3);

    q.push('a', 'b', 'hello');
    assert.equal(lastA, 'a');
    assert.equal(lastB, 'b');
    assert.equal(lastC, 'hello');
  });

  it('Returns a promise that fulfills', async () => {
    const q = new TimeQueue((a, b, c, callback) => {
      process.nextTick(() => {
        callback(null, a + b + c);
      });
    }, { concurrency: 10 });
    let result = await q.push(1, 2, 3);
    assert.equal(result, 6);
  });

  describe('Push with callback', () => {
    it('Calls callback when task finishes', (done) => {
      let lastA, lastB, lastC;
      const q = new TimeQueue((a, b, c, callback) => {
        lastA = a;
        lastB = b;
        lastC = c;
        process.nextTick(callback);
      }, { concurrency: 10 });
      q.push(3, 2, 1, done);
      assert.equal(lastA, 3);
      assert.equal(lastB, 2);
      assert.equal(lastC, 1);
    });
  });

  describe('Push tasks without all of the arguments', () => {
    it('Considers arguments not provided undefined in the worker', () => {
      let lastA, lastB, lastC;
      const q = new TimeQueue((a, b, c, callback) => {
        lastA = a;
        lastB = b;
        lastC = c;
        process.nextTick(callback);
      }, { concurrency: 10 });

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
        let lastA, lastB, lastC;
        const q = new TimeQueue((a, b, c, callback) => {
          lastA = a;
          lastB = b;
          lastC = c;
          process.nextTick(callback);
        }, { concurrency: 10 });
        q.push('foo', 'bar', undefined, done);
        assert.equal(lastA, 'foo');
        assert.equal(lastB, 'bar');
        assert.equal(lastC, undefined);
      });
    });
  });
});


describe('Create a queue with a worker that always errors', () => {
  const q = new TimeQueue((callback) => {
    process.nextTick(() => {
      callback(Error('gotcha'));
    });
  }, { concurrency: 10 });

  it('Trhows an error', async () => {
    try {
      await q.push();
    } catch (err) {
      assert.equal(err.message, 'gotcha');
      return;
    }
    throw Error('should have thrown');
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
    const q = new TimeQueue((callback) => {
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
  it('Does not process queued tasks', (done) => {
    let n = 0;
    const q = new TimeQueue((callback) => {
      n++;
      process.nextTick(callback);
    }, { concurrency: 3 });

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
