var TimeQueue = require('..');
var assert = require('assert');
var sinon = require('sinon');


var concurrency = 3;
var every = 10;
var jobs = 10;

var clock;
before(function() { clock = sinon.useFakeTimers(); });
after(function() { clock.restore(); });

function runTest(type, worker) {
  describe('Create a queue with a time limit with ' + type, function() {
    var q = new TimeQueue(worker, { concurrency: concurrency, every: every });

    it('Amount of concurrent tasks are not executed over the time limit',
    function(done) {
      var tid, n = 0, m = 0, timedOut = true;

      function checkJobsFinished() {
        var diff = q.finished - n;
        assert(diff <= concurrency);
        n = q.finished;
        clearTimeout(tid);

        if (q.finished === jobs) {
          done();
        } else {
          tid = setTimeout(function() {
            timedOut = true;
            m = 0;
            checkJobsFinished();
          }, every - 4); // setTimeout lags by 4ms on avg
          process.nextTick(function() {
            clock.tick(every);
          });
        }
      }

      function jobFinished() {
        if (++m === concurrency && timedOut) {
          checkJobsFinished();
          timedOut = false;
        }
      }

      for (var i = 0; i < jobs; i++) {
        q.push(i, jobFinished);
      }
    });
  });
}

runTest('immediate finish', function(n, callback) {
  process.nextTick(callback.bind(null, n));
});

runTest('finishing time decreasing', function(n, callback) {
  var ms = n < concurrency ? every + 10 : 0;
  setTimeout(callback.bind(null, n), ms);
  clock.tick(ms);
});

runTest('random finishing time', function(n, callback) {
  var ms = Math.floor(Math.random() * every * 2);
  setTimeout(callback.bind(null, n), ms);
  clock.tick(ms);
});
