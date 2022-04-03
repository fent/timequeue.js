export class StoreOptions {
  maxQueued?: number;
}

export interface Store {
  getQueueLen(): Promise<number>;
  getNextTask(): Promise<any[]>;
  pushTask(...args: any[]): Promise<void>;
  clear(): Promise<void>;
}
