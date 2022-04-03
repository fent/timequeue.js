import { Store } from 'timequeue'
import { createClient, RedisClientType } from 'redis';

export default class RedisStore implements Store {
  private client: RedsiClientType;
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
  async pushTask(args: any[]) {
    return this.client.RPUSH(this.key, args);
  }
  async clear() {
    return this.client.DEL(this.key);
  }
}
