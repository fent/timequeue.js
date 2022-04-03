import TimeQueue, { Worker } from '..';
import assert from 'assert';


const concurrency = 3;
const every = 10;
const jobs = 10;

const runTest = (type: string, worker: Worker) => {
  describe('Create a queue with a time limit with ' + type, () => {
    const q = new TimeQueue(worker, { concurrency, every });

    it('Amount of concurrent tasks are not ran over time limit', (done) => {
      let lastTaskFinished = 0;
      let taskFinished = 0;

      const checkJobsFinished = () => {
        const diff = q.finished - lastTaskFinished;
        assert(diff <= concurrency);
        lastTaskFinished = q.finished;

        if (q.finished === jobs) {
          done();
        }
      };

      const jobFinished = () => {
        if (++taskFinished >= concurrency) {
          checkJobsFinished();
        }
      };

      for (let i = 0; i < jobs; i++) {
        q.push(i, jobFinished);
      }
    });
  });
};

runTest('immediate finish', (taskNum, callback) => {
  process.nextTick(callback.bind(null, taskNum));
});

runTest('finishing time decreasing', (taskNum, callback) => {
  let ms = taskNum < concurrency ? every + 10 : 0;
  setTimeout(callback.bind(null, taskNum), ms);
});

runTest('random finishing time', (taskNum, callback) => {
  let ms = Math.floor(Math.random() * every * 2);
  setTimeout(callback.bind(null, taskNum), ms);
});
