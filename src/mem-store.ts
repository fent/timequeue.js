import type { Store, StoreOptions } from './store';

export default class MemoryStore implements Store {
  public maxQueued: number;
  // biome-ignore lint/suspicious/noExplicitAny: queue holds arbitrary task arguments
  private _queue: any[][];
  constructor(options: StoreOptions) {
    this.maxQueued = options.maxQueued;
    this._queue = [];
  }
  async getQueueLen() {
    return this._queue.length;
  }
  async getNextTask() {
    return this._queue.shift();
  }
  // biome-ignore lint/suspicious/noExplicitAny: arbitrary task arguments
  async pushTask(args: any[]) {
    if (this._queue.length < this.maxQueued) {
      this._queue.push(args);
    }
  }
  async clear() {
    this._queue = [];
  }
}
