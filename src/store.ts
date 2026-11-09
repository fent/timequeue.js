export interface StoreOptions {
  maxQueued: number;
}

export interface Store {
  getQueueLen(): Promise<number>;
  getNextTask(): Promise<unknown[] | undefined>;
  pushTask(args: unknown[]): Promise<void>;
  clear(): Promise<void>;
}
