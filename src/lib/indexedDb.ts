/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LandParcel, LandDispute, SurveyAssignment, LandApplication } from "../types";

const DB_NAME = "UbutakaSmartLandDB";
const DB_VERSION = 2;

export enum StoreNames {
  PARCELS = "parcels",
  DISPUTES = "disputes",
  ASSIGNMENTS = "assignments",
  APPLICATIONS = "applications",
  SYNC_QUEUE = "sync_queue"
}

export interface OfflineMutation {
  id: string;
  timestamp: number;
  type: string;
  payload: any;
  description: string;
}

/**
 * Initializes the IndexedDB database.
 */
export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      console.warn("IndexedDB is not supported by this browser.");
      reject(new Error("IndexedDB not supported"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create Object Stores if they do not exist
      if (!db.objectStoreNames.contains(StoreNames.PARCELS)) {
        db.createObjectStore(StoreNames.PARCELS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(StoreNames.DISPUTES)) {
        db.createObjectStore(StoreNames.DISPUTES, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(StoreNames.ASSIGNMENTS)) {
        db.createObjectStore(StoreNames.ASSIGNMENTS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(StoreNames.APPLICATIONS)) {
        db.createObjectStore(StoreNames.APPLICATIONS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(StoreNames.SYNC_QUEUE)) {
        db.createObjectStore(StoreNames.SYNC_QUEUE, { keyPath: "id" });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

/**
 * Saves items of a specific store to IndexedDB
 */
export async function saveToIndexedDB<T extends { id: string }>(
  storeName: StoreNames,
  items: T[]
): Promise<void> {
  try {
    const db = await initDB();
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);

    // Clear old records to ensure synchronization with the latest server state
    store.clear();

    for (const item of items) {
      store.put(item);
    }

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  } catch (error) {
    console.error(`[IndexedDB] Error saving items to store "${storeName}":`, error);
  }
}

/**
 * Retrieves all items of a specific store from IndexedDB
 */
export async function getFromIndexedDB<T>(storeName: StoreNames): Promise<T[]> {
  try {
    const db = await initDB();
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        db.close();
        resolve(request.result as T[]);
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (error) {
    console.error(`[IndexedDB] Error retrieving items from store "${storeName}":`, error);
    return [];
  }
}

/**
 * Adds a mutation to the background sync queue in IndexedDB
 */
export async function queueOfflineMutation(mutation: OfflineMutation): Promise<void> {
  try {
    const db = await initDB();
    const transaction = db.transaction(StoreNames.SYNC_QUEUE, "readwrite");
    const store = transaction.objectStore(StoreNames.SYNC_QUEUE);
    store.put(mutation);
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  } catch (error) {
    console.error("[IndexedDB] Error queueing offline mutation:", error);
  }
}

/**
 * Retrieves all pending offline mutations from the sync queue
 */
export async function getQueuedMutations(): Promise<OfflineMutation[]> {
  return getFromIndexedDB<OfflineMutation>(StoreNames.SYNC_QUEUE);
}

/**
 * Removes a mutation from the sync queue after successful replay
 */
export async function removeFromQueue(id: string): Promise<void> {
  try {
    const db = await initDB();
    const transaction = db.transaction(StoreNames.SYNC_QUEUE, "readwrite");
    const store = transaction.objectStore(StoreNames.SYNC_QUEUE);
    store.delete(id);
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  } catch (error) {
    console.error(`[IndexedDB] Error removing mutation ${id} from queue:`, error);
  }
}

/**
 * Clears all pending mutations from the sync queue
 */
export async function clearQueue(): Promise<void> {
  try {
    const db = await initDB();
    const transaction = db.transaction(StoreNames.SYNC_QUEUE, "readwrite");
    const store = transaction.objectStore(StoreNames.SYNC_QUEUE);
    store.clear();
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  } catch (error) {
    console.error("[IndexedDB] Error clearing sync queue:", error);
  }
}
