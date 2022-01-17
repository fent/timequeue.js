import TimeQueue from '..';
import assert from 'assert';


describe('Create a queue and add to it', () => {
  it('Does not execute more tasks than its concurrency', (done) => {
    const q = new TimeQueue(callback => { setTimeout(callback, 10); }, { concurrency: 3 });

    let full = false;
    q.on('full', () => {
      full = true;
      assert.equal(q.active, 3);
    });

    q.push();
    assert.equal(q.active, 1);
    assert.equal(full, false);

    q.push();
    assert.equal(q.active, 2);
    assert.equal(full, false);

    q.push();
    assert.equal(q.active, 3);
    assert.equal(full, true);

    // Should be full here.

    q.push();
    assert.equal(q.active, 3);
    assert.equal(full, true);

    q.push();
    assert.equal(q.active, 3);
    assert.equal(full, true);

    q.push();
    assert.equal(q.active, 3);
    assert.equal(full, true);

    q.on('drain', async() => {
      assert.equal(q.active, 0);
      assert.equal(await q.store.getQueued(), 0);
      done();
    });
  });

  describe('With default options', () => {
    it('Has defaults set', () => {
      const q = new TimeQueue(process.nextTick.bind(process));
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
      let result1: number, result2: number, result3: number;
      q.push(1, 2, (err: Error | null, result: number) => {
        assert.ifError(err);
        result1 = result;
      });
      q.push(3, 4, (err: Error | null, result: number) => {
        assert.ifError(err);
        result2 = result;
      });
      q.push(5, 6, (err: Error | null, result: number) => {
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
      }, { concurrency: 1, every: 100 });
      let result1 = await q.push(1, 2);
      let result2 = await q.push(3, 4);
      let result3 = await q.push(5, 6);
      assert.equal(result1, 3);
      assert.equal(result2, 7);
      assert.equal(result3, 11);
    });
    describe('that errors', () => {
      it('Calls callback with error', (done) => {
        const q = new TimeQueue(async (a) => {
          return new Promise((_resolve, reject) => {
            process.nextTick(() => reject(Error('no: ' + a)));
          });
        });
        q.push('one', (err: Error | null) => {
          assert.ok(err);
          assert.equal(err.message, 'no: one');
          done();
        });
      });
      it('Throws when awaited', async () => {
        const q = new TimeQueue(async (a) => {
          return new Promise((_resolve, reject) => {
            process.nextTick(() => reject(Error('no: ' + a)));
          });
        });
        try {
          await q.push('okay');
        } catch (err) {
          assert.ok(err);
          assert.equal((err as Error).message, 'no: okay');
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
  it('Throws an error', async () => {
    const q = new TimeQueue((callback) => {
      process.nextTick(() => { callback(Error('gotcha')); });
    }, { concurrency: 10 });
    try {
      await q.push();
    } catch (err) {
      assert.equal((err as Error).message, 'gotcha');
      return;
    }
    throw Error('should have thrown an earlier error');
  });

  describe('Push task with callback', () => {
    it('Does not emit `error`, calls callback with error', (done) => {
      const q = new TimeQueue((callback) => {
        process.nextTick(() => { callback(Error('gotcha')); });
      }, { concurrency: 10 });
      q.once('error', done);

      q.push((err: Error | null) => {
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
