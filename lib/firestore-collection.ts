import { jsonStore } from "./json-store";
import { safeStorage } from "./safe-storage";
import { upstashStore, upstashConfigured } from "./upstash-store";

export const collectionHelpers = <T extends { id: string }>(collectionName: string) => {
  if (typeof window === "undefined") {
    // On the server: Upstash Redis when configured (this is what makes
    // signup/login/subscriptions/materials/... actually work once
    // deployed to Vercel — see upstash-store.ts for why). Falls back to
    // local JSON files (json-store.ts) when no Upstash env vars are set,
    // which is exactly the case for a fresh clone running `next dev` on
    // a laptop with no cloud setup at all — that path keeps working
    // unchanged, same as before.
    return upstashConfigured() ? upstashStore<T>(collectionName) : jsonStore<T>(collectionName);
  }
  
  return {
    get: async (id: string) => safeStorage.get(`${collectionName}:${id}`),
    byId: async (id: string) => safeStorage.get(`${collectionName}:${id}`),
    
    all: async () => {
      const keys = safeStorage.keys(`${collectionName}:`);
      return safeStorage.mget(...keys);
    },
    
    where: async (field: keyof T, value: any) => {
      const all = await collectionHelpers<T>(collectionName).all();
      return all.filter((item: any) => item[field] === value);
    },
    
    create: async (data: Omit<T, 'id'>) => {
      const id = crypto.randomUUID();
      const item = { ...data, id } as T;
      safeStorage.set(`${collectionName}:${id}`, item);
      return item;
    },
    
    update: async (id: string, data: Partial<T>) => {
      const existing = await safeStorage.get(`${collectionName}:${id}`);
      if (!existing) throw new Error("Not found");
      const updated = { ...existing, ...data };
      safeStorage.set(`${collectionName}:${id}`, updated);
      return updated;
    },
    
    delete: async (id: string) => safeStorage.del(`${collectionName}:${id}`),
    remove: async (id: string) => safeStorage.del(`${collectionName}:${id}`),
  };
};
