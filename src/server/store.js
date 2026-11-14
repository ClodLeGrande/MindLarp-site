import { resolve } from 'node:path';
import { Store } from '../store.js';

export function getStore() {
  if (!globalThis.__mindLarpStorePromise) {
    const file = process.env.DATA_FILE ? resolve(process.env.DATA_FILE) : resolve('data/mindlarp.json');
    globalThis.__mindLarpStorePromise = new Store(file).init().catch((error) => {
      globalThis.__mindLarpStorePromise = null;
      throw error;
    });
  }
  return globalThis.__mindLarpStorePromise;
}
