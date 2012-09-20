var TimeQueue = require('..')
  , assert = require('assert')
  ;


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
    var q = new TimeQueue(function() {}, { timeout: 50 });

    it('Should throw an error', function(done) {
      q.push();
      q.on('error', function(err) {
        assert(err);
        assert.equal(err.message, 'Task timed out');
        done();
      });
    });

    it('Should call the callback with the error', function() {
      q.push(function(err) {
        assert(err);
        assert.equal(err.message, 'Task timed out');
        done();
      });
    });
  });
});
