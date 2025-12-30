

export const FileNodeService = {
    /**
     * Checks if the browser supports File System Access API
     */
    isSupported(): boolean {
        return !!(window as any).showOpenFilePicker;
    },

    /**
     * Verifies permission for a file handle
     */
    async verifyPermission(handle: FileSystemFileHandle, withWrite = false): Promise<boolean> {
        const opts: any = {
            mode: withWrite ? 'readwrite' : 'read'
        };

        // Check if we already have permission
        if ((await (handle as any).queryPermission(opts)) === 'granted') {
            return true;
        }

        // Request permission
        if ((await (handle as any).requestPermission(opts)) === 'granted') {
            return true;
        }

        return false;
    },

    /**
     * Reads content from a file handle
     */
    async readFile(handle: FileSystemFileHandle): Promise<string | null> {
        try {
            const hasPermission = await this.verifyPermission(handle, false);
            if (!hasPermission) return null;

            const file = await handle.getFile();
            return await file.text();
        } catch (error) {
            console.error('Failed to read file:', error);
            return null;
        }
    },

    /**
     * Saves content to a file handle
     */
    async saveFile(handle: FileSystemFileHandle, content: string): Promise<boolean> {
        try {
            const hasPermission = await this.verifyPermission(handle, true);
            if (!hasPermission) return false;

            const writable = await (handle as any).createWritable();
            await writable.write(content);
            await writable.close();
            return true;
        } catch (error) {
            console.error('Failed to save file:', error);
            return false;
        }
    },

    /**
     * Process dropped items to get file handles
     */
    async getHandlesFromDataTransfer(dataTransfer: DataTransfer): Promise<FileSystemFileHandle[]> {
        const handles: FileSystemFileHandle[] = [];

        // items is better because it supports getAsFileSystemHandle
        if (dataTransfer.items) {
            for (const item of Array.from(dataTransfer.items)) {
                if (item.kind === 'file') {
                    try {
                        // This is the modern way to get a persistent handle
                        if ('getAsFileSystemHandle' in item) {
                            const handle = await (item as any).getAsFileSystemHandle();
                            if (handle && handle.kind === 'file') {
                                handles.push(handle as FileSystemFileHandle);
                            }
                        }
                    } catch (e) {
                        console.warn('Failed to get file handle via items', e);
                    }
                }
            }
        }

        return handles;
    }
};
