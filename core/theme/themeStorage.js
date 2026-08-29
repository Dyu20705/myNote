import { validateTheme } from "./themeSchema.js";

export async function listThemes(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("userThemes", "readonly");
    const store = transaction.objectStore("userThemes");
    const request = store.getAll();
    request.onsuccess = () => {
      const results = request.result || [];
      const validated = [];
      for (const t of results) {
        try {
          validated.push(validateTheme(t));
        } catch {
          console.warn("Invalid user theme dropped from storage list", t.id);
        }
      }
      resolve(validated);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveTheme(db, theme) {
  const validated = validateTheme(theme);
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("userThemes", "readwrite");
    const store = transaction.objectStore("userThemes");
    const request = store.put(validated);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteTheme(db, themeId) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("userThemes", "readwrite");
    const store = transaction.objectStore("userThemes");
    const request = store.delete(themeId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
