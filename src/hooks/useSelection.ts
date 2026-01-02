/**
 * Manages the selection state for Nodes, Connections, and Shapes.
 * Ensures mutual exclusivity of selection (only one object selected at a time).
 */
import { useState, useMemo, useCallback } from 'react';

export function useSelection() {
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
    const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);

    const selectNode = useCallback((id: string | null) => {
        setSelectedNodeId(id);
        if (id) {
            setSelectedConnectionId(null);
            setSelectedShapeId(null);
        }
    }, []);

    const selectConnection = useCallback((id: string | null) => {
        setSelectedConnectionId(id);
        if (id) {
            setSelectedNodeId(null);
            setSelectedShapeId(null);
        }
    }, []);

    const selectShape = useCallback((id: string | null) => {
        setSelectedShapeId(id);
        if (id) {
            setSelectedNodeId(null);
            setSelectedConnectionId(null);
        }
    }, []);

    const clearSelection = useCallback(() => {
        setSelectedNodeId(null);
        setSelectedConnectionId(null);
        setSelectedShapeId(null);
    }, []);

    const selectedObject = useMemo(() => {
        if (selectedNodeId) return { type: 'node' as const, id: selectedNodeId };
        if (selectedConnectionId) return { type: 'connection' as const, id: selectedConnectionId };
        if (selectedShapeId) return { type: 'shape' as const, id: selectedShapeId };
        return null;
    }, [selectedNodeId, selectedConnectionId, selectedShapeId]);

    return {
        selectedNodeId,
        selectedConnectionId,
        selectedShapeId,
        selectNode,
        selectConnection,
        selectShape,
        clearSelection,
        selectedObject
    };
}
