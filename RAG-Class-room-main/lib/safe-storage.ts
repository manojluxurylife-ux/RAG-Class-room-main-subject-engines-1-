export const safeStringify = (obj: any) => {
  const cache = new Set();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      // Circular reference check
      if (cache.has(value)) return undefined;
      
      // Filter out DOM nodes, React internals, and other non-JSON-safe structures
      if (
        value.nodeType || // DOM nodes
        key.startsWith('__reactFiber') || 
        key.startsWith('__reactInternal') ||
        (value.$$typeof && typeof value.$$typeof === 'symbol') // React elements
      ) {
        return undefined;
      }
      
      cache.add(value);
    }
    return value;
  }, 2);
};

export const safeStorage = {
  get: (key: string) => {
    if (typeof window === "undefined") return null;
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (e) {
      console.error(`Failed to parse ${key} from localStorage:`, e);
      return null;
    }
  },
  set: (key: string, value: any) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(key, safeStringify(value));
    } catch (e) {
      console.error(`Failed to store ${key} in localStorage:`, e);
    }
  },
  del: (key: string) => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(key);
  },
  clearAll: () => {
    if (typeof window === "undefined") return;
    localStorage.clear();
  },
  clearKeysByPattern: (pattern: string) => {
    if (typeof window === "undefined") return;
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(pattern)) {
        localStorage.removeItem(key);
      }
    });
  },
  keys: (pattern: string) => {
    if (typeof window === "undefined") return [];
    return Object.keys(localStorage).filter(k => k.startsWith(pattern));
  },
  mget: (...keys: string[]) => {
    if (typeof window === "undefined") return [];
    return keys.map(k => {
      try {
        const item = localStorage.getItem(k);
        return item ? JSON.parse(item) : null;
      } catch {
        return null;
      }
    });
  }
};
