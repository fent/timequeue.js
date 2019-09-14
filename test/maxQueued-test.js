const TimeQueue = require('..');
const assert = require('assert');


describe('Create a queue and add to it', () => {
  it('Ignores tasks pushed after it is full', (done) => {
    let n = 0;
    const q = new TimeQueue((callback) => {
      n++;
      process.nextTick(callback);
    }, {
      concurrency: 3,
      maxQueued: 2
    });

    for (let i = 0; i < 10; i++) {
      q.push();
    }

    q.on('drain', () => {
      assert.equal(n, 5);
      done();
    });
  });
});
