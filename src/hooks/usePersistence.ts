import { useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { ProjectStorage, FileStorage } from '../storage';
import { FileNodeService } from '../FileNodeService';
import type { NodeData, Connection, ShapeData, CanvasProperties } from '../types';
import { INITIAL_NODES, STORAGE_KEYS } from '../constants';

interface UsePersistenceProps {
    currentProjectId: string;
    nodes: NodeData[];
    connections: Connection[];
    shapes: ShapeData[];
    scale: number;
    offset: { x: number, y: number };
    backgroundPattern: 'grid' | 'dots' | 'lines';
    backgroundOpacity: number;
    theme: 'light' | 'dark' | 'paper';
    syntaxTheme: 'classic' | 'monokai' | 'nord' | 'solarized' | 'ink';
    setNodes: Dispatch<SetStateAction<NodeData[]>>;
    setConnections: Dispatch<SetStateAction<Connection[]>>;
    setShapes: Dispatch<SetStateAction<ShapeData[]>>;
    setScale: (scale: number) => void;
    setOffset: (offset: { x: number, y: number }) => void;
    setBackgroundPattern: (pattern: 'grid' | 'dots' | 'lines') => void;
    setBackgroundOpacity: (opacity: number) => void;
    setTheme: (theme: 'light' | 'dark' | 'paper') => void;
    setSyntaxTheme: (theme: 'classic' | 'monokai' | 'nord' | 'solarized' | 'ink') => void;
    updateLastModified: (id: string) => void;
}

export function usePersistence({
    currentProjectId,
    nodes,
    connections,
    shapes,
    scale,
    offset,
    backgroundPattern,
    backgroundOpacity,
    theme,
    syntaxTheme,
    setNodes,
    setConnections,
    setShapes,
    setScale,
    setOffset,
    setBackgroundPattern,
    setBackgroundOpacity,
    setTheme,
    setSyntaxTheme,
    updateLastModified
}: UsePersistenceProps) {

    const saveTimeoutRef = useRef<number | null>(null);
    const loadingRef = useRef(false);

    // Migration logic
    useEffect(() => {
        const migrateLegacyData = async () => {
            const oldNodes = localStorage.getItem('codecanvas-nodes');
            const oldConns = localStorage.getItem('codecanvas-connections');
            const oldTransform = localStorage.getItem('codecanvas-transform');

            if (oldNodes || oldConns || oldTransform) {
                console.log('Migrating legacy data to Project-1...');
                const m_nodes = oldNodes ? JSON.parse(oldNodes) : [];
                const m_connections = oldConns ? JSON.parse(oldConns) : [];
                const m_transform = oldTransform ? JSON.parse(oldTransform) : { scale: 1, offset: { x: 0, y: 0 } };

                await ProjectStorage.saveProjectObjects('project-1', m_nodes, m_connections, []);
                const props: CanvasProperties = {
                    backgroundPattern: (localStorage.getItem('backgroundPattern') as any) || 'grid',
                    backgroundOpacity: parseFloat(localStorage.getItem('backgroundOpacity') || '0.7'),
                    theme: (localStorage.getItem('theme') as any) || 'dark',
                    syntaxTheme: (localStorage.getItem('syntaxTheme') as any) || 'classic',
                    transform: m_transform
                };
                localStorage.setItem(`${STORAGE_KEYS.PROPS_PREFIX}project-1`, JSON.stringify(props));

                localStorage.removeItem('codecanvas-nodes');
                localStorage.removeItem('codecanvas-connections');
                localStorage.removeItem('codecanvas-transform');
                localStorage.removeItem('backgroundPattern');
                localStorage.removeItem('backgroundOpacity');
                localStorage.removeItem('theme');
                localStorage.removeItem('syntaxTheme');

                window.location.reload();
            }
        };
        migrateLegacyData();
    }, []);

    // Load Project
    useEffect(() => {
        const loadProject = async () => {
            if (!currentProjectId) return;
            loadingRef.current = true;

            // Load Properties
            const propsStr = localStorage.getItem(`${STORAGE_KEYS.PROPS_PREFIX}${currentProjectId}`);
            if (propsStr) {
                const props: CanvasProperties = JSON.parse(propsStr);
                setBackgroundPattern(props.backgroundPattern);
                setBackgroundOpacity(props.backgroundOpacity);
                setTheme(props.theme);
                setSyntaxTheme(props.syntaxTheme);
                setScale(props.transform.scale);
                setOffset(props.transform.offset);
            } else {
                // Defaults
                setBackgroundPattern('grid');
                setBackgroundOpacity(0.7);
                setTheme('dark');
                setSyntaxTheme('classic');
                setScale(1);
                setOffset({ x: 0, y: 0 });
            }

            // Load Objects
            const data = await ProjectStorage.getProjectObjects(currentProjectId);
            if (data) {
                setNodes(data.nodes);
                setConnections(data.connections);
                setShapes(data.shapes || []);
            } else {
                setNodes(INITIAL_NODES);
                setConnections([]);
                setShapes([]);
            }
            loadingRef.current = false;
        };
        loadProject();
    }, [currentProjectId, setNodes, setConnections, setShapes, setScale, setOffset, setBackgroundPattern, setBackgroundOpacity, setTheme, setSyntaxTheme]);

    // Debounced Save
    useEffect(() => {
        if (loadingRef.current || !currentProjectId) return;

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

        saveTimeoutRef.current = window.setTimeout(async () => {
            // Save file contents
            await Promise.all(
                nodes.map(async (node) => {
                    if ((node.type === 'file' || node.type === 'text') && node.content && node.isDirty) {
                        await FileStorage.saveFileContent(node.id, node.content);
                        if (node.type === 'file' && node.hasWritePermission) {
                            const handle = await FileStorage.getFileHandle(node.id);
                            if (handle) {
                                await FileNodeService.saveFile(handle, node.content);
                            }
                        }
                    }
                })
            );

            // Save Objects
            const persistentNodes = nodes.map(node => {
                if (node.type === 'file') {
                    const { content, ...rest } = node;
                    return { ...rest, isDirty: false };
                }
                return { ...node, isDirty: false };
            });

            await ProjectStorage.saveProjectObjects(currentProjectId, persistentNodes, connections, shapes);
            setNodes(prev => prev.map(n => ({ ...n, isDirty: false })));
            updateLastModified(currentProjectId);

            // Save Properties
            const props: CanvasProperties = {
                backgroundPattern,
                backgroundOpacity,
                theme,
                syntaxTheme,
                transform: { scale, offset }
            };
            localStorage.setItem(`${STORAGE_KEYS.PROPS_PREFIX}${currentProjectId}`, JSON.stringify(props));

        }, 2000);

        return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); }
    }, [nodes, connections, shapes, scale, offset, backgroundPattern, backgroundOpacity, theme, syntaxTheme, currentProjectId, updateLastModified]);
}
