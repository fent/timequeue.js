export class Options {
  maxQueued?: number;
}
export default class MemoryStore {
  public maxQueued: number;
  private _queue: any[][]
  constructor(options: Options) {
    this.maxQueued = options.maxQueued;
    this._queue = [];
  }
  async isEmpty() {
    return this._queue.length === 0;
  }
  async getQueued() {
    return this._queue.length;
  }
  async getNextTask() {
    return this._queue.shift();
  }
  async pushTask(args: any[]) {
    if (this._queue.length < this.maxQueued) {
      this._queue.push(args);
    }
  }
  async clear() {
    this._queue = [];
  }
}
