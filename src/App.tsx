import React, { useState, useRef, useEffect, useCallback, memo, useMemo } from 'react';
import './index.css';
import { FileStorage, ProjectStorage } from './storage';
import { FileNodeService } from './FileNodeService';
import type { NodeData, Connection, CanvasManifestItem, CanvasProperties } from './types';
import { INITIAL_NODES, STORAGE_KEYS } from './constants';
import { getPathData, computeHandlePositions } from './utils/canvasUtils';
import { getLanguageFromFilename } from './utils/fileUtils';
import { activateSymbols, addGenericHandlesToCode } from './utils/codeUtils';

const ConnectionLine = memo(({
  conn,
  isSelected,
  startX,
  startY,
  endX,
  endY,
  onSelect
}: {
  conn: Connection,
  isSelected: boolean,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  onSelect: (id: string) => void
}) => {
  return (
    <path
      id={`path-${conn.id}`}
      d={getPathData(startX, startY, endX, endY)}
      className={`connection-path ${isSelected ? 'selected' : ''}`}
      style={{
        stroke: conn.style?.color || 'var(--accent-primary)',
        strokeWidth: isSelected ? (conn.style?.width || 2) + 2 : (conn.style?.width || 2)
      }}
      markerEnd={conn.type === 'arrow' || conn.type === 'bi-arrow' ? "url(#arrowhead)" : ""}
      markerStart={conn.type === 'bi-arrow' ? "url(#arrowhead-start)" : ""}
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelect(conn.id);
      }}
    />
  );
});

const CanvasNode = memo(({
  node,
  isSelected,
  onPointerDown,
  onHeaderPointerDown,
  onResizePointerDown,
  onContentChange,
  onToggleEditing,
  onSync,
  onRequestPermission,
  onSave,
  updateHandleOffsets
}: {
  node: NodeData,
  isSelected: boolean,
  onPointerDown: (id: string) => void,
  onHeaderPointerDown: (id: string, e: React.PointerEvent) => void,
  onResizePointerDown: (id: string, e: React.PointerEvent) => void,
  onContentChange: (id: string, content: string) => void,
  onToggleEditing: (id: string, editing: boolean) => void,
  onSync: (id: string) => void,
  onRequestPermission: (id: string) => void,
  onSave: (id: string, content: string) => void,
  updateHandleOffsets: (id?: string) => void
}) => {
  const codeRef = useRef<HTMLPreElement>(null);

  // Localized status logic to prevent object creation in parent
  const status = useMemo(() => {
    if (node.isDirty) {
      return { icon: 'bi-three-dots', text: 'Saving...', color: '#fbbf24', animate: true };
    }
    if (node.type === 'file' && !node.hasWritePermission) {
      return { icon: 'bi-lock', text: 'Read-only', color: '#9ca3af', animate: false };
    }
    return { icon: 'bi-check2', text: 'Saved', color: '#4ade80', animate: false };
  }, [node.isDirty, node.type, node.hasWritePermission]);

  useEffect(() => {
    if (codeRef.current && (window as any).Prism && !node.isEditing) {
      const el = codeRef.current;
      const code = el.querySelector('code');
      if (code && node.content) {
        (window as any).Prism.highlightElement(code);

        // Apply handles after highlighting
        activateSymbols(el);
        addGenericHandlesToCode(el);
        addGenericHandlesToCode(el);
        updateHandleOffsets(node.id);
      } else if (node.type === 'text') {
        activateSymbols(el);
        addGenericHandlesToCode(el);
        updateHandleOffsets(node.id);
      }
    }
  }, [node.content, node.isEditing, node.type, updateHandleOffsets]);

  return (
    <div
      id={node.id}
      className={`canvas-node ${isSelected ? 'selected' : ''} ${node.type}-node`}
      style={{
        left: node.x,
        top: node.y,
        width: node.width,
        height: node.height,
        maxWidth: node.width ? 'none' : undefined,
        maxHeight: node.height ? 'none' : undefined,
        transform: 'translate3d(0,0,0)', // Force GPU layer
        willChange: 'transform, width, height'
      }}
      onPointerDown={() => onPointerDown(node.id)}
    >
      <div
        className="node-header"
        onPointerDown={(e) => onHeaderPointerDown(node.id, e)}
      >
        <div className="node-title-container">
          {node.type === 'file' && <i className="bi bi-file-earmark-code" style={{ marginRight: '8px', color: '#a78bfa' }}></i>}
          {node.type === 'text' && <i className="bi bi-sticky" style={{ marginRight: '8px', color: '#fcd34d' }}></i>}
          <span className="node-title">{node.title}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            fontSize: '0.75rem',
            color: status.color,
            fontWeight: 500,
            opacity: 0.8
          }}>
            {status.text}
          </span>
          <i
            className={`bi ${status.icon} ${status.animate ? 'animate-pulse' : ''}`}
            style={{
              color: status.color,
              fontSize: '1rem',
              animation: status.animate ? 'pulse 1.5s infinite' : 'none'
            }}
          />
        </div>
      </div>
      <div className="node-content">
        {node.type === 'text' ? (
          node.isEditing ? (
            <textarea
              className="text-node-input"
              placeholder="Type something..."
              value={node.content}
              onChange={(e) => onContentChange(node.id, e.target.value)}
              onPointerDown={(e) => e.stopPropagation()}
              autoFocus
              onBlur={() => onToggleEditing(node.id, false)}
            />
          ) : (
            <pre
              ref={codeRef}
              className="text-node-content code-editor"
              onDoubleClick={() => onToggleEditing(node.id, true)}
            >
              {node.content || 'Double-click to edit'}
            </pre>
          )
        ) : (
          <div style={{ display: 'flex', flex: 1, minWidth: 0 }}>
            {node.content !== undefined ? (
              <>
                <div className="line-numbers">
                  {node.content.split('\n').map((_, i) => (
                    <span key={i}>{i + 1}</span>
                  ))}
                </div>
                {node.isEditing ? (
                  <textarea
                    className="code-editor-textarea"
                    value={node.content}
                    onChange={(e) => onContentChange(node.id, e.target.value)}
                    onPointerDown={(e) => e.stopPropagation()}
                    autoFocus
                    onBlur={() => onToggleEditing(node.id, false)}
                  />
                ) : (
                  <pre
                    ref={codeRef}
                    className={`code-editor language-${getLanguageFromFilename(node.title)}`}
                    onDoubleClick={() => {
                      if (node.content !== undefined) {
                        onToggleEditing(node.id, true);
                      }
                    }}
                  >
                    <code className={`language-${getLanguageFromFilename(node.title)}`}>
                      {node.content}
                    </code>
                  </pre>
                )}
              </>
            ) : (
              <div style={{ padding: '20px', color: '#6b7280', fontSize: '0.875rem', textAlign: 'center', width: '100%' }}>
                <i className="bi bi-cloud-download" style={{ display: 'block', fontSize: '1.5rem', marginBottom: '8px' }}></i>
                Content not loaded from system
              </div>
            )}
          </div>
        )}
        {node.type === 'file' && (
          <div className="uri-footer">
            <i className="bi bi-link-45deg"></i>
            <span className="truncate" title={node.uri}>{node.uri}</span>
            <button
              className="sync-btn"
              onClick={(e) => {
                e.stopPropagation();
                onSync(node.id);
              }}
              title="Sync with file on disk"
            >
              <i className="bi bi-arrow-repeat"></i>
            </button>

            {!node.hasWritePermission ? (
              <button
                className="sync-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onRequestPermission(node.id);
                }}
                title="Request Edit Permission"
                style={{ marginLeft: '4px', color: '#94a3b8' }}
              >
                <i className="bi bi-pencil"></i>
              </button>
            ) : (
              <button
                className="sync-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onSave(node.id, node.content || '');
                }}
                title="Save to Disk"
                style={{ marginLeft: '4px', color: '#10b981' }}
              >
                <i className="bi bi-save"></i>
              </button>
            )}
          </div>
        )}
      </div>
      {node.type === 'file' && (
        <>
          <div className="handle handle-left-1" data-handle-id="left-1"></div>
          <div className="handle handle-left-2" data-handle-id="left-2"></div>
          <div className="handle handle-right-1" data-handle-id="right-1"></div>
          <div className="handle handle-right-2" data-handle-id="right-2"></div>
          <div className="handle handle-top-1" data-handle-id="top-1"></div>
          <div className="handle handle-top-2" data-handle-id="top-2"></div>
          <div className="handle handle-bottom-1" data-handle-id="bottom-1"></div>
          <div className="handle handle-bottom-2" data-handle-id="bottom-2"></div>
        </>
      )}

      <div
        className="resize-handle"
        onPointerDown={(e) => onResizePointerDown(node.id, e)}
      />
    </div>
  );
});

function App() {
  // --- Project System Initialization ---
  const [currentProjectId, setCurrentProjectId] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEYS.CURRENT_PROJECT_ID) || 'project-1';
  });

  const [manifest, setManifest] = useState<CanvasManifestItem[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.MANIFEST);
    if (!saved) {
      const initialManifest = [{ id: 'project-1', name: 'Main Canvas', lastModified: new Date().toISOString() }];
      localStorage.setItem(STORAGE_KEYS.MANIFEST, JSON.stringify(initialManifest));
      localStorage.setItem(STORAGE_KEYS.CURRENT_PROJECT_ID, 'project-1');
      return initialManifest;
    }
    return JSON.parse(saved);
  });

  // --- Core State ---
  const [nodes, setNodes] = useState<NodeData[]>(INITIAL_NODES);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [scale, setScale] = useState<number>(1);
  const [offset, setOffset] = useState<{ x: number, y: number }>({ x: 0, y: 0 });

  const [backgroundPattern, setBackgroundPattern] = useState<'grid' | 'dots' | 'lines'>('grid');
  const [backgroundOpacity, setBackgroundOpacity] = useState<number>(0.7);
  const [theme, setTheme] = useState<'light' | 'dark' | 'paper'>('dark');
  const [syntaxTheme, setSyntaxTheme] = useState<'classic' | 'monokai' | 'nord' | 'solarized' | 'ink'>('classic');

  const [isPanning, setIsPanning] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [defaultLineType, setDefaultLineType] = useState<'line' | 'arrow' | 'bi-arrow'>('arrow');
  const [linkingState, setLinkingState] = useState<{
    sourceNodeId: string;
    sourceHandleId: string;
    targetX: number;
    targetY: number;
  } | null>(null);

  const [handleOffsets, setHandleOffsets] = useState<Record<string, { x: number, y: number }>>({});
  const [loadingContent, setLoadingContent] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);

  // Refs for high-performance transient updates
  const nodesRef = useRef(nodes);
  const connectionsRef = useRef(connections);
  const scaleRef = useRef(scale);
  const offsetRef = useRef(offset);
  const handleOffsetsRef = useRef(handleOffsets);

  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { connectionsRef.current = connections; }, [connections]);
  useEffect(() => { scaleRef.current = scale; }, [scale]);
  useEffect(() => { offsetRef.current = offset; }, [offset]);
  useEffect(() => { handleOffsetsRef.current = handleOffsets; }, [handleOffsets]);

  // --- Persistence Logic ---

  // Migration logic inside a one-time effect
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

        // Save to new system
        await ProjectStorage.saveProjectObjects('project-1', m_nodes, m_connections);
        const props: CanvasProperties = {
          backgroundPattern: (localStorage.getItem('backgroundPattern') as any) || 'grid',
          backgroundOpacity: parseFloat(localStorage.getItem('backgroundOpacity') || '0.7'),
          theme: (localStorage.getItem('theme') as any) || 'dark',
          syntaxTheme: (localStorage.getItem('syntaxTheme') as any) || 'classic',
          transform: m_transform
        };
        localStorage.setItem(`${STORAGE_KEYS.PROPS_PREFIX}project-1`, JSON.stringify(props));

        // Clean up legacy keys
        localStorage.removeItem('codecanvas-nodes');
        localStorage.removeItem('codecanvas-connections');
        localStorage.removeItem('codecanvas-transform');
        localStorage.removeItem('backgroundPattern');
        localStorage.removeItem('backgroundOpacity');
        localStorage.removeItem('theme');
        localStorage.removeItem('syntaxTheme');

        // Trigger reload to pick up new state
        window.location.reload();
      }
    };
    migrateLegacyData();
  }, []);

  // Load project data when ID changes
  useEffect(() => {
    const loadProject = async () => {
      setLoadingContent(true);

      // Load Properties from LocalStorage (Fast)
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
        // Fallback for first run of project-1 if migration didn't happen
        setBackgroundPattern('grid');
        setBackgroundOpacity(0.7);
        setTheme('dark');
        setSyntaxTheme('classic');
        setScale(1);
        setOffset({ x: 0, y: 0 });
      }

      // Load Heavy Objects from IndexedDB
      const objects = await ProjectStorage.getProjectObjects(currentProjectId);
      if (objects) {
        setNodes(objects.nodes);
        setConnections(objects.connections);
      } else {
        setNodes(INITIAL_NODES);
        setConnections([]);
      }

      setLoadingContent(false);
    };
    loadProject();
  }, [currentProjectId]);

  const viewportRef = useRef<HTMLDivElement>(null);
  const transformLayerRef = useRef<HTMLDivElement>(null);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const draggingNodeId = useRef<string | null>(null);
  const resizingNodeRef = useRef<{ id: string, startX: number, startY: number, startW: number, startH: number } | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);

  // Touch gestures state
  const lastTouchDistance = useRef<number | null>(null);
  const initialPinchCenter = useRef<{ x: number, y: number } | null>(null);

  const nodesMapRef = useRef<Map<string, NodeData>>(new Map());
  const connectionsByNodeRef = useRef<Map<string, string[]>>(new Map());

  useEffect(() => {
    const nMap = new Map();
    nodes.forEach(n => nMap.set(n.id, n));
    nodesMapRef.current = nMap;

    const cMap = new Map();
    connections.forEach(c => {
      if (!cMap.has(c.source.nodeId)) cMap.set(c.source.nodeId, []);
      if (!cMap.has(c.target.nodeId)) cMap.set(c.target.nodeId, []);
      cMap.get(c.source.nodeId).push(c.id);
      cMap.get(c.target.nodeId).push(c.id);
    });
    connectionsByNodeRef.current = cMap;
  }, [nodes, connections]);

  // Optimized helper to get actual canvas coordinates for a handle
  const getHandleCanvasPos = useCallback((nodeId: string, handleId: string) => {
    const node = nodesMapRef.current.get(nodeId);
    const hOffset = handleOffsetsRef.current[`${nodeId}:${handleId}`];

    if (!node || !hOffset) {
      return { x: (node?.x || 0) + 150, y: (node?.y || 0) + 100 };
    }

    return {
      x: node.x + hOffset.x,
      y: node.y + hOffset.y
    };
  }, []);

  const updateSVGLinesForNode = useCallback((nodeId: string) => {
    const connIds = connectionsByNodeRef.current.get(nodeId) || [];
    connIds.forEach(cId => {
      const conn = connectionsRef.current.find(c => c.id === cId);
      if (!conn) return;
      const pathEl = document.getElementById(`path-${conn.id}`);
      if (pathEl) {
        const start = getHandleCanvasPos(conn.source.nodeId, conn.source.handleId);
        const end = getHandleCanvasPos(conn.target.nodeId, conn.target.handleId);
        pathEl.setAttribute('d', getPathData(start.x, start.y, end.x, end.y));
      }
    });
  }, [getHandleCanvasPos]);

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

  // Debounced save to local storage and IndexedDB
  useEffect(() => {
    if (loadingContent) return; // Don't save during initial load

    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(async () => {
      // Save file contents to IndexedDB
      await Promise.all(
        nodes.map(async (node) => {
          if ((node.type === 'file' || node.type === 'text') && node.content && node.isDirty) {
            await FileStorage.saveFileContent(node.id, node.content);

            // If it's a file with write permission, auto-save to disk
            if (node.type === 'file' && node.hasWritePermission) {
              const handle = await FileStorage.getFileHandle(node.id);
              if (handle) {
                await FileNodeService.saveFile(handle, node.content);
              }
            }
          }
        })
      );

      // Save Objects to IndexedDB (Optimized for scale)
      const persistentNodes = nodes.map(node => {
        if (node.type === 'file') {
          const { content, ...rest } = node;
          return { ...rest, isDirty: false };
        }
        return { ...node, isDirty: false };
      });

      await ProjectStorage.saveProjectObjects(currentProjectId, persistentNodes, connections);

      // Update state to reflect saved status
      setNodes(prev => prev.map(n => ({ ...n, isDirty: false })));

      // Update Manifest lastModified
      setManifest(prev => {
        const updated = prev.map(m =>
          m.id === currentProjectId ? { ...m, lastModified: new Date().toISOString() } : m
        );
        localStorage.setItem(STORAGE_KEYS.MANIFEST, JSON.stringify(updated));
        return updated;
      });
    }, 2000);

    // PROPERTIES: Save immediately to LocalStorage (Atomic & Fast)
    const props: CanvasProperties = {
      backgroundPattern,
      backgroundOpacity,
      theme,
      syntaxTheme,
      transform: { scale, offset }
    };
    localStorage.setItem(`${STORAGE_KEYS.PROPS_PREFIX}${currentProjectId}`, JSON.stringify(props));

    return () => {
      if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    };
  }, [nodes, connections, scale, offset, loadingContent, backgroundPattern, backgroundOpacity, theme, syntaxTheme, currentProjectId]);

  // Apply Theme
  useEffect(() => {
    const applyTheme = (t: string, st: string) => {
      const root = document.documentElement;
      root.setAttribute('data-theme', t);
      root.setAttribute('data-syntax-theme', st);
    };

    applyTheme(theme, syntaxTheme);
  }, [theme, syntaxTheme]);

  const deleteSelected = useCallback(() => {
    if (selectedNodeId) {
      setNodes(prev => prev.filter(n => n.id !== selectedNodeId));
      setConnections(prev => prev.filter(c => c.source.nodeId !== selectedNodeId && c.target.nodeId !== selectedNodeId));
      setSelectedNodeId(null);
    } else if (selectedConnectionId) {
      setConnections(prev => prev.filter(c => c.id !== selectedConnectionId));
      setSelectedConnectionId(null);
    }
  }, [selectedNodeId, selectedConnectionId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input, textarea, or contentEditable
      if (
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLInputElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      if (e.key === 'Delete') {
        // If  delete if NOT in an active editor
        deleteSelected();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteSelected]);

  const addTextNode = () => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Center the new node on screen (approx)
    const x = (rect.width / 2 - offset.x - 100) / scale;
    const y = (rect.height / 2 - offset.y - 50) / scale;

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
    setSelectedNodeId(newNode.id);
  };

  const addFileNode = async () => {
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
        const x = (rect.width / 2 - offset.x - 150) / scale;
        const y = (rect.height / 2 - offset.y - 100) / scale;
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
        setSelectedNodeId(newNode.id);
      }
    } catch (err) {
      console.warn('File selection cancelled or failed:', err);
    }
  };

  const syncNodeFromDisk = async (nodeId: string) => {
    try {
      const handle = await FileStorage.getFileHandle(nodeId);
      let content: string | null = null;

      if (handle) {
        content = await FileNodeService.readFile(handle);
      } else {
        // No handle exists, prompt user to select file
        const [fileHandle] = await (window as any).showOpenFilePicker({
          types: [
            {
              description: 'Code Files',
              accept: {
                'text/*': ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.cpp', '.c', '.go', '.rs', '.css', '.html', '.json']
              }
            }
          ]
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
  };

  const requestWritePermission = async (nodeId: string) => {
    const handle = await FileStorage.getFileHandle(nodeId);
    if (!handle) return;

    const granted = await FileNodeService.verifyPermission(handle, true);
    if (granted) {
      setNodes(prev => prev.map(n =>
        n.id === nodeId ? { ...n, hasWritePermission: true, isEditing: true } : n
      ));
    }
  };

  const saveNodeToDisk = async (nodeId: string, content: string) => {
    const handle = await FileStorage.getFileHandle(nodeId);
    if (!handle) return;

    const success = await FileNodeService.saveFile(handle, content);
    if (success) {
      setNodes(prev => prev.map(n =>
        n.id === nodeId ? { ...n, isDirty: false } : n
      ));
    }
  };

  // Calculate handle offsets relative to node top-left
  // Calculate handle offsets relative to node top-left
  // Optimization: Scan the DOM instead of iterating the 'nodes' array to allow distinct stability.
  // Calculate handle offsets relative to node top-left
  // Optimization: specificNodeId allow for incremental updates instead of global scan
  const updateHandleOffsets = useCallback((specificNodeId?: string) => {
    // Strategy 1: Math-based (Fastest, no DOM read)
    if (specificNodeId) {
      const node = nodesMapRef.current.get(specificNodeId);
      if (node && node.width && node.height) {
        const handles = computeHandlePositions(0, 0, node.width, node.height);
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
      const nodeEl = document.getElementById(specificNodeId);
      if (!nodeEl) return;

      const nodeRect = nodeEl.getBoundingClientRect();
      const handles = nodeEl.querySelectorAll('[data-handle-id]');
      const newOffsets: Record<string, { x: number, y: number }> = {};

      handles.forEach(handle => {
        const handleId = handle.getAttribute('data-handle-id');
        if (!handleId) return;
        const handleRect = handle.getBoundingClientRect();
        newOffsets[`${specificNodeId}:${handleId}`] = {
          x: (handleRect.left + handleRect.width / 2 - nodeRect.left) / scaleRef.current,
          y: (handleRect.top + handleRect.height / 2 - nodeRect.top) / scaleRef.current
        };
      });

      setHandleOffsets(prev => ({ ...prev, ...newOffsets }));
      return;
    }

    // Strategy 3: Global DOM Scan (Fallback for init/zoom)
    const newOffsets: Record<string, { x: number, y: number }> = {};
    const nodeEls = document.querySelectorAll('.canvas-node');

    nodeEls.forEach(nodeEl => {
      const nodeId = nodeEl.id;
      if (!nodeId) return;

      // Try to use math first if we have data to avoid layout thrashing
      const node = nodesMapRef.current.get(nodeId);
      if (node && node.width && node.height) {
        const handles = computeHandlePositions(0, 0, node.width, node.height);
        Object.entries(handles).forEach(([hId, pos]) => {
          newOffsets[`${nodeId}:${hId}`] = pos;
        });
        return;
      }

      const nodeRect = nodeEl.getBoundingClientRect();
      const handles = nodeEl.querySelectorAll('[data-handle-id]');

      handles.forEach(handle => {
        const handleId = handle.getAttribute('data-handle-id');
        if (!handleId) return;

        const handleRect = handle.getBoundingClientRect();
        newOffsets[`${nodeId}:${handleId}`] = {
          x: (handleRect.left + handleRect.width / 2 - nodeRect.left) / scaleRef.current,
          y: (handleRect.top + handleRect.height / 2 - nodeRect.top) / scaleRef.current
        };
      });
    });
    setHandleOffsets(newOffsets);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    const isNode = !!target.closest('.canvas-node');
    const isHandle = !!target.closest('[data-handle-id]');
    const isConnection = !!target.closest('.connection-path');
    const isUI = !!target.closest('.main-toolbar') || !!target.closest('.canvas-controls') || !!target.closest('.glass-container') || !!target.closest('.top-right-controls');

    // Clear selections if clicking the empty canvas
    if (!isNode && !isHandle && !isConnection && !isUI) {
      setSelectedNodeId(null);
      setSelectedConnectionId(null);
    }

    const handle = target.closest('[data-handle-id]');
    if (handle) {
      e.stopPropagation();
      const nodeEl = target.closest('.canvas-node');
      const nodeId = nodeEl?.id;
      const handleId = handle.getAttribute('data-handle-id');

      if (nodeId && handleId) {
        const rect = viewportRef.current?.getBoundingClientRect();
        if (!rect) return;

        const hPos = getHandleCanvasPos(nodeId, handleId);
        setLinkingState({
          sourceNodeId: nodeId,
          sourceHandleId: handleId,
          targetX: hPos.x,
          targetY: hPos.y
        });
        return;
      }
    }

    if (e.button === 0 && !draggingNodeId.current) {
      setIsPanning(true);
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      try {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      } catch (err) { console.warn('Failed to capture pointer'); }
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (linkingState) {
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;

      setLinkingState(prev => prev ? ({
        ...prev,
        targetX: (e.clientX - rect.left - offsetRef.current.x) / scaleRef.current,
        targetY: (e.clientY - rect.top - offsetRef.current.y) / scaleRef.current
      }) : null);
      return;
    }

    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;

    if (isPanning) {
      offsetRef.current = { x: offsetRef.current.x + dx, y: offsetRef.current.y + dy };
      if (transformLayerRef.current) {
        transformLayerRef.current.style.transform = `translate(${offsetRef.current.x}px, ${offsetRef.current.y}px) scale(${scaleRef.current})`;
      }
    } else if (resizingNodeRef.current) {
      const { id, startX, startY, startW, startH } = resizingNodeRef.current;
      const dX = (e.clientX - startX) / scaleRef.current;
      const dY = (e.clientY - startY) / scaleRef.current;
      const newW = Math.max(200, startW + dX);
      const newH = Math.max(100, startH + dY);

      const el = document.getElementById(id);
      if (el) {
        el.style.width = `${newW}px`;
        el.style.height = `${newH}px`;
        // Since resize is transient, we don't update lines here yet as handle positions
        // will move with the node bounds. We'll update on PointerUp.
      }
    } else if (draggingNodeId.current) {
      const dX_canvas = dx / scaleRef.current;
      const dY_canvas = dy / scaleRef.current;

      const node = nodesMapRef.current.get(draggingNodeId.current);
      if (node) {
        node.x += dX_canvas;
        node.y += dY_canvas;
        const el = document.getElementById(node.id);
        if (el) {
          el.style.left = `${node.x}px`;
          el.style.top = `${node.y}px`;
        }
        updateSVGLinesForNode(node.id);
      }
    }
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (linkingState) {
      const target = e.target as HTMLElement;
      const handle = target.closest('[data-handle-id]');
      const targetNode = target.closest('.canvas-node');

      if (handle && targetNode && (targetNode.id !== linkingState.sourceNodeId || handle.getAttribute('data-handle-id') !== linkingState.sourceHandleId)) {
        const handleId = handle.getAttribute('data-handle-id')!;
        updateHandleOffsets(targetNode.id);

        const newConnection: Connection = {
          id: `conn-${Date.now()}`,
          source: { nodeId: linkingState.sourceNodeId, handleId: linkingState.sourceHandleId },
          target: { nodeId: targetNode.id, handleId: handleId },
          type: defaultLineType
        };
        setConnections(prev => [...prev, newConnection]);
      }
      setLinkingState(null);
    }

    if (isPanning) {
      setIsPanning(false);
      setOffset({ ...offsetRef.current });
    }

    if (draggingNodeId.current) {
      const id = draggingNodeId.current;
      draggingNodeId.current = null;
      setNodes(prev => prev.map(n => n.id === id ? { ...n, x: nodesMapRef.current.get(id)!.x, y: nodesMapRef.current.get(id)!.y } : n));
    }

    if (resizingNodeRef.current) {
      const id = resizingNodeRef.current.id;
      const el = document.getElementById(id);
      if (el) {
        const newW = el.offsetWidth;
        const newH = el.offsetHeight;
        setNodes(prev => prev.map(n => n.id === id ? { ...n, width: newW, height: newH } : n));
        updateHandleOffsets(id);
      }
      resizingNodeRef.current = null;
    }

    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (err) { }
  };

  const handleResizeStart = (id: string, e: React.PointerEvent) => {
    e.stopPropagation();
    const node = document.getElementById(id);
    if (!node) return;

    resizingNodeRef.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      startW: node.offsetWidth,
      startH: node.offsetHeight
    };

    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch (err) { }
  };



  const handleNodeDragStart = (id: string, e: React.PointerEvent) => {
    e.stopPropagation();
    draggingNodeId.current = id;
    setSelectedNodeId(id);
    setSelectedConnectionId(null); // Clear connection selection when a node is selected
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleContentChange = useCallback((id: string, content: string) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, content, isDirty: true } : n));
  }, []);

  const handleToggleEditing = useCallback((id: string, isEditing: boolean) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, isEditing } : n));
  }, []);

  const handlePointerDownNode = useCallback((id: string) => {
    setSelectedNodeId(id);
  }, []);

  // Sync Wrappers
  const handleSyncNode = useCallback((id: string) => syncNodeFromDisk(id), []);
  const handleRequestPermission = useCallback((id: string) => requestWritePermission(id), []);
  const handleSaveNode = useCallback((id: string, content: string) => saveNodeToDisk(id, content), []);

  const unlinkNode = (nodeId: string) => {
    setConnections(prev => prev.filter(c => c.source.nodeId !== nodeId && c.target.nodeId !== nodeId));
  };

  const updateConnectionStyle = (id: string, style: Partial<{ color: string, width: number }>) => {
    setConnections(prev => prev.map(c =>
      c.id === id ? { ...c, style: { ...c.style, ...style } } : c
    ));
  };

  const PASTEL_COLORS = [
    { name: 'Default', value: 'var(--accent-primary)' },
    { name: 'Pink', value: '#ffb7b2' },
    { name: 'Orange', value: '#ffdac1' },
    { name: 'Yellow', value: '#fff9b1' },
    { name: 'Green', value: '#baffc9' },
    { name: 'Blue', value: '#bae1ff' },
    { name: 'Purple', value: '#e0bbe4' },
  ];

  const THICKNESS_OPTIONS = [1, 2, 4, 6, 8];

  const resetTransform = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left - offset.x) / scale;
    const y = (e.clientY - rect.top - offset.y) / scale;

    // Use the new service to get file handles for persistent access
    const handles = await FileNodeService.getHandlesFromDataTransfer(e.dataTransfer);

    if (handles.length > 0) {
      const newNodes = await Promise.all(handles.map(async (handle, index) => {
        const nodeId = `node-${Date.now()}-${index}`;
        const content = await FileNodeService.readFile(handle) || '';

        // Save handle for later sync
        await FileStorage.saveFileHandle(nodeId, handle);

        return {
          id: nodeId,
          title: handle.name,
          type: 'file' as const,
          content,
          uri: `file://${handle.name}`,
          x: x + index * 20,
          y: y + index * 20,
          hasWritePermission: false, // Default to read-only
          isEditing: false
        };
      }));

      setNodes(prev => [...prev, ...newNodes]);
      return;
    }

    // Fallback for browsers without File System Access API or if handles couldn't be retrieved
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const newNodePromises = files.map((file, index) => {
        return new Promise<NodeData>((resolve) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            resolve({
              id: `node-${Date.now()}-${index}`,
              title: file.name,
              type: 'file',
              content: event.target?.result as string || '',
              uri: `file://${file.name}`,
              x: x + index * 20,
              y: y + index * 20,
            });
          };
          reader.readAsText(file);
        });
      });

      const newNodes = await Promise.all(newNodePromises);
      setNodes(prev => [...prev, ...newNodes]);
    }
  };



  // Removed complex polling/global Prism logic as it's now handled by CanvasNode locally



  // Touch Handlers for Pinch Zoom
  // Touch Handlers for Pinch Zoom attached via Ref for passive: false support
  React.useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.stopPropagation();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        lastTouchDistance.current = dist;
        initialPinchCenter.current = {
          x: (t1.clientX + t2.clientX) / 2,
          y: (t1.clientY + t2.clientY) / 2
        };
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && lastTouchDistance.current) {
        // Critical: This prevents browser zoom
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();

        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        const center = {
          x: (t1.clientX + t2.clientX) / 2,
          y: (t1.clientY + t2.clientY) / 2
        };

        const scaleRatio = dist / lastTouchDistance.current;

        // We need to use functional state updates or refs for state variables to avoid stale closures
        // Since we are inside useEffect with dependencies, we can use current state, 
        // BUT we need to be careful about the dependency array potentially resetting listeners too often.
        // Ideally, we'd use refs for scale/offset, but that requires a bigger refactor.
        // For now, we will add [scale, offset] to the effect deps, which is acceptable 
        // (listeners re-attach on frame updates, might be slight perf hit but functional).

        setScale(prevScale => {
          const newScale = Math.min(Math.max(prevScale * scaleRatio, 0.1), 5);

          setOffset(prevOffset => {
            const rect = el.getBoundingClientRect();
            const cx = center.x - rect.left;
            const cy = center.y - rect.top;

            // We need the "effective" scale before this update? 
            // Actually, simplified math:
            // NewOffset = P - (P - OldOffset) * (NewScale / OldScale)

            const newOffsetX = cx - (cx - prevOffset.x) * (newScale / prevScale);
            const newOffsetY = cy - (cy - prevOffset.y) * (newScale / prevScale);
            return { x: newOffsetX, y: newOffsetY };
          });

          return newScale;
        });

        lastTouchDistance.current = dist;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        lastTouchDistance.current = null;
        initialPinchCenter.current = null;
      }
    };

    const handleWheel = (e: WheelEvent) => {
      // Prevent browser zoom (Ctrl + Wheel)
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();

        const delta = -e.deltaY;
        // Use functional state to avoid stale closures
        setScale(prevScale => {
          const factor = Math.pow(1.1, delta / 100);
          const newScale = Math.min(Math.max(prevScale * factor, 0.1), 5);

          setOffset(prevOffset => {
            const rect = el.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // Calculate offset based on current (previous) scale state
            const newOffsetX = mouseX - (mouseX - prevOffset.x) * (newScale / prevScale);
            const newOffsetY = mouseY - (mouseY - prevOffset.y) * (newScale / prevScale);
            return { x: newOffsetX, y: newOffsetY };
          });
          return newScale;
        });
      } else {
        // Panning (Standard Wheel)
        // Note: We don't preventDefault here by default to allow node content scrolling.
        // But if we want to force canvas pan, we can.
        // Behavior: If e.target is canvas, pan. If inside node, bubbling might occur.
        // For consistent "like native" feel, we only pan if the event wasn't consumed?
        // Simpler approach: Always pan canvas, but rely on browser to handle scrollable children first?
        // Actually, since we are using offset/translate, we are doing virtual scrolling.
        // We should just update offset.

        // Check if we are over a scrollable element?
        // For now, simple implementation:
        setOffset(prev => ({
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY
        }));
      }
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: false });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd);
    el.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('wheel', handleWheel);
    };
  }, [scale, offset]);

  return (
    <div
      className="canvas-viewport"
      ref={viewportRef}
      style={{ '--grid-opacity': backgroundOpacity * 0.1 } as any}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div
        className="canvas-transform-layer"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`
        }}
      >
        <div className="canvas-background-container" style={{ pointerEvents: 'none' }}>
          <div className={`canvas-background ${backgroundPattern}`} />
        </div>

        {nodes.map(node => (
          <CanvasNode
            key={node.id}
            node={node}
            isSelected={selectedNodeId === node.id}
            onPointerDown={handlePointerDownNode}
            onHeaderPointerDown={handleNodeDragStart}
            onResizePointerDown={handleResizeStart}
            onContentChange={handleContentChange}
            onToggleEditing={handleToggleEditing}
            onSync={handleSyncNode}
            onRequestPermission={handleRequestPermission}
            onSave={handleSaveNode}
            updateHandleOffsets={updateHandleOffsets}
          />
        ))}

        <svg className="canvas-svg-layer" viewBox="-50000 -50000 100000 100000">
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="var(--accent-primary)" />
            </marker>
            <marker
              id="arrowhead-start"
              markerWidth="10"
              markerHeight="7"
              refX="1"
              refY="3.5"
              orient="auto-start-reverse"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="var(--accent-primary)" />
            </marker>
          </defs>

          {/* Connection Lines */}
          {connections.map(conn => {
            const start = getHandleCanvasPos(conn.source.nodeId, conn.source.handleId);
            const end = getHandleCanvasPos(conn.target.nodeId, conn.target.handleId);
            return (
              <ConnectionLine
                key={conn.id}
                conn={conn}
                isSelected={selectedConnectionId === conn.id}
                startX={start.x}
                startY={start.y}
                endX={end.x}
                endY={end.y}
                onSelect={(id) => {
                  setSelectedConnectionId(id);
                  setSelectedNodeId(null);
                }}
              />
            );
          })}

          {/* Temporary/Linking Line */}
          {linkingState && (() => {
            const start = getHandleCanvasPos(linkingState.sourceNodeId, linkingState.sourceHandleId);
            return (
              <path
                d={getPathData(start.x, start.y, linkingState.targetX, linkingState.targetY)}
                className="temp-connection"
              />
            );
          })()}
        </svg>
      </div>

      <div className={`sidebar-container ${!isSidebarOpen ? 'sidebar-collapsed' : ''}`}>
        <div className="sidebar" onPointerDown={(e) => e.stopPropagation()}>
          <div className="sidebar-header">
            <div className="sidebar-title">
              <i className="bi bi-stack"></i>
              CodeCanvas
            </div>
            <button className="toolbar-btn" onClick={() => setIsSidebarOpen(false)}>
              <i className="bi bi-chevron-left"></i>
            </button>
          </div>

          <div className="project-list-container">
            <div className="settings-label" style={{ paddingLeft: 0, marginBottom: '12px' }}>Your Canvases</div>
            {manifest.map(p => (
              <div
                key={p.id}
                className={`sidebar-project-item ${p.id === currentProjectId ? 'active' : ''}`}
                onClick={() => {
                  setCurrentProjectId(p.id);
                  localStorage.setItem(STORAGE_KEYS.CURRENT_PROJECT_ID, p.id);
                }}
              >
                {editingProjectId === p.id ? (
                  <input
                    autoFocus
                    value={p.name}
                    onChange={(e) => {
                      const newName = e.target.value;
                      setManifest(prev => {
                        const updated = prev.map(m => m.id === p.id ? { ...m, name: newName } : m);
                        localStorage.setItem(STORAGE_KEYS.MANIFEST, JSON.stringify(updated));
                        return updated;
                      });
                    }}
                    onBlur={() => setEditingProjectId(null)}
                    onKeyDown={(e) => e.key === 'Enter' && setEditingProjectId(null)}
                  />
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="project-item-name">{p.name}</div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        className="toolbar-btn"
                        style={{ width: '24px', height: '24px', fontSize: '0.8rem' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingProjectId(p.id);
                        }}
                        title="Rename Canvas"
                      >
                        <i className="bi bi-pencil"></i>
                      </button>
                      <button
                        className="toolbar-btn danger"
                        style={{ width: '24px', height: '24px', fontSize: '0.8rem' }}
                        onClick={async (e) => {
                          e.stopPropagation();

                          // Prevent deleting the last canvas
                          if (manifest.length <= 1) {
                            alert('Cannot delete the last canvas. Create a new one first!');
                            return;
                          }

                          // Confirm deletion
                          if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) {
                            return;
                          }

                          // If deleting the current project, switch to another one first
                          if (p.id === currentProjectId) {
                            const otherProject = manifest.find(m => m.id !== p.id);
                            if (otherProject) {
                              setCurrentProjectId(otherProject.id);
                              localStorage.setItem(STORAGE_KEYS.CURRENT_PROJECT_ID, otherProject.id);
                            }
                          }

                          // Delete from storage
                          await ProjectStorage.deleteProject(p.id);
                          localStorage.removeItem(`${STORAGE_KEYS.PROPS_PREFIX}${p.id}`);

                          // Remove from manifest
                          const updatedManifest = manifest.filter(m => m.id !== p.id);
                          setManifest(updatedManifest);
                          localStorage.setItem(STORAGE_KEYS.MANIFEST, JSON.stringify(updatedManifest));
                        }}
                        title="Delete Canvas"
                      >
                        <i className="bi bi-trash"></i>
                      </button>
                    </div>
                  </div>
                )}
                <div className="project-item-meta">
                  <i className="bi bi-clock-history"></i>
                  {new Date(p.lastModified).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>

          <button
            className="create-project-btn"
            onClick={async () => {
              const newId = `project-${Date.now()}`;
              const newProject = { id: newId, name: 'Untitled Canvas', lastModified: new Date().toISOString() };

              // Initialize EMPTY storage for the new project FIRST
              const initialProps: CanvasProperties = {
                backgroundPattern: 'grid',
                backgroundOpacity: 0.7,
                theme: 'dark',
                syntaxTheme: 'classic',
                transform: { scale: 1, offset: { x: 0, y: 0 } }
              };
              localStorage.setItem(`${STORAGE_KEYS.PROPS_PREFIX}${newId}`, JSON.stringify(initialProps));

              // Initialize empty objects in IndexedDB
              await ProjectStorage.saveProjectObjects(newId, [], []);

              // Update manifest
              const newManifest = [...manifest, newProject];
              setManifest(newManifest);
              localStorage.setItem(STORAGE_KEYS.MANIFEST, JSON.stringify(newManifest));

              // NOW switch to the new project
              setCurrentProjectId(newId);
              localStorage.setItem(STORAGE_KEYS.CURRENT_PROJECT_ID, newId);
              setEditingProjectId(newId);
            }}
          >
            <i className="bi bi-plus-lg"></i>
            New Canvas
          </button>
        </div>

        {!isSidebarOpen && (
          <div className="sidebar-tab" onClick={() => setIsSidebarOpen(true)}>
            <i className="bi bi-layout-sidebar-inset"></i>
          </div>
        )}
      </div>



      <div className="canvas-controls">
        <button className="control-btn" onClick={() => setScale((s: number) => Math.min(s + 0.1, 5))}>+</button>
        <button className="control-btn" onClick={() => setScale((s: number) => Math.max(s - 0.1, 0.1))}>−</button>
        <button className="control-btn" onClick={resetTransform}>⟲</button>
      </div>
      {!isSidebarOpen && (
        <div className="glass-container" style={{
          position: 'fixed',
          top: '24px',
          left: '60px',
          padding: '12px 20px',
          color: '#a78bfa',
          fontSize: '0.875rem',
          fontWeight: 500,
          pointerEvents: 'none',
          zIndex: 100
        }}>
          {manifest.find(m => m.id === currentProjectId)?.name} • {Math.round(scale * 100)}%
        </div>
      )}

      {/* Main Toolbar */}
      <div className="main-toolbar">
        <button className="toolbar-btn primary" onClick={addTextNode} title="Add Text Note">
          <i className="bi bi-plus-lg"></i>
        </button>
        <div className="toolbar-divider"></div>
        <button className="toolbar-btn" onClick={addFileNode} title="Add File">
          <i className="bi bi-file-earmark-plus"></i>
        </button>

        <div className="toolbar-divider"></div>
        <div className="toolbar-group">
          <button
            className={`toolbar-btn ${defaultLineType === 'line' ? 'active' : ''}`}
            onClick={() => setDefaultLineType('line')}
            title="Non-directional Line"
          >
            <i className="bi bi-dash"></i>
          </button>
          <button
            className={`toolbar-btn ${defaultLineType === 'arrow' ? 'active' : ''}`}
            onClick={() => setDefaultLineType('arrow')}
            title="Single Arrow"
          >
            <i className="bi bi-arrow-right"></i>
          </button>
          <button
            className={`toolbar-btn ${defaultLineType === 'bi-arrow' ? 'active' : ''}`}
            onClick={() => setDefaultLineType('bi-arrow')}
            title="Bi-directional Arrow"
          >
            <i className="bi bi-arrow-left-right"></i>
          </button>
        </div>

        {selectedConnectionId && (
          <>
            <div className="toolbar-divider"></div>
            <div className="toolbar-group">
              {PASTEL_COLORS.map(color => (
                <button
                  key={color.value}
                  className="color-swatch-btn"
                  style={{ backgroundColor: color.value === 'var(--accent-primary)' ? '#8b5cf6' : color.value }}
                  onClick={() => updateConnectionStyle(selectedConnectionId, { color: color.value })}
                  title={color.name}
                />
              ))}
            </div>
            <div className="toolbar-divider"></div>
            <div className="toolbar-group">
              <i className="bi bi-border-width" style={{ color: '#94a3b8', marginRight: '8px' }}></i>
              <select
                className="toolbar-select"
                onChange={(e) => updateConnectionStyle(selectedConnectionId, { width: Number(e.target.value) })}
                value={connections.find(c => c.id === selectedConnectionId)?.style?.width || 2}
              >
                {THICKNESS_OPTIONS.map(w => (
                  <option key={w} value={w}>{w}px</option>
                ))}
              </select>
            </div>
          </>
        )}

        {(selectedNodeId || selectedConnectionId) && (
          <>
            <div className="toolbar-divider"></div>
            {selectedNodeId && (
              <button className="toolbar-btn" onClick={() => unlinkNode(selectedNodeId)} title="Unlink All Connections">
                <i className="bi bi-scissors"></i>
              </button>
            )}
            <button className="toolbar-btn danger" onClick={deleteSelected} title="Delete Selected">
              <i className="bi bi-trash"></i>
            </button>
          </>
        )}

        <div className="toolbar-divider"></div>
        <button className="toolbar-btn" title="Connection Settings">
          <i className="bi bi-share"></i>
        </button>
      </div>

      <div className="top-right-controls" onPointerDown={(e) => e.stopPropagation()} style={{ pointerEvents: 'auto' }}>
        <button
          className={`control-btn ${showSettings ? 'active' : ''}`}
          onClick={() => setShowSettings(!showSettings)}
          title="Settings"
          style={{ pointerEvents: 'auto' }}
        >
          <i className={`bi ${showSettings ? 'bi-gear-fill' : 'bi-gear'}`}></i>
        </button>

        {showSettings && (
          <div className="settings-menu">
            <div className="settings-group">
              <div className="settings-label">Background Pattern</div>
              <div className="settings-row">
                <button
                  className={`settings-item compact ${backgroundPattern === 'grid' ? 'active' : ''}`}
                  onClick={() => setBackgroundPattern('grid')}
                >
                  <i className="bi bi-grid-3x3"></i>
                  Grid
                </button>
                <button
                  className={`settings-item compact ${backgroundPattern === 'dots' ? 'active' : ''}`}
                  onClick={() => setBackgroundPattern('dots')}
                >
                  <i className="bi bi-dot"></i>
                  Dots
                </button>
                <button
                  className={`settings-item compact ${backgroundPattern === 'lines' ? 'active' : ''}`}
                  onClick={() => setBackgroundPattern('lines')}
                >
                  <i className="bi bi-distribute-vertical"></i>
                  Lines
                </button>
              </div>
            </div>

            <div className="settings-group">
              <div className="settings-label">Transparency</div>
              <div className="settings-slider-container">
                <input
                  type="range"
                  className="settings-slider"
                  min="0"
                  max="1.4"
                  step="0.01"
                  value={backgroundOpacity}
                  onChange={(e) => setBackgroundOpacity(parseFloat(e.target.value))}
                  onPointerDown={(e) => e.stopPropagation()}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#64748b' }}>
                  <span>Min</span>
                  <span>{Math.round(backgroundOpacity * 100 / 1.4)}%</span>
                  <span>Max</span>
                </div>
              </div>
            </div>

            <div className="toolbar-divider" style={{ margin: '4px 0', width: '100%', height: '1px' }}></div>

            <div className="settings-group">
              <div className="settings-label">Appearance</div>
              <div className="settings-row">
                <button
                  className={`settings-item compact ${theme === 'light' ? 'active' : ''}`}
                  onClick={() => setTheme('light')}
                >
                  <i className="bi bi-sun"></i>
                  Light
                </button>
                <button
                  className={`settings-item compact ${theme === 'dark' ? 'active' : ''}`}
                  onClick={() => setTheme('dark')}
                >
                  <i className="bi bi-moon-stars"></i>
                  Dark
                </button>
                <button
                  className={`settings-item compact ${theme === 'paper' ? 'active' : ''}`}
                  onClick={() => setTheme('paper')}
                >
                  <i className="bi bi-journal-text"></i>
                  Paper
                </button>
              </div>
            </div>

            <div className="toolbar-divider" style={{ margin: '4px 0', width: '100%', height: '1px' }}></div>

            <div className="settings-group">
              <div className="settings-label">Syntax Theme</div>
              <div className="settings-row" style={{ flexWrap: 'wrap' }}>
                <button
                  className={`settings-item compact ${syntaxTheme === 'classic' ? 'active' : ''}`}
                  onClick={() => setSyntaxTheme('classic')}
                  title="Classic CodeCanvas"
                >
                  <div className="theme-preview" style={{ background: '#ff79c6', width: '12px', height: '12px', borderRadius: '2px' }}></div>
                  Classic
                </button>
                <button
                  className={`settings-item compact ${syntaxTheme === 'monokai' ? 'active' : ''}`}
                  onClick={() => setSyntaxTheme('monokai')}
                  title="Vibrant Monokai"
                >
                  <div className="theme-preview" style={{ background: '#f92672', width: '12px', height: '12px', borderRadius: '2px' }}></div>
                  Monokai
                </button>
                <button
                  className={`settings-item compact ${syntaxTheme === 'nord' ? 'active' : ''}`}
                  onClick={() => setSyntaxTheme('nord')}
                  title="Arctic Nord"
                >
                  <div className="theme-preview" style={{ background: '#81a1c1', width: '12px', height: '12px', borderRadius: '2px' }}></div>
                  Nord
                </button>
                <button
                  className={`settings-item compact ${syntaxTheme === 'solarized' ? 'active' : ''}`}
                  onClick={() => setSyntaxTheme('solarized')}
                  title="Solarized Contrast"
                >
                  <div className="theme-preview" style={{ background: '#859900', width: '12px', height: '12px', borderRadius: '2px' }}></div>
                  Solarized
                </button>
                <button
                  className={`settings-item compact ${syntaxTheme === 'ink' ? 'active' : ''}`}
                  onClick={() => setSyntaxTheme('ink')}
                  title="Ink-on-Paper"
                >
                  <div className="theme-preview" style={{ background: '#433422', width: '12px', height: '12px', borderRadius: '2px' }}></div>
                  Ink
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div >
  );
}

export default App;
