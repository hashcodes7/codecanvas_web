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
