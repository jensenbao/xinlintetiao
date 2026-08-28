/**
 * 顾客头像 IndexedDB 缓存
 * 数据库: bartender_avatars
 * 对象仓库: avatars
 */

const DB_NAME = 'bartender_avatars';
const DB_VERSION = 1;
const STORE_NAME = 'avatars';
const MAX_CACHE_SIZE = 50;

/**
 * 打开数据库
 */
const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        store.createIndex('createdAt', 'createdAt');
        store.createIndex('isReturnCustomer', 'isReturnCustomer');
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * 保存头像到缓存
 */
export const saveAvatarToCache = async (key, imageBase64, isReturnCustomer = false) => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    store.put({
      key,
      imageBase64,
      createdAt: Date.now(),
      isReturnCustomer
    });

    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });

    await evictOldAvatars();
  } catch (e) {
    console.error('Failed to save avatar cache:', e);
  }
};

/**
 * 从缓存读取头像
 */
export const getAvatarFromCache = async (key) => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    return new Promise((resolve) => {
      const request = store.get(key);
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.imageBase64 : null);
      };
      request.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
};

/**
 * LRU 淘汰
 */
const evictOldAvatars = async () => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const countRequest = store.count();
    const count = await new Promise(r => { countRequest.onsuccess = () => r(countRequest.result); });

    if (count <= MAX_CACHE_SIZE) return;

    const index = store.index('createdAt');
    const all = [];
    const cursorRequest = index.openCursor();

    await new Promise((resolve) => {
      cursorRequest.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          if (!cursor.value.isReturnCustomer) {
            all.push(cursor.value.key);
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
    });

    const toDelete = count - MAX_CACHE_SIZE;
    for (let i = 0; i < toDelete && i < all.length; i++) {
      store.delete(all[i]);
    }
  } catch (e) {
    console.error('LRU eviction failed:', e);
  }
};

/**
 * 清空所有头像缓存
 */
export const clearAvatarCache = async () => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    await new Promise((resolve) => { tx.oncomplete = resolve; });
    console.log('Avatar cache cleared');
  } catch (e) {
    console.error('Failed to clear avatar cache:', e);
  }
};

/**
 * 获取缓存使用情况
 */
export const getAvatarCacheStats = async () => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const count = await new Promise(r => {
      const req = store.count();
      req.onsuccess = () => r(req.result);
    });
    return { count, maxSize: MAX_CACHE_SIZE };
  } catch (e) {
    return { count: 0, maxSize: MAX_CACHE_SIZE };
  }
};
