import { Redis } from "@upstash/redis";

/**
 * upstash-store — a drop-in replacement for json-store.ts's on-disk JSON
 * files, backed by Upstash Redis (a serverless-friendly, REST-based
 * Redis — no persistent connection, no server process, works fine from
 * a Vercel serverless function).
 *
 * WHY THIS EXISTS: json-store.ts writes to `${process.cwd()}/data/*.json`
 * via node:fs. That's fine on localhost or a VPS with a real, persistent
 * disk (see Nexus Justice's Hostinger deployment) — but Vercel serverless
 * functions run on a READ-ONLY filesystem with no persistent storage
 * between invocations. Every write there throws, which is what was
 * surfacing as "the server hit a configuration problem" on signup/login
 * — student and parent accounts (and subscriptions, materials, messages,
 * exam attempts, ...) all go through the same collectionHelpers() in
 * firestore-collection.ts, so this one file is the actual fix for all
 * of them.
 *
 * Despite the historical "Firestore" naming/comments elsewhere in this
 * codebase (students-store.ts, the signup/login routes), no Firestore
 * integration was ever actually wired up — see firestore-collection.ts.
 * Upstash was picked instead because it needs zero server to manage
 * (a real requirement here — no VPS available) and provisions in one
 * click from the Vercel dashboard's Marketplace tab, with credentials
 * auto-injected as env vars.
 *
 * DATA MODEL: each record is a JSON string at `{collection}:record:{id}`;
 * a Redis Set at `{collection}:ids` tracks every id in the collection so
 * all()/where() don't need Redis's discouraged KEYS/SCAN-over-everything
 * pattern.
 */

let client: Redis | null | undefined;

/** True when Upstash env vars are present — the switch firestore-
 *  collection.ts uses to decide between this and the local-file
 *  fallback (kept for zero-setup `next dev` on a laptop). */
export function upstashConfigured(): boolean {
  return !!(
    (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) &&
    (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN)
  );
}

function getClient(): Redis {
  if (client) return client;
  // Supports both env var names: UPSTASH_REDIS_REST_URL/TOKEN (Upstash's
  // own docs / manual setup) and KV_REST_API_URL/TOKEN (what some Vercel
  // Marketplace integration flows inject) — one less way for this to
  // silently not work because of a naming mismatch.
  const url   = process.env.UPSTASH_REDIS_REST_URL   || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    throw new Error(
      "Upstash Redis is not configured — set UPSTASH_REDIS_REST_URL and " +
      "UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_URL/KV_REST_API_TOKEN) in " +
      "your Vercel project's environment variables. See .env.example.",
    );
  }
  client = new Redis({ url, token });
  return client;
}

export const upstashStore = <T extends { id: string }>(collectionName: string) => {
  const idsKey = `${collectionName}:ids`;
  const recordKey = (id: string) => `${collectionName}:record:${id}`;

  return {
    get: async (id: string): Promise<T | null> => {
      const v = await getClient().get<T>(recordKey(id));
      return v ?? null;
    },
    byId: async (id: string): Promise<T | null> => {
      const v = await getClient().get<T>(recordKey(id));
      return v ?? null;
    },

    all: async (): Promise<T[]> => {
      const redis = getClient();
      const ids = await redis.smembers(idsKey);
      if (!ids.length) return [];
      // mget preserves order and returns null for any id whose record
      // vanished without its index entry being cleaned up (shouldn't
      // happen via this module's own delete(), but defensive against
      // manual Redis console edits).
      const records = await redis.mget<T[]>(...ids.map(recordKey));
      return records.filter((r): r is T => r != null);
    },

    where: async (field: keyof T, value: any): Promise<T[]> => {
      const all = await upstashStore<T>(collectionName).all();
      return all.filter((item: any) => item[field] === value);
    },

    create: async (data: Omit<T, "id">): Promise<T> => {
      const redis = getClient();
      const id = crypto.randomUUID();
      const item = { ...data, id } as T;
      await redis.set(recordKey(id), item);
      await redis.sadd(idsKey, id);
      return item;
    },

    update: async (id: string, data: Partial<T>): Promise<T> => {
      const redis = getClient();
      const existing = await redis.get<T>(recordKey(id));
      if (!existing) throw new Error("Not found");
      const updated = { ...existing, ...data };
      await redis.set(recordKey(id), updated);
      return updated;
    },

    delete: async (id: string): Promise<void> => {
      const redis = getClient();
      await redis.del(recordKey(id));
      await redis.srem(idsKey, id);
    },
    remove: async (id: string): Promise<void> => {
      const redis = getClient();
      await redis.del(recordKey(id));
      await redis.srem(idsKey, id);
    },
  };
};
