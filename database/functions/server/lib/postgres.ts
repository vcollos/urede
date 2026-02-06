import { Pool, PoolClient } from "https://deno.land/x/postgres@v0.17.2/mod.ts";

let pool: Pool | null = null;

const getPool = () => {
  if (pool) return pool;

  const connectionUrl = Deno.env.get("DATABASE_DB_URL");
  if (!connectionUrl) {
    throw new Error(
      "[postgres] DATABASE_DB_URL não definido. Configure a string de conexão do banco.",
    );
  }

  const poolSize = Number(Deno.env.get("DATABASE_DB_POOL_SIZE") ?? 5);
  pool = new Pool(connectionUrl, poolSize, true);
  return pool;
};

const blockOn = <T>(promise: Promise<T>): T => {
  const sab = new SharedArrayBuffer(4);
  const state = new Int32Array(sab);
  let result: T | undefined;
  let error: unknown;

  promise.then((value) => {
    result = value;
    Atomics.store(state, 0, 1);
    Atomics.notify(state, 0);
  }).catch((err) => {
    error = err;
    Atomics.store(state, 0, 2);
    Atomics.notify(state, 0);
  });

  if (Atomics.load(state, 0) === 0) {
    Atomics.wait(state, 0, 0);
  }

  if (Atomics.load(state, 0) === 2) {
    throw error;
  }

  return result as T;
};

const prepareQuery = (text: string, args: unknown[]) => {
  if (!args || args.length === 0) {
    return { text, args };
  }
  let index = 0;
  const finalText = text.replace(/\?/g, () => {
    index += 1;
    return `$${index}`;
  });
  return { text: finalText, args };
};

const withClient = async <T>(fn: (client: PoolClient) => Promise<T>) => {
  const pool = getPool();
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
};

export const queryEntries = <T = Record<string, unknown>>(
  text: string,
  args: unknown[] = [],
) => {
  const { text: finalText, args: finalArgs } = prepareQuery(text, args);
  return blockOn(
    withClient(async (client) => {
      const result = await client.queryObject<T>({
        text: finalText,
        args: finalArgs,
      });
      return result.rows;
    }),
  );
};

export const queryArray = (
  text: string,
  args: unknown[] = [],
) => {
  const { text: finalText, args: finalArgs } = prepareQuery(text, args);
  return blockOn(
    withClient(async (client) => {
      const result = await client.queryArray({
        text: finalText,
        args: finalArgs,
      });
      return result.rows;
    }),
  );
};

export const query = (
  text: string,
  args: unknown[] = [],
) => {
  const { text: finalText, args: finalArgs } = prepareQuery(text, args);
  return blockOn(
    withClient(async (client) => {
      await client.queryArray({
        text: finalText,
        args: finalArgs,
      });
    }),
  );
};

export const execute = query;

type SyncDbClient = {
  query: (text: string, args?: unknown[]) => void;
  queryEntries: <T = Record<string, unknown>>(
    text: string,
    args?: unknown[],
  ) => T[];
  queryArray: (text: string, args?: unknown[]) => unknown[][];
  execute: (text: string, args?: unknown[]) => void;
};

const makeSyncClient = (client: PoolClient): SyncDbClient => {
  const runQueryArray = (
    text: string,
    args: unknown[] = [],
  ) => {
    const { text: finalText, args: finalArgs } = prepareQuery(text, args);
    return client.queryArray({
      text: finalText,
      args: finalArgs,
    });
  };

  const runQueryObject = <T>(
    text: string,
    args: unknown[] = [],
  ) => {
    const { text: finalText, args: finalArgs } = prepareQuery(text, args);
    return client.queryObject<T>({
      text: finalText,
      args: finalArgs,
    });
  };

  return {
    query: (text: string, args: unknown[] = []) => {
      blockOn(runQueryArray(text, args));
    },
    queryEntries: <T = Record<string, unknown>>(
      text: string,
      args: unknown[] = [],
    ) => {
      const result = blockOn(runQueryObject<T>(text, args));
      return result.rows;
    },
    queryArray: (text: string, args: unknown[] = []) => {
      const result = blockOn(runQueryArray(text, args));
      return result.rows;
    },
    execute: (text: string, args: unknown[] = []) => {
      blockOn(runQueryArray(text, args));
    },
  };
};

export const transaction = <T>(fn: (tx: SyncDbClient) => T): T =>
  blockOn(
    withClient(async (client) => {
      const txClient = makeSyncClient(client);
      try {
        await client.queryArray("BEGIN");
        const result = fn(txClient);
        await client.queryArray("COMMIT");
        return result;
      } catch (error) {
        try {
          await client.queryArray("ROLLBACK");
        } catch (_) {}
        throw error;
      }
    }),
  );
