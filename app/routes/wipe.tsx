import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { storage, fileStorage, auth } from "~/lib/storage";

const WipeApp = () => {
    const navigate = useNavigate();
    const [keys, setKeys] = useState<string[]>([]);

    const loadKeys = async () => {
        const allKeys = await storage.list();
        setKeys(allKeys);
    };

    useEffect(() => {
        loadKeys();
    }, []);

    const handleDelete = async () => {
        // Clear all localStorage keys
        for (const key of keys) {
            await storage.delete(key);
        }
        // Clear IndexedDB
        try {
            const db = await new Promise<IDBDatabase>((resolve, reject) => {
                const request = indexedDB.open('resume-analyzer-files', 1);
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve(request.result);
            });
            const transaction = db.transaction(['files'], 'readwrite');
            const store = transaction.objectStore('files');
            await new Promise<void>((resolve, reject) => {
                const request = store.clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Error clearing IndexedDB:', error);
        }
        loadKeys();
        alert('All app data cleared!');
    };

    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold mb-4">Wipe App Data</h1>
            <p className="mb-4">This will delete all stored resumes and files.</p>
            <div className="mb-4">
                <p>Found {keys.length} stored items</p>
            </div>
            <div>
                <button
                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md cursor-pointer"
                    onClick={() => handleDelete()}
                >
                    Wipe All App Data
                </button>
            </div>
        </div>
    );
};

export default WipeApp;
