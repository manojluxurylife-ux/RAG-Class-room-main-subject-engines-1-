import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

async function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

async function getCollectionFile(collectionName: string) {
  await ensureDataDir();
  return path.join(DATA_DIR, `${collectionName}.json`);
}

async function readCollection<T>(collectionName: string): Promise<Record<string, T>> {
  try {
    const file = await getCollectionFile(collectionName);
    if (!existsSync(file)) return {};
    const data = await readFile(file, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    console.error(`Error reading ${collectionName}:`, e);
    return {};
  }
}

async function writeCollection<T>(collectionName: string, data: Record<string, T>) {
  const file = await getCollectionFile(collectionName);
  
  const safeStringify = (obj: any) => {
    const cache = new Set();
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (cache.has(value)) return undefined;
        if (value.$$typeof && typeof value.$$typeof === 'symbol') return undefined;
        if (value.nodeType && typeof value.nodeType === 'number') return undefined;
        cache.add(value);
      }
      return value;
    }, 2);
  };
  
  await writeFile(file, safeStringify(data));
}

export const jsonStore = <T extends { id: string }>(collectionName: string) => ({
  get: async (id: string) => {
    const data = await readCollection<T>(collectionName);
    return data[id] || null;
  },
  byId: async (id: string) => {
    const data = await readCollection<T>(collectionName);
    return data[id] || null;
  },
  all: async () => {
    const data = await readCollection<T>(collectionName);
    return Object.values(data);
  },
  where: async (field: keyof T, value: any) => {
    const all = await jsonStore<T>(collectionName).all();
    return all.filter((item: any) => item[field] === value);
  },
  create: async (data: Omit<T, 'id'>) => {
    const dataCollection = await readCollection<T>(collectionName);
    const id = crypto.randomUUID();
    const item = { ...data, id } as T;
    dataCollection[id] = item;
    await writeCollection(collectionName, dataCollection);
    return item;
  },
  update: async (id: string, data: Partial<T>) => {
    const dataCollection = await readCollection<T>(collectionName);
    if (!dataCollection[id]) throw new Error("Not found");
    dataCollection[id] = { ...dataCollection[id], ...data };
    await writeCollection(collectionName, dataCollection);
    return dataCollection[id];
  },
  delete: async (id: string) => {
    const dataCollection = await readCollection<T>(collectionName);
    delete dataCollection[id];
    await writeCollection(collectionName, dataCollection);
  },
  remove: async (id: string) => {
    const dataCollection = await readCollection<T>(collectionName);
    delete dataCollection[id];
    await writeCollection(collectionName, dataCollection);
  },
});
