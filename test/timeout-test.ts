import TimeQueue from '..';
import assert from 'assert';


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
    it('Should reject', (done) => {
      const q = new TimeQueue((a, b, callback) => {
        setTimeout(callback, 100);
      }, { timeout: 30 });
      let p = q.push(3, 4);
      p.catch((err) => {
        assert(err);
        assert.equal(err.message, 'Task timed out');
        assert.equal(err.args[0], 3);
        assert.equal(err.args[1], 4);
        done();
      });
    });

    it('Should call the callback with the error', (done) => {
      const q = new TimeQueue((a, b, callback) => {
        setTimeout(callback, 100);
      }, { timeout: 30 });
      q.push('hello!', 'world', (err: TimeQueue.TaskError | null) => {
        assert(err);
        assert.equal(err.message, 'Task timed out');
        assert.equal(err.args[0], 'hello!');
        assert.equal(err.args[1], 'world');
        done();
      });
    });
  });
});
