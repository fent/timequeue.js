const TimeQueue = require('..');
const assert = require('assert');
const sinon = require('sinon');


const concurrency = 3;
const every = 10;
const jobs = 10;

var clock;
before(() => { clock = sinon.useFakeTimers(); });
after(() => { clock.restore(); });

function runTest(type, worker) {
  describe('Create a queue with a time limit with ' + type, () => {
    var q = new TimeQueue(worker, { concurrency, every });

    it('Amount of concurrent tasks are not executed over the time limit',
      (done) => {
        var tid, n = 0, m = 0, timedOut = true;

        function checkJobsFinished() {
          var diff = q.finished - n;
          assert(diff <= concurrency);
          n = q.finished;
          clearTimeout(tid);

          if (q.finished === jobs) {
            done();
          } else {
            tid = setTimeout(() => {
              timedOut = true;
              m = 0;
              checkJobsFinished();
            }, every - 4); // setTimeout lags by 4ms on avg
            process.nextTick(() => {
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

runTest('immediate finish', (n, callback) => {
  process.nextTick(callback.bind(null, n));
});

runTest('finishing time decreasing', (n, callback) => {
  var ms = n < concurrency ? every + 10 : 0;
  setTimeout(callback.bind(null, n), ms);
  clock.tick(ms);
});

runTest('random finishing time', (n, callback) => {
  var ms = Math.floor(Math.random() * every * 2);
  setTimeout(callback.bind(null, n), ms);
  clock.tick(ms);
});
