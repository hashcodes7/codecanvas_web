// Maps file extensions to PrismJS language classes
export const getLanguageFromFilename = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'ts': return 'typescript';
        case 'tsx': return 'tsx';
        case 'js':
        case 'jsx': return 'javascript';
        case 'html': return 'markup';
        case 'css': return 'css';
        case 'json': return 'json';
        case 'py': return 'python';
        case 'rs': return 'rust';
        case 'go': return 'go';
        case 'java': return 'java';
        case 'cpp':
        case 'c': return 'cpp';
        default: return 'javascript';
    }
};
