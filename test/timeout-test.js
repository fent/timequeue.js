const TimeQueue = require('..');
const assert = require('assert');
const sinon = require('sinon');


describe('Create a queue with a timeout', () => {
  describe('With tasks that finish immediately', () => {
    const q = new TimeQueue(process.nextTick, { timeout: 1000 });

    it('Should execute tasks without problems', (done) => {
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

    /* jshint unused: false */
    const q = new TimeQueue((a, b, callback) => {
      setTimeout(callback, 100);
    }, { timeout: 50 });

    it('Should throw an error', (done) => {
      q.push(3, 4);
      q.on('error', (err) => {
        assert(err);
        assert.equal(err.message, 'Task timed out');
        assert.equal(err.args[0], 3);
        assert.equal(err.args[1], 4);
        done();
      });
      clock.tick(100);
    });

    it('Should call the callback with the error', (done) => {
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
