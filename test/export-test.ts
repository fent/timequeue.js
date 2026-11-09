import assert from 'node:assert';
import TimeQueue, {
  TaskError as NamedTaskError,
  TimeQueue as NamedTimeQueue,
} from '..';

describe('Exports', () => {
  it('Exposes class as default and named export', () => {
    assert.strictEqual(TimeQueue, NamedTimeQueue);
    assert.strictEqual(TimeQueue.TimeQueue, TimeQueue);
    assert.strictEqual(TimeQueue.default, TimeQueue);
    assert.strictEqual(TimeQueue.TaskError, NamedTaskError);
  });
});
