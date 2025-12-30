import type { NodeData } from "./types";

// Initial set of nodes to populate the canvas if storage is empty
export const INITIAL_NODES: NodeData[] = [];

// Keys used for LocalStorage persistence
export const STORAGE_KEYS = {
    NODES: 'codecanvas-nodes',
    CONNECTIONS: 'codecanvas-connections',
    TRANSFORM: 'codecanvas-transform'
};
