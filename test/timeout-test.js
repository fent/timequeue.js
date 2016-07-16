var TimeQueue = require('..');
var assert = require('assert');
var sinon = require('sinon');


describe('Create a queue with a timeout', function() {
  describe('With tasks that finish immediately', function() {
    var q = new TimeQueue(process.nextTick, { timeout: 1000 });

    it('Should execute tasks without problems', function(done) {
      for (var i = 0; i < 10; i++) {
        q.push();
      }

      q.on('drain', done);
    });
  });

  describe('With tasks that lag', function() {
    var clock;
    before(function() { clock = sinon.useFakeTimers(); });
    after(function() { clock.restore(); });

    /* jshint unused: false */
    var q = new TimeQueue(function(a, b, callback) {
      setTimeout(callback, 100);
    }, { timeout: 50 });

    it('Should throw an error', function(done) {
      q.push(3, 4);
      q.on('error', function(err) {
        assert(err);
        assert.equal(err.message, 'Task timed out');
        assert.equal(err.args[0], 3);
        assert.equal(err.args[1], 4);
        done();
      });
      clock.tick(100);
    });

    it('Should call the callback with the error', function(done) {
      q.push('hello!', 'world', function(err) {
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
