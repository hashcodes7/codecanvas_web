/**
 * Manages the state and logic for File and Text nodes on the canvas.
 * Handles creation, file syncing, content updates, handle offset calculations,
 * and interactions with the FileSystem API.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import type { MutableRefObject } from 'react';
import type { NodeData, ShapeData } from '../types';
import { INITIAL_NODES } from '../constants';
import { FileStorage } from '../storage';
import { FileNodeService } from '../FileNodeService';
import { computeHandlePositions } from '../utils/canvasUtils';

interface UseNodesProps {
    scaleRef: MutableRefObject<number>;
    shapesRef: MutableRefObject<ShapeData[]>;
    viewportRef: MutableRefObject<HTMLDivElement | null>;
    offsetRef: MutableRefObject<{ x: number; y: number }>;
}

export function useNodes({ scaleRef, shapesRef, viewportRef, offsetRef }: UseNodesProps) {
    const [nodes, setNodes] = useState<NodeData[]>(INITIAL_NODES);
    const [handleOffsets, setHandleOffsets] = useState<Record<string, { x: number; y: number }>>({});
    const [loadingContent, setLoadingContent] = useState(true);

    // Refs for high-performance updates
    const nodesRef = useRef(nodes);
    const nodesMapRef = useRef<Map<string, NodeData>>(new Map());
    const handleOffsetsRef = useRef(handleOffsets);

    // Sync refs
    useEffect(() => { nodesRef.current = nodes; }, [nodes]);
    useEffect(() => { handleOffsetsRef.current = handleOffsets; }, [handleOffsets]);

    // Update Map for O(1) access
    useEffect(() => {
        const nMap = new Map();
        nodes.forEach(n => nMap.set(n.id, n));
        nodesMapRef.current = nMap;
    }, [nodes]);

    // Load file contents from IndexedDB on mount
    useEffect(() => {
        const loadContents = async () => {
            const updatedNodes = await Promise.all(
                nodesRef.current.map(async (node) => {
                    if (node.type === 'file' && !node.content) {
                        const content = await FileStorage.getFileContent(node.id);
                        if (content) return { ...node, content };
                    }
                    return node;
                })
            );
            setNodes(updatedNodes);
            setLoadingContent(false);
        };
        loadContents();
    }, []);

    // --- Actions ---

    const addTextNode = useCallback(() => {
        const rect = viewportRef.current?.getBoundingClientRect();
        if (!rect) return;

        // Center the new node on screen (approx)
        const x = (rect.width / 2 - offsetRef.current.x - 100) / scaleRef.current;
        const y = (rect.height / 2 - offsetRef.current.y - 50) / scaleRef.current;

        const newNode: NodeData = {
            id: `text-${Date.now()}`,
            title: 'Note',
            type: 'text',
            content: '',
            x,
            y,
            width: 200,
            height: 150
        };

        setNodes(prev => [...prev, newNode]);
        return newNode.id;
    }, [scaleRef, offsetRef, viewportRef]);

    const addFileNode = useCallback(async () => {
        try {
            const rect = viewportRef.current?.getBoundingClientRect();
            if (!rect) return;

            const [fileHandle] = await (window as any).showOpenFilePicker({
                types: [
                    {
                        description: 'Code Files',
                        accept: {
                            'text/*': ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.cpp', '.c', '.go', '.rs', '.css', '.html', '.json', '.md', '.txt']
                        }
                    }
                ],
                multiple: false
            });

            if (fileHandle) {
                const x = (rect.width / 2 - offsetRef.current.x - 150) / scaleRef.current;
                const y = (rect.height / 2 - offsetRef.current.y - 100) / scaleRef.current;
                const nodeId = `node-${Date.now()}`;
                const content = await FileNodeService.readFile(fileHandle) || '';

                await FileStorage.saveFileHandle(nodeId, fileHandle);

                const newNode: NodeData = {
                    id: nodeId,
                    title: fileHandle.name,
                    type: 'file',
                    content,
                    uri: `file://${fileHandle.name}`,
                    x,
                    y,
                    hasWritePermission: false,
                    isEditing: false
                };

                setNodes(prev => [...prev, newNode]);
                return newNode.id;
            }
        } catch (err) {
            console.warn('File selection cancelled or failed:', err);
        }
        return null;
    }, [scaleRef, offsetRef, viewportRef]);

    const syncNodeFromDisk = useCallback(async (nodeId: string) => {
        try {
            const handle = await FileStorage.getFileHandle(nodeId);
            let content: string | null = null;

            if (handle) {
                content = await FileNodeService.readFile(handle);
            } else {
                // No handle exists, prompt user to select file
                const [fileHandle] = await (window as any).showOpenFilePicker({
                    types: [{ description: 'Code Files', accept: { 'text/*': ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.cpp', '.c', '.go', '.rs', '.css', '.html', '.json'] } }]
                });

                if (fileHandle) {
                    await FileStorage.saveFileHandle(nodeId, fileHandle);
                    content = await FileNodeService.readFile(fileHandle);
                }
            }

            if (content !== null) {
                setNodes(prev => prev.map(n =>
                    n.id === nodeId ? { ...n, content: content! } : n
                ));
            }
        } catch (error) {
            console.error('Failed to sync file:', error);
        }
    }, []);

    const requestWritePermission = useCallback(async (nodeId: string) => {
        const handle = await FileStorage.getFileHandle(nodeId);
        if (!handle) return;

        const granted = await FileNodeService.verifyPermission(handle, true);
        if (granted) {
            setNodes(prev => prev.map(n =>
                n.id === nodeId ? { ...n, hasWritePermission: true, isEditing: true } : n
            ));
        }
    }, []);

    const saveNodeToDisk = useCallback(async (nodeId: string, content: string) => {
        const handle = await FileStorage.getFileHandle(nodeId);
        if (!handle) return;

        const success = await FileNodeService.saveFile(handle, content);
        if (success) {
            setNodes(prev => prev.map(n =>
                n.id === nodeId ? { ...n, isDirty: false } : n
            ));
        }
    }, []);

    const updateHandleOffsets = useCallback((specificNodeId?: string) => {
        // Strategy 1: Math-based (Fastest, no DOM read)
        if (specificNodeId) {
            const node = nodesMapRef.current.get(specificNodeId);
            const shape = shapesRef.current.find(s => s.id === specificNodeId);
            const item = node || shape;
            if (item && item.width && item.height) {
                const handles = computeHandlePositions(0, 0, item.width, item.height);
                setHandleOffsets(prev => {
                    const next = { ...prev };
                    Object.entries(handles).forEach(([hId, pos]) => {
                        next[`${specificNodeId}:${hId}`] = pos;
                    });
                    return next;
                });
                return;
            }
        }

        // Strategy 2: DOM-based (Localized)
        if (specificNodeId) {
            let nodeEl = document.getElementById(specificNodeId);
            if (!nodeEl && specificNodeId.startsWith('shape-')) {
                nodeEl = document.getElementById(`handles-${specificNodeId}`);
            }
            if (!nodeEl) return;

            const rect = nodeEl.getBoundingClientRect();
            const handles = nodeEl.querySelectorAll('[data-handle-id]');
            const newOffsets: Record<string, { x: number; y: number }> = {};

            handles.forEach(handle => {
                const handleId = handle.getAttribute('data-handle-id');
                if (!handleId) return;
                const handleRect = handle.getBoundingClientRect();
                newOffsets[`${specificNodeId}:${handleId}`] = {
                    x: (handleRect.left + handleRect.width / 2 - rect.left) / scaleRef.current,
                    y: (handleRect.top + handleRect.height / 2 - rect.top) / scaleRef.current
                };
            });

            setHandleOffsets(prev => ({ ...prev, ...newOffsets }));
            return;
        }

        // Strategy 3: Global DOM Scan (Fallback for init/zoom)
        const newOffsets: Record<string, { x: number; y: number }> = {};
        const nodeEls = document.querySelectorAll('.canvas-node, .shape-handle-container');

        nodeEls.forEach(el => {
            const id = el.id.startsWith('handles-') ? el.id.replace('handles-', '') : el.id;
            if (!id) return;

            // Try to use math first
            const node = nodesMapRef.current.get(id);
            const shape = shapesRef.current.find(s => s.id === id);
            const item = node || shape;

            if (item && item.width && item.height) {
                const handles = computeHandlePositions(0, 0, item.width, item.height);
                Object.entries(handles).forEach(([hId, pos]) => {
                    newOffsets[`${id}:${hId}`] = pos;
                });
                return;
            }

            const rect = el.getBoundingClientRect();
            const handles = el.querySelectorAll('[data-handle-id]');

            handles.forEach(handle => {
                const handleId = handle.getAttribute('data-handle-id');
                if (!handleId) return;

                const handleRect = handle.getBoundingClientRect();
                newOffsets[`${id}:${handleId}`] = {
                    x: (handleRect.left + handleRect.width / 2 - rect.left) / scaleRef.current,
                    y: (handleRect.top + handleRect.height / 2 - rect.top) / scaleRef.current
                };
            });
        });
        setHandleOffsets(newOffsets);
    }, [scaleRef, shapesRef]);

    // -- Event Handlers exposed as simple functions ---
    const handleContentChange = useCallback((id: string, content: string) => {
        setNodes(prev => prev.map(n => n.id === id ? { ...n, content, isDirty: true } : n));
    }, []);

    const handleToggleEditing = useCallback((id: string, isEditing: boolean) => {
        setNodes(prev => prev.map(n => n.id === id ? { ...n, isEditing } : n));
    }, []);

    return {
        nodes,
        setNodes,
        nodesRef,
        nodesMapRef,
        handleOffsets,
        handleOffsetsRef,
        loadingContent,
        addTextNode,
        addFileNode,
        syncNodeFromDisk,
        requestWritePermission,
        saveNodeToDisk,
        updateHandleOffsets,
        handleContentChange,
        handleToggleEditing
    };
}
