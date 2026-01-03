/**
 * Manages the state and logic for Connections between nodes.
 * Handles linking interactions, temporary connection lines during creation,
 * and maintains the map of connections per node.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import type { MutableRefObject } from 'react';
import type { Connection } from '../types';

interface UseConnectionsProps {
    scaleRef: MutableRefObject<number>;
    offsetRef: MutableRefObject<{ x: number; y: number }>;
    viewportRef: MutableRefObject<HTMLDivElement | null>;
    getHandleCanvasPos: (nodeId: string, handleId: string) => { x: number; y: number };
    updateHandleOffsets: (nodeId: string) => void;
}

export function useConnections({
    scaleRef,
    offsetRef,
    viewportRef,
    getHandleCanvasPos,
    updateHandleOffsets
}: UseConnectionsProps) {
    const [connections, setConnections] = useState<Connection[]>([]);
    const [defaultLineType, setDefaultLineType] = useState<'line' | 'arrow' | 'bi-arrow'>('arrow');
    const [linkingState, setLinkingState] = useState<{
        sourceNodeId: string;
        sourceHandleId: string;
        startX: number;
        startY: number;
        targetX: number;
        targetY: number;
    } | null>(null);

    const connectionsRef = useRef(connections);
    const connectionsByNodeRef = useRef<Map<string, string[]>>(new Map());

    // Sync refs
    useEffect(() => { connectionsRef.current = connections; }, [connections]);

    // Update Lookups
    useEffect(() => {
        const cMap = new Map();
        connections.forEach(c => {
            if (!cMap.has(c.source.nodeId)) cMap.set(c.source.nodeId, []);
            if (!cMap.has(c.target.nodeId)) cMap.set(c.target.nodeId, []);
            cMap.get(c.source.nodeId).push(c.id);
            cMap.get(c.target.nodeId).push(c.id);
        });
        connectionsByNodeRef.current = cMap;
    }, [connections]);


    const startLinking = useCallback((nodeId: string, handleId: string) => {
        const hPos = getHandleCanvasPos(nodeId, handleId);
        setLinkingState({
            sourceNodeId: nodeId,
            sourceHandleId: handleId,
            startX: hPos.x,
            startY: hPos.y,
            targetX: hPos.x,
            targetY: hPos.y
        });
    }, [getHandleCanvasPos]);

    const updateLinking = useCallback((e: React.PointerEvent) => {
        if (!linkingState) return;
        const rect = viewportRef.current?.getBoundingClientRect();
        if (!rect) return;

        setLinkingState(prev => prev ? ({
            ...prev,
            targetX: (e.clientX - rect.left - offsetRef.current.x) / scaleRef.current,
            targetY: (e.clientY - rect.top - offsetRef.current.y) / scaleRef.current
        }) : null);
    }, [linkingState, viewportRef, offsetRef, scaleRef]);

    const completeLinking = useCallback((targetNodeId: string, targetHandleId: string) => {
        if (!linkingState) return;

        if (targetNodeId !== linkingState.sourceNodeId || targetHandleId !== linkingState.sourceHandleId) {
            // Ensure handles are up to date
            updateHandleOffsets(targetNodeId);

            const newConnection: Connection = {
                id: `conn-${Date.now()}`,
                source: { nodeId: linkingState.sourceNodeId, handleId: linkingState.sourceHandleId },
                target: { nodeId: targetNodeId, handleId: targetHandleId },
                type: defaultLineType
            };
            setConnections(prev => [...prev, newConnection]);
        }
        setLinkingState(null);
    }, [linkingState, defaultLineType, updateHandleOffsets]);


    return {
        connections,
        setConnections,
        connectionsRef,
        connectionsByNodeRef,
        defaultLineType,
        setDefaultLineType,
        linkingState,
        setLinkingState,
        startLinking,
        updateLinking,
        completeLinking
    };
}
