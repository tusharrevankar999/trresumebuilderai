/**
 * Local storage utilities to replace puter
 * Uses localStorage for key-value storage and IndexedDB for file storage
 */

// Simple localStorage-based key-value store
export const storage = {
    async get(key: string): Promise<string | null> {
        try {
            return localStorage.getItem(key);
        } catch (error) {
            console.error('Error reading from localStorage:', error);
            return null;
        }
    },

    async set(key: string, value: string): Promise<boolean> {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (error) {
            console.error('Error writing to localStorage:', error);
            return false;
        }
    },

    async delete(key: string): Promise<boolean> {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('Error deleting from localStorage:', error);
            return false;
        }
    },

    async list(pattern?: string): Promise<string[]> {
        try {
            const keys: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key) {
                    if (!pattern || key.includes(pattern)) {
                        keys.push(key);
                    }
                }
            }
            return keys;
        } catch (error) {
            console.error('Error listing localStorage keys:', error);
            return [];
        }
    }
};

// File storage using IndexedDB
let db: IDBDatabase | null = null;

const initDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        if (db) {
            resolve(db);
            return;
        }

        const request = indexedDB.open('resume-analyzer-files', 1);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains('files')) {
                db.createObjectStore('files', { keyPath: 'path' });
            }
        };
    });
};

export const fileStorage = {
    async upload(files: File[] | Blob[]): Promise<{ path: string } | null> {
        try {
            const database = await initDB();
            const file = files[0] as File;
            if (!file) return null;

            const path = `files/${Date.now()}_${file.name}`;
            const transaction = database.transaction(['files'], 'readwrite');
            const store = transaction.objectStore('files');

            await new Promise<void>((resolve, reject) => {
                const request = store.put({ path, file, blob: file });
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });

            return { path };
        } catch (error) {
            console.error('Error uploading file:', error);
            return null;
        }
    },

    async read(path: string): Promise<Blob | null> {
        try {
            const database = await initDB();
            const transaction = database.transaction(['files'], 'readonly');
            const store = transaction.objectStore('files');

            return new Promise<Blob | null>((resolve, reject) => {
                const request = store.get(path);
                request.onsuccess = () => {
                    const result = request.result;
                    if (result && result.file) {
                        resolve(result.file instanceof Blob ? result.file : new Blob([result.file]));
                    } else {
                        resolve(null);
                    }
                };
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Error reading file:', error);
            return null;
        }
    },

    async delete(path: string): Promise<void> {
        try {
            const database = await initDB();
            const transaction = database.transaction(['files'], 'readwrite');
            const store = transaction.objectStore('files');

            await new Promise<void>((resolve, reject) => {
                const request = store.delete(path);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Error deleting file:', error);
        }
    }
};

// Simple auth mock
export const auth = {
    user: { uuid: 'local-user', username: 'user' },
    isAuthenticated: true,
    setHardcodedAuth: (user: any) => {
        auth.user = user;
        auth.isAuthenticated = true;
    }
};

