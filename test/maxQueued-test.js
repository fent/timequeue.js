var TimeQueue = require('..')
  , assert = require('assert')
  ;


describe('Create a queue and add to it', function() {
  var n = 0;
  var q = new TimeQueue(function worker(callback) {
    n++;
    process.nextTick(callback);
  }, {
    concurrency: 3,
    maxQueued: 2
  });

  it('Ignores tasks pushed after it is full', function(done) {
    for (var i = 0; i < 10; i++) {
      q.push();
    }

    q.on('drain', function() {
      assert.equal(n, 5);
      done();
    });
  });
});
