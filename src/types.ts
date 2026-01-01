
export interface NodeData {
    id: string;
    title: string;
    type: 'file' | 'code' | 'text';
    content?: string;
    uri?: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
    isEditing?: boolean;
    hasWritePermission?: boolean;
    isDirty?: boolean;
}

export interface ShapeData {
    id: string;
    type: 'rectangle' | 'ellipse' | 'diamond' | 'arrow';
    x: number;
    y: number;
    width: number;
    height: number;
    strokeColor: string;
    fillColor: string;
    strokeWidth: number;
    opacity: number;
    roughness?: number; // Kept for compatibility if needed, but usually 0 for clean
}

export interface Connection {
    id: string; // Unique identifier for this connection
    source: { nodeId: string; handleId: string }; // Where the line starts
    target: { nodeId: string; handleId: string }; // Where the line ends
    type: 'line' | 'arrow' | 'bi-arrow'; // Visual style of the connection
    style?: {
        color?: string;
        width?: number;
    };
}

export interface CanvasManifestItem {
    id: string;
    name: string;
    lastModified: string;
}

export interface CanvasProperties {
    backgroundPattern: 'grid' | 'dots' | 'lines';
    backgroundOpacity: number;
    theme: 'light' | 'dark' | 'paper';
    syntaxTheme: 'classic' | 'monokai' | 'nord' | 'solarized' | 'ink';
    transform: { scale: number; offset: { x: number; y: number } };
    defaultShapeStyle?: {
        strokeColor: string;
        fillColor: string;
        strokeWidth: number;
    };
}
