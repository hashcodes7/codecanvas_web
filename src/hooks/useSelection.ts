/**
 * Manages the selection state for Nodes, Connections, and Shapes.
 * Supports multi-selection.
 */
import { useState, useMemo, useCallback } from 'react';

export function useSelection() {
    const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
    const [selectedConnectionIds, setSelectedConnectionIds] = useState<Set<string>>(new Set());
    const [selectedShapeIds, setSelectedShapeIds] = useState<Set<string>>(new Set());

    const selectNode = useCallback((id: string | null, multi = false) => {
        if (!id) {
            if (!multi) {
                setSelectedNodeIds(new Set());
                setSelectedConnectionIds(new Set());
                setSelectedShapeIds(new Set());
            }
            return;
        }

        setSelectedNodeIds(prev => {
            const next = new Set(multi ? prev : []);
            next.add(id);
            return next;
        });

        if (!multi) {
            setSelectedConnectionIds(new Set());
            setSelectedShapeIds(new Set());
        }
    }, []);

    const toggleNodeSelection = useCallback((id: string) => {
        setSelectedNodeIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const selectConnection = useCallback((id: string | null, multi = false) => {
        if (!id) {
            if (!multi) {
                setSelectedConnectionIds(new Set());
            }
            return;
        }

        setSelectedConnectionIds(prev => {
            const next = new Set(multi ? prev : []);
            next.add(id);
            return next;
        });

        if (!multi) {
            setSelectedNodeIds(new Set());
            setSelectedShapeIds(new Set());
        }
    }, []);

    const selectShape = useCallback((id: string | null, multi = false) => {
        if (!id) {
            if (!multi) {
                setSelectedShapeIds(new Set());
            }
            return;
        }

        setSelectedShapeIds(prev => {
            const next = new Set(multi ? prev : []);
            next.add(id);
            return next;
        });

        if (!multi) {
            setSelectedNodeIds(new Set());
            setSelectedConnectionIds(new Set());
        }
    }, []);

    const setSelection = useCallback((nodes: string[], shapes: string[], connections: string[]) => {
        setSelectedNodeIds(new Set(nodes));
        setSelectedShapeIds(new Set(shapes));
        setSelectedConnectionIds(new Set(connections));
    }, []);

    const clearSelection = useCallback(() => {
        setSelectedNodeIds(new Set());
        setSelectedConnectionIds(new Set());
        setSelectedShapeIds(new Set());
    }, []);

    const selectedObject = useMemo(() => {
        if (selectedNodeIds.size === 1) return { type: 'node' as const, id: Array.from(selectedNodeIds)[0] };
        if (selectedConnectionIds.size === 1) return { type: 'connection' as const, id: Array.from(selectedConnectionIds)[0] };
        if (selectedShapeIds.size === 1) return { type: 'shape' as const, id: Array.from(selectedShapeIds)[0] };
        return null;
    }, [selectedNodeIds, selectedConnectionIds, selectedShapeIds]);

    // Backward compatibility / Single-select helpers
    const selectedNodeId = useMemo(() => selectedNodeIds.size === 1 ? Array.from(selectedNodeIds)[0] : null, [selectedNodeIds]);
    const selectedConnectionId = useMemo(() => selectedConnectionIds.size === 1 ? Array.from(selectedConnectionIds)[0] : null, [selectedConnectionIds]);
    const selectedShapeId = useMemo(() => selectedShapeIds.size === 1 ? Array.from(selectedShapeIds)[0] : null, [selectedShapeIds]);

    return {
        selectedNodeIds,
        selectedConnectionIds,
        selectedShapeIds,
        selectedNodeId,
        selectedConnectionId,
        selectedShapeId,
        selectNode,
        toggleNodeSelection,
        selectConnection,
        selectShape,
        setSelection,
        clearSelection,
        selectedObject
    };
}
