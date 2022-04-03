export class StoreOptions {
  maxQueued?: number;
}

export interface Store {
  isEmpty(): Promise<boolean>;
  getQueued(): Promise<number>;
  getNextTask(): Promise<any[]>;
  pushTask(...args: any[]): void;
  clear(): Promise<void>;
}
