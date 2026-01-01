import type { NodeData } from "./types";

// Initial set of nodes to populate the canvas if storage is empty
export const INITIAL_NODES: NodeData[] = [];

// Keys used for persistence architecture
export const STORAGE_KEYS = {
    MANIFEST: 'codecanvas_manifest',
    CURRENT_PROJECT_ID: 'codecanvas_current_project_id',
    // Prefixes for UUID-based keys
    PROPS_PREFIX: 'cc_props_',
    OBJECTS_PREFIX: 'cc_objects_'
};
export const PASTEL_COLORS = [
    { name: 'Default', value: 'var(--accent-primary)' },
    { name: 'Pink', value: '#ffb7b2' },
    { name: 'Orange', value: '#ffdac1' },
    { name: 'Yellow', value: '#fff9b1' },
    { name: 'Green', value: '#baffc9' },
    { name: 'Blue', value: '#bae1ff' },
    { name: 'Purple', value: '#e0bbe4' },
];

export const THICKNESS_OPTIONS = [1, 2, 4, 6, 8];
