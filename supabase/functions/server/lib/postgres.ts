import { Pool, PoolClient } from "https://deno.land/x/postgres@v0.17.2/mod.ts";

const CONNECTION_URL = Deno.env.get("SUPABASE_DB_URL");

if (!CONNECTION_URL) {
  throw new Error(
    "[postgres] SUPABASE_DB_URL não definido. Configure a string de conexão do Supabase.",
  );
}

const POOL_SIZE = Number(Deno.env.get("SUPABASE_DB_POOL_SIZE") ?? 5);
const pool = new Pool(CONNECTION_URL, POOL_SIZE, true);

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
