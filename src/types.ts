
export interface NodeData {
    id: string; // Unique identifier for the node
    title: string; // Display title of the node
    type: 'file' | 'code' | 'text'; // Type of node content
    content?: string; // The actual content (code key, text body, etc.)
    uri?: string; // File path or URI if applicable
    x: number; // X position on canvas
    y: number; // Y position on canvas
    width?: number; // Width of the node
    height?: number; // Height of the node
    isEditing?: boolean; // Whether the node is currently in edit mode
    hasWritePermission?: boolean; // For file nodes: do we have write access?
    isDirty?: boolean; // Has the content changed since last save?
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
