import { createClient } from 'redis';
import type { Store } from 'timequeue';

interface RedisClient {
  LLEN(key: string): Promise<number>;
  LPOP(key: string): Promise<unknown[]>;
  RPUSH(key: string, args: unknown[]): Promise<number>;
  DEL(key: string): Promise<number>;
  connect(): Promise<void>;
}

export default class RedisStore implements Store {
  private client: RedisClient;
  private key = 'myqueue';
  constructor() {
    this.client = createClient({
      url: 'redis://alice:foobared@awesome.redis.server:6380',
    });
    this.client.connect();
  }
  async getQueueLen() {
    return this.client.LLEN(this.key);
  }
  async getNextTask() {
    return this.client.LPOP(this.key);
  }
  async pushTask(args: unknown[]) {
    return this.client.RPUSH(this.key, args);
  }
  async clear() {
    return this.client.DEL(this.key);
  }
}
