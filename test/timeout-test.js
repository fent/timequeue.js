const TimeQueue = require('..');
const assert = require('assert');
const sinon = require('sinon');


describe('Create a queue with a timeout', () => {
  describe('With tasks that finish immediately', () => {
    it('Should execute tasks without problems', (done) => {
      const q = new TimeQueue(process.nextTick, { timeout: 1000 });
      for (let i = 0; i < 10; i++) {
        q.push();
      }
      q.on('drain', done);
    });
  });

  describe('With tasks that lag', () => {
    let clock;
    before(() => clock = sinon.useFakeTimers());
    after(() => clock.restore());

    it('Should reject', (done) => {
      const q = new TimeQueue((a, b, callback) => {
        setTimeout(callback, 100);
      }, { timeout: 50 });
      let p = q.push(3, 4);
      p.catch((err) => {
        assert(err);
        assert.equal(err.message, 'Task timed out');
        assert.equal(err.args[0], 3);
        assert.equal(err.args[1], 4);
        done();
      });
      clock.tick(100);
    });

    it('Should call the callback with the error', (done) => {
      const q = new TimeQueue((a, b, callback) => {
        setTimeout(callback, 100);
      }, { timeout: 50 });
      q.push('hello!', 'world', (err) => {
        assert(err);
        assert.equal(err.message, 'Task timed out');
        assert.equal(err.args[0], 'hello!');
        assert.equal(err.args[1], 'world');
        done();
      });
      clock.tick(50);
    });
  });
});
