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

export const queryEntries = async <T = Record<string, unknown>>(
  text: string,
  args: unknown[] = [],
) => {
  const { text: finalText, args: finalArgs } = prepareQuery(text, args);
  return await withClient(async (client) => {
    const result = await client.queryObject<T>({
      text: finalText,
      args: finalArgs,
    });
    return result.rows;
  });
};

export const queryArray = async (
  text: string,
  args: unknown[] = [],
) => {
  const { text: finalText, args: finalArgs } = prepareQuery(text, args);
  return await withClient(async (client) => {
    const result = await client.queryArray({
      text: finalText,
      args: finalArgs,
    });
    return result.rows;
  });
};

export const query = async (
  text: string,
  args: unknown[] = [],
) => {
  const { text: finalText, args: finalArgs } = prepareQuery(text, args);
  return await withClient(async (client) => {
    await client.queryArray({
      text: finalText,
      args: finalArgs,
    });
  });
};

export const execute = query;

type AsyncDbClient = {
  query: (text: string, args?: unknown[]) => Promise<void>;
  queryEntries: <T = Record<string, unknown>>(
    text: string,
    args?: unknown[],
  ) => Promise<T[]>;
  queryArray: (text: string, args?: unknown[]) => Promise<unknown[][]>;
  execute: (text: string, args?: unknown[]) => Promise<void>;
};

const makeAsyncClient = (client: PoolClient): AsyncDbClient => {
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
    query: async (text: string, args: unknown[] = []) => {
      await runQueryArray(text, args);
    },
    queryEntries: async <T = Record<string, unknown>>(
      text: string,
      args: unknown[] = [],
    ) => {
      const result = await runQueryObject<T>(text, args);
      return result.rows;
    },
    queryArray: async (text: string, args: unknown[] = []) => {
      const result = await runQueryArray(text, args);
      return result.rows;
    },
    execute: async (text: string, args: unknown[] = []) => {
      await runQueryArray(text, args);
    },
  };
};

export const transaction = async <T>(fn: (tx: AsyncDbClient) => Promise<T>): Promise<T> =>
  await withClient(async (client) => {
    const txClient = makeAsyncClient(client);
    try {
      await client.queryArray("BEGIN");
      const result = await fn(txClient);
      await client.queryArray("COMMIT");
      return result;
    } catch (error) {
      try {
        await client.queryArray("ROLLBACK");
      } catch (_) {}
      throw error;
    }
  });
