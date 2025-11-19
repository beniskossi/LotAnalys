import { DrawResult } from '../types';

const DB_NAME = 'LotoBonheurDB';
const STORE_NAME = 'draws';
const DB_VERSION = 1;

// Open Database Connection
export const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        // Create store with composite key (unique per draw name and date)
        const store = db.createObjectStore(STORE_NAME, { keyPath: ['draw_name', 'date'] });
        store.createIndex('draw_name', 'draw_name', { unique: false });
        store.createIndex('date', 'date', { unique: false });
      }
    };
  });
};

// Save multiple draws to DB
export const saveDrawsToDB = async (draws: DrawResult[]) => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    for (const draw of draws) {
      store.put(draw);
    }
    
    return new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.error("DB Save Error", e);
  }
};

// Get draws by name
export const getDrawsFromDB = async (drawName: string): Promise<DrawResult[]> => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('draw_name');
    const request = index.getAll(drawName);
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as DrawResult[]);
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error("DB Read Error", e);
    return [];
  }
};

// Delete a specific draw
export const deleteDrawFromDB = async (drawName: string, date: string): Promise<void> => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete([drawName, date]);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.error("DB Delete Error", e);
    throw e;
  }
};

// Get ALL draws (for export)
export const getAllDrawsFromDB = async (): Promise<DrawResult[]> => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as DrawResult[]);
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error("DB Export Error", e);
    return [];
  }
};

// Clear old data
export const clearDB = async () => {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
};
