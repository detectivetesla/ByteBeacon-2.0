declare module 'pg' {
  export interface QueryResultRow {
    [column: string]: any;
  }

  export interface QueryResult<R extends QueryResultRow = any> {
    rows: R[];
    rowCount: number | null;
    command: string;
    oid: number;
    fields: any[];
  }

  export interface PoolClient {
    query<R extends QueryResultRow = any>(
      queryTextOrConfig: string | any,
      values?: any[],
    ): Promise<QueryResult<R>>;
    release(err?: Error | boolean): void;
  }

  export class Pool {
    constructor(config?: any);
    query<R extends QueryResultRow = any>(
      queryTextOrConfig: string | any,
      values?: any[],
    ): Promise<QueryResult<R>>;
    connect(): Promise<PoolClient>;
    end(): Promise<void>;
    on(event: string, listener: (...args: any[]) => void): this;
  }
}

declare module 'ioredis' {
  export interface RedisOptions {
    [key: string]: any;
  }

  export interface ChainableCommander {
    incr(key: string): this;
    expire(key: string, seconds: number): this;
    ttl(key: string): this;
    set(key: string, value: string, ...args: any[]): this;
    setex(key: string, seconds: number, value: string): this;
    sadd(key: string, ...members: string[]): this;
    srem(key: string, ...members: string[]): this;
    del(...keys: string[]): this;
    exec(): Promise<Array<[Error | null, any]>>;
  }

  export class Redis {
    constructor(urlOrOptions?: string | RedisOptions, options?: RedisOptions);
    get(key: string): Promise<string | null>;
    set(key: string, value: string, ...args: any[]): Promise<string | null>;
    setex(key: string, seconds: number, value: string): Promise<string | null>;
    del(...keys: string[]): Promise<number>;
    expire(key: string, seconds: number): Promise<number>;
    ttl(key: string): Promise<number>;
    smembers(key: string): Promise<string[]>;
    sadd(key: string, ...members: string[]): Promise<number>;
    srem(key: string, ...members: string[]): Promise<number>;
    multi(): ChainableCommander;
    ping(): Promise<string>;
    quit(): Promise<void>;
    disconnect(): void;
    status: string;
    on(event: string, callback: (...args: any[]) => void): this;
  }

  export default Redis;
}
