export interface StoreOptions {
  maxQueued?: number;
}

export interface Store {
  getQueueLen(): Promise<number>;
  // biome-ignore lint/suspicious/noExplicitAny: task queue holds arbitrary arguments
  getNextTask(): Promise<any[]>;
  // biome-ignore lint/suspicious/noExplicitAny: arbitrary task arguments
  pushTask(...args: any[]): Promise<void>;
  clear(): Promise<void>;
}
