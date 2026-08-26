const fs = require('fs');
let content = fs.readFileSync('core/storage.js', 'utf8');

// Update DB_VERSION to 6
content = content.replace("const DB_VERSION = 5;", "const DB_VERSION = 6;");

// Add object stores in upgrade handler
const storesToAdd = `      if (!db.objectStoreNames.contains("userThemes")) {
        db.createObjectStore("userThemes", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings");
      }`;

if (!content.includes('"userThemes"')) {
    content = content.replace('if (oldVersion < 2) {', storesToAdd + '\n      if (oldVersion < 2) {');
}

// Add getSettings and putSettings
const settingsFunctions = `
export function getSettings(db, key) {
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction("settings", "readonly");
      const store = transaction.objectStore("settings");
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    } catch (e) {
      reject(e);
    }
  });
}

export function putSettings(db, key, value) {
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction("settings", "readwrite");
      const store = transaction.objectStore("settings");
      const request = store.put(value, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    } catch (e) {
      reject(e);
    }
  });
}
`;

if (!content.includes('export function getSettings')) {
    content += settingsFunctions;
}

fs.writeFileSync('core/storage.js', content, 'utf8');
