export async function listThemes(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("userThemes", "readonly");
    const store = transaction.objectStore("userThemes");
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}
