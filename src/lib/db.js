// IndexedDB wrapper for watch session storage.
// Runs inside the background context (service worker on Chrome, background page/script on Firefox)
// and is also loaded by the popup/dashboard pages for read access.
// Plain classic script (no ES module syntax) so it can be shared via
// importScripts() on Chrome and a background "scripts" array on Firefox
// without a bundler. Exposes everything on the global VTDB namespace.

(function (global) {
  const DB_NAME = 'video-tracker';
  const DB_VERSION = 1;
  const STORE_SESSIONS = 'sessions';

  let dbPromise = null;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
          const store = db.createObjectStore(STORE_SESSIONS, { keyPath: 'id', autoIncrement: true });
          store.createIndex('byStartTime', 'startTime');
          store.createIndex('byGroupKey', 'groupKey');
          store.createIndex('byDomain', 'domain');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function addSession(session) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SESSIONS, 'readwrite');
      const req = tx.objectStore(STORE_SESSIONS).add(session);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function getAllSessions() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SESSIONS, 'readonly');
      const req = tx.objectStore(STORE_SESSIONS).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async function getSessionsSince(timestampMs) {
    const all = await getAllSessions();
    return all.filter((s) => s.startTime >= timestampMs);
  }

  async function deleteSession(id) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SESSIONS, 'readwrite');
      const req = tx.objectStore(STORE_SESSIONS).delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async function clearAllSessions() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SESSIONS, 'readwrite');
      const req = tx.objectStore(STORE_SESSIONS).clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  global.VTDB = {
    addSession,
    getAllSessions,
    getSessionsSince,
    deleteSession,
    clearAllSessions,
  };
})(typeof self !== 'undefined' ? self : this);
