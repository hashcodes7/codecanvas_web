/**
 * Storage utilities for CodeCanvas
 * Uses IndexedDB for large file content and localStorage for metadata
 */

import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';

interface CodeCanvasDB extends DBSchema {
    files: {
        key: string;
        value: {
            id: string;
            content: string;
            lastModified: number;
        };
    };
    fileHandles: {
        key: string;
        value: {
            id: string;
            handle: FileSystemFileHandle;
            lastAccessed: number;
        };
    };
}

let dbInstance: IDBPDatabase<CodeCanvasDB> | null = null;

async function getDB() {
    if (dbInstance) return dbInstance;

    dbInstance = await openDB<CodeCanvasDB>('codecanvas-db', 1, {
        upgrade(db) {
            // Store for file contents
            if (!db.objectStoreNames.contains('files')) {
                db.createObjectStore('files', { keyPath: 'id' });
            }

            // Store for file system handles (for live sync)
            if (!db.objectStoreNames.contains('fileHandles')) {
                db.createObjectStore('fileHandles', { keyPath: 'id' });
            }
        },
    });

    return dbInstance;
}

export const FileStorage = {
    async saveFileContent(nodeId: string, content: string) {
        const db = await getDB();
        await db.put('files', {
            id: nodeId,
            content,
            lastModified: Date.now()
        });
    },

    async getFileContent(nodeId: string): Promise<string | null> {
        const db = await getDB();
        const file = await db.get('files', nodeId);
        return file?.content || null;
    },

    async deleteFileContent(nodeId: string) {
        const db = await getDB();
        await db.delete('files', nodeId);
    },

    async saveFileHandle(nodeId: string, handle: FileSystemFileHandle) {
        const db = await getDB();
        await db.put('fileHandles', {
            id: nodeId,
            handle,
            lastAccessed: Date.now()
        });
    },

    async getFileHandle(nodeId: string): Promise<FileSystemFileHandle | null> {
        const db = await getDB();
        const entry = await db.get('fileHandles', nodeId);
        return entry?.handle || null;
    },

    async syncFromHandle(nodeId: string): Promise<string | null> {
        try {
            const handle = await this.getFileHandle(nodeId);
            if (!handle) return null;

            // Request permission to read the file (using any to bypass TypeScript limitations)
            const handleWithPermissions = handle as any;
            const permission = await handleWithPermissions.queryPermission?.({ mode: 'read' });
            if (permission !== 'granted') {
                const requestResult = await handleWithPermissions.requestPermission?.({ mode: 'read' });
                if (requestResult !== 'granted') return null;
            }

            const file = await handle.getFile();
            const content = await file.text();

            // Update our cache
            await this.saveFileContent(nodeId, content);

            return content;
        } catch (error) {
            console.error('Failed to sync from handle:', error);
            return null;
        }
    },

    async clearAll() {
        const db = await getDB();
        await db.clear('files');
        await db.clear('fileHandles');
    }
};
