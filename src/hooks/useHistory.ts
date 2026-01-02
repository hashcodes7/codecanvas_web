import { useState, useCallback, useRef, useEffect } from 'react';
import type { NodeData, Connection, ShapeData } from '../types';

interface HistoryState {
    nodes: NodeData[];
    connections: Connection[];
    shapes: ShapeData[];
}

interface UseHistoryProps {
    nodes: NodeData[];
    connections: Connection[];
    shapes: ShapeData[];
    setNodes: (nodes: NodeData[] | ((prev: NodeData[]) => NodeData[])) => void;
    setConnections: (connections: Connection[] | ((prev: Connection[]) => Connection[])) => void;
    setShapes: (shapes: ShapeData[] | ((prev: ShapeData[]) => ShapeData[])) => void;
}

export const useHistory = ({
    nodes,
    connections,
    shapes,
    setNodes,
    setConnections,
    setShapes
}: UseHistoryProps) => {
    // Use refs for history to avoid re-renders on every push
    // This significantly improves performance as the history grows
    // Initialize with the current state (props) so we can undo back to the "clean slate"
    const historyRef = useRef<HistoryState[]>([{ nodes, connections, shapes }]);
    const pointerRef = useRef<number>(0);
    const snapshotPendingRef = useRef<boolean>(false);

    // Minimal state just to trigger UI updates for button disabled states
    const [, setVersion] = useState(0);

    // Keep track of current state for capture
    const currentStateRef = useRef<HistoryState>({ nodes, connections, shapes });

    // Sync current state ref and handle pending snapshots
    useEffect(() => {
        currentStateRef.current = { nodes, connections, shapes };

        // If a snapshot was requested, capture it now that we depend on the new state
        if (snapshotPendingRef.current) {
            realPushToHistory({ nodes, connections, shapes });
            snapshotPendingRef.current = false;
        }
    }, [nodes, connections, shapes]);

    const realPushToHistory = (state: HistoryState) => {
        const history = historyRef.current;
        const pointer = pointerRef.current;

        // Check if state actually changed from the last saved state
        if (pointer >= 0 && pointer < history.length) {
            const lastState = history[pointer];
            if (
                lastState.nodes === state.nodes &&
                lastState.connections === state.connections &&
                lastState.shapes === state.shapes
            ) {
                return; // No change, don't push
            }
        }

        // Slice history if we are in the middle and making a new change
        const newHistory = history.slice(0, pointer + 1);

        // Add new state
        newHistory.push(state);

        // Limit history size (e.g. 50 steps) to manage memory
        if (newHistory.length > 50) {
            newHistory.shift();
        }

        historyRef.current = newHistory;
        pointerRef.current = newHistory.length - 1;

        setVersion(v => v + 1);
    };

    const addToHistory = useCallback(() => {
        // We just flag that we want to save the state on the next effect cycle
        // This allows us to call this function *before* or *during* a state update
        // and correctly capture the *result* of that update.
        snapshotPendingRef.current = true;
    }, []);

    const undo = useCallback(() => {
        const pointer = pointerRef.current;
        if (pointer <= 0) return;

        const prevIndex = pointer - 1;
        const stateToRestore = historyRef.current[prevIndex];

        // Restore state
        setNodes(stateToRestore.nodes);
        setConnections(stateToRestore.connections);
        setShapes(stateToRestore.shapes);

        pointerRef.current = prevIndex;
        setVersion(v => v + 1);
    }, [setNodes, setConnections, setShapes]);

    const redo = useCallback(() => {
        const pointer = pointerRef.current;
        const history = historyRef.current;
        if (pointer >= history.length - 1) return;

        const nextIndex = pointer + 1;
        const stateToRestore = history[nextIndex];

        setNodes(stateToRestore.nodes);
        setConnections(stateToRestore.connections);
        setShapes(stateToRestore.shapes);

        pointerRef.current = nextIndex;
        setVersion(v => v + 1);
    }, [setNodes, setConnections, setShapes]);

    const clearHistory = useCallback(() => {
        historyRef.current = [];
        pointerRef.current = -1;
        setVersion(v => v + 1);
    }, []);

    // Resurrection Logic: If history was cleared (e.g. project switch), re-initialize it with current state
    useEffect(() => {
        if (historyRef.current.length === 0) {
            historyRef.current = [{ nodes, connections, shapes }];
            pointerRef.current = 0;
            setVersion(v => v + 1);
        }
    }, [nodes.length, shapes.length]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return;
            }

            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    redo();
                } else {
                    undo();
                }
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                e.preventDefault();
                redo();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo]);

    return {
        addToHistory, // Renamed for clarity
        undo,
        redo,
        clearHistory,
        canUndo: pointerRef.current > 0,
        canRedo: pointerRef.current < historyRef.current.length - 1
    };
};
