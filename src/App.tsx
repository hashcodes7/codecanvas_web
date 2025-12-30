import React, { useState, useRef, useEffect } from 'react';
import './index.css';
import { FileStorage } from './storage';
import { FileNodeService } from './FileNodeService';

interface NodeData {
  id: string;
  title: string;
  type: 'file' | 'code' | 'text';
  content?: string;
  uri?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  isEditing?: boolean;
  hasWritePermission?: boolean;
}

const INITIAL_NODES: NodeData[] = [

];

interface Connection {
  id: string;
  source: { nodeId: string; handleId: string };
  target: { nodeId: string; handleId: string };
  type: 'line' | 'arrow' | 'bi-arrow';
  style?: {
    color?: string;
    width?: number;
  };
}

const STORAGE_KEYS = {
  NODES: 'codecanvas-nodes',
  CONNECTIONS: 'codecanvas-connections',
  TRANSFORM: 'codecanvas-transform'
};

function App() {
  // Initialize state from local storage or defaults
  const [nodes, setNodes] = useState<NodeData[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.NODES);
    return saved ? JSON.parse(saved) : INITIAL_NODES;
  });

  const [connections, setConnections] = useState<Connection[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CONNECTIONS);
    return saved ? JSON.parse(saved) : [];
  });

  const [scale, setScale] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.TRANSFORM);
    const parsed = saved ? JSON.parse(saved) : null;
    return parsed ? parsed.scale : 1;
  });

  const [offset, setOffset] = useState<{ x: number, y: number }>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.TRANSFORM);
    const parsed = saved ? JSON.parse(saved) : null;
    return parsed ? parsed.offset : { x: 0, y: 0 };
  });

  const [isPanning, setIsPanning] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [linkingState, setLinkingState] = useState<{
    sourceNodeId: string;
    sourceHandleId: string;
    targetX: number;
    targetY: number;
  } | null>(null);

  const [handleOffsets, setHandleOffsets] = useState<Record<string, { x: number, y: number }>>({});
  const [loadingContent, setLoadingContent] = useState(true);

  const viewportRef = useRef<HTMLDivElement>(null);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const draggingNodeId = useRef<string | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);

  // Load file contents from IndexedDB on mount
  useEffect(() => {
    const loadContents = async () => {
      const updatedNodes = await Promise.all(
        nodes.map(async (node) => {
          if (node.type === 'file' && !node.content) {
            const content = await FileStorage.getFileContent(node.id);
            if (content) {
              return { ...node, content };
            }
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
          if ((node.type === 'file' || node.type === 'text') && node.content) {
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

      // Clean nodes for localStorage: remove content from file type nodes
      const persistentNodes = nodes.map(node => {
        if (node.type === 'file') {
          const { content, ...rest } = node;
          return rest;
        }
        return node;
      });

      localStorage.setItem(STORAGE_KEYS.NODES, JSON.stringify(persistentNodes));
      localStorage.setItem(STORAGE_KEYS.CONNECTIONS, JSON.stringify(connections));
      localStorage.setItem(STORAGE_KEYS.TRANSFORM, JSON.stringify({ scale, offset }));
    }, 500);

    return () => {
      if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    };
  }, [nodes, connections, scale, offset, loadingContent]);

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
  const updateHandleOffsets = () => {
    const newOffsets: Record<string, { x: number, y: number }> = {};
    nodes.forEach(node => {
      const nodeEl = document.getElementById(node.id);
      if (!nodeEl) return;

      const nodeRect = nodeEl.getBoundingClientRect();
      const handles = nodeEl.querySelectorAll('[data-handle-id]');

      handles.forEach(handle => {
        const handleId = handle.getAttribute('data-handle-id');
        if (!handleId) return;

        const handleRect = handle.getBoundingClientRect();
        newOffsets[`${node.id}:${handleId}`] = {
          x: (handleRect.left + handleRect.width / 2 - nodeRect.left) / scale,
          y: (handleRect.top + handleRect.height / 2 - nodeRect.top) / scale
        };
      });
    });
    setHandleOffsets(newOffsets);
  };

  // Helper to get actual canvas coordinates for a handle
  const getHandleCanvasPos = (nodeId: string, handleId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    const offset = handleOffsets[`${nodeId}:${handleId}`];

    if (!node || !offset) {
      // Fallback if not cached yet
      return { x: (node?.x || 0) + 150, y: (node?.y || 0) + 100 };
    }

    return {
      x: node.x + offset.x,
      y: node.y + offset.y
    };
  };


  // Zoom logic
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = -e.deltaY;
      const factor = Math.pow(1.1, delta / 100);

      const newScale = Math.min(Math.max(scale * factor, 0.1), 5);

      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const newOffsetX = mouseX - (mouseX - offset.x) * (newScale / scale);
      const newOffsetY = mouseY - (mouseY - offset.y) * (newScale / scale);

      setScale(newScale);
      setOffset({ x: newOffsetX, y: newOffsetY });
    } else {
      setOffset(prev => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY
      }));
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    const handle = target.closest('[data-handle-id]');

    if (handle) {
      e.stopPropagation();
      const nodeEl = target.closest('.canvas-node');
      const nodeId = nodeEl?.id;
      const handleId = handle.getAttribute('data-handle-id');

      if (nodeId && handleId) {
        const rect = viewportRef.current?.getBoundingClientRect();
        if (!rect) return;

        // Use live pos for starting link
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
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (linkingState) {
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;

      setLinkingState(prev => prev ? ({
        ...prev,
        targetX: (e.clientX - rect.left - offset.x) / scale,
        targetY: (e.clientY - rect.top - offset.y) / scale
      }) : null);
      return;
    }

    if (isPanning) {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    } else if (draggingNodeId.current) {
      const dx = (e.clientX - lastMousePos.current.x) / scale;
      const dy = (e.clientY - lastMousePos.current.y) / scale;

      setNodes(prev => prev.map(node =>
        node.id === draggingNodeId.current
          ? { ...node, x: node.x + dx, y: node.y + dy }
          : node
      ));
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (linkingState) {
      const target = e.target as HTMLElement;
      const handle = target.closest('[data-handle-id]');
      const targetNode = target.closest('.canvas-node');

      if (handle && targetNode && (targetNode.id !== linkingState.sourceNodeId || handle.getAttribute('data-handle-id') !== linkingState.sourceHandleId)) {
        const handleId = handle.getAttribute('data-handle-id')!;

        // Update offsets specifically for this new target node to ensure connection is accurate
        updateHandleOffsets();

        const newConnection: Connection = {
          id: `conn-${Date.now()}`,
          source: { nodeId: linkingState.sourceNodeId, handleId: linkingState.sourceHandleId },
          target: { nodeId: targetNode.id, handleId: handleId },
          type: 'arrow'
        };
        setConnections(prev => [...prev, newConnection]);
      }
      setLinkingState(null);
    }

    setIsPanning(false);
    draggingNodeId.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (err) { }
  };

  const handleNodeDragStart = (id: string, e: React.PointerEvent) => {
    e.stopPropagation();
    draggingNodeId.current = id;
    setSelectedNodeId(id);
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

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

  const getLanguageFromFilename = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts': return 'typescript';
      case 'tsx': return 'tsx';
      case 'js':
      case 'jsx': return 'javascript';
      case 'html': return 'markup';
      case 'css': return 'css';
      case 'json': return 'json';
      case 'py': return 'python';
      case ' rust':
      case 'rs': return 'rust';
      case 'go': return 'go';
      case 'java': return 'java';
      case 'cpp':
      case 'c': return 'cpp';
      default: return 'javascript';
    }
  };

  const activateSymbols = (editorElement: HTMLElement) => {
    const tokens = editorElement.querySelectorAll('.token');
    tokens.forEach((token: any, index) => {
      const name = token.innerText.trim();
      if (!name) return;
      if (/^[\(\)\[\]\{\}:;,.\/\|\s\\!?"']+$/.test(name)) return;
      token.dataset.handleId = `token-${name}-${index}`;
    });
  };

  const addGenericHandlesToCode = (editorElement: HTMLElement) => {
    const walker = document.createTreeWalker(editorElement, NodeFilter.SHOW_TEXT, null);
    const nodesToReplace: Text[] = [];
    let textNode;
    while (textNode = walker.nextNode() as Text) {
      if (!textNode.parentElement?.closest('[data-handle-id]') && textNode.textContent?.trim()) {
        nodesToReplace.push(textNode);
      }
    }

    const tokenRegex = /(https?:\/\/[^\s\(\)\[\]\{\}:;,"'<>]+)|([\(\)\[\]\{\}:;,.\/\|\s\\!?"']+)|([^\(\)\[\]\{\}:;,.\/\|\s\\!?"']+)/gi;

    nodesToReplace.forEach((textNode, textNodeIndex) => {
      const content = textNode.textContent || '';
      const container = document.createElement('span');
      let html = '';

      let match;
      tokenRegex.lastIndex = 0;
      let tokenIndex = 0;

      while ((match = tokenRegex.exec(content)) !== null) {
        const [_, url, sep, word] = match;
        if (url) {
          html += `<span class="word-handle" data-handle-id="url-${textNodeIndex}-${tokenIndex}">${url}</span>`;
        } else if (sep) {
          html += sep;
        } else if (word) {
          html += `<span class="word-handle" data-handle-id="word-${word}-${textNodeIndex}-${tokenIndex}">${word}</span>`;
        }
        tokenIndex++;
      }

      if (html) {
        container.innerHTML = html;
        const fragment = document.createDocumentFragment();
        while (container.firstChild) {
          fragment.appendChild(container.firstChild);
        }
        textNode.replaceWith(fragment);
      }
    });
  };

  React.useEffect(() => {
    if ((window as any).Prism) {
      (window as any).Prism.highlightAll();
      setTimeout(() => {
        document.querySelectorAll('.code-editor').forEach((editor: any) => {
          activateSymbols(editor);
          addGenericHandlesToCode(editor);
        });
        updateHandleOffsets();
      }, 50);
    }
  }, [nodes]);

  // Helper to calculate a path between two points with automatic arrowhead alignment
  const getPathData = (x1: number, y1: number, x2: number, y2: number) => {
    const dx = x2 - x1;
    const dy = y2 - y1;

    // Improved Bezier routing:
    // If nodes are far horizontally, emphasize horizontal flow.
    // If vertical offset is high, allow more vertical curvature to fix arrow alignment.
    const curvature = 0.5;
    const vBias = Math.abs(dy) > Math.abs(dx) ? 0.2 : 0;

    const cx1 = x1 + dx * curvature;
    const cy1 = y1 + dy * vBias;
    const cx2 = x2 - dx * curvature;
    const cy2 = y2 - dy * vBias;

    return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
  };

  return (
    <div
      className="canvas-viewport"
      ref={viewportRef}
      onWheel={handleWheel}
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
        <div className="canvas-background" />

        {nodes.map(node => (
          <div
            key={node.id}
            id={node.id}
            className={`canvas-node ${selectedNodeId === node.id ? 'selected' : ''} ${node.type}-node`}
            style={{
              left: node.x,
              top: node.y,
              width: node.width,
              height: node.height
            }}
            onPointerDown={() => setSelectedNodeId(node.id)}
          >
            <div
              className="node-header"
              onPointerDown={(e) => handleNodeDragStart(node.id, e)}
            >
              <div className="node-title-container">
                {node.type === 'file' && <i className="bi bi-file-earmark-code" style={{ marginRight: '8px', color: '#a78bfa' }}></i>}
                {node.type === 'text' && <i className="bi bi-sticky" style={{ marginRight: '8px', color: '#fcd34d' }}></i>}
                <span className="node-title">{node.title}</span>
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ff5f56' }} />
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ffbd2e' }} />
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#27c93f' }} />
              </div>
            </div>
            <div className="node-content">
              {node.type === 'text' ? (
                <textarea
                  className="text-node-input"
                  placeholder="Type something..."
                  value={node.content}
                  onChange={(e) => {
                    setNodes(prev => prev.map(n =>
                      n.id === node.id ? { ...n, content: e.target.value } : n
                    ));
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                />
              ) : (
                <div style={{ display: 'flex' }}>
                  {node.content ? (
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
                          onChange={(e) => {
                            setNodes(prev => prev.map(n =>
                              n.id === node.id ? { ...n, content: e.target.value } : n
                            ));
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                          autoFocus
                        />
                      ) : (
                        <pre className={`code-editor language-${getLanguageFromFilename(node.title)}`}>
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
                  {node.uri}
                  <button
                    className="sync-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      syncNodeFromDisk(node.id);
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
                        requestWritePermission(node.id);
                      }}
                      title="Request Edit Permission"
                      style={{ marginLeft: '4px', color: '#6b7280' }}
                    >
                      <i className="bi bi-pencil"></i>
                    </button>
                  ) : (
                    <button
                      className="sync-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        saveNodeToDisk(node.id, node.content || '');
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
          </div>
        ))}

        <svg className="canvas-svg-layer">
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
          </defs>

          {/* Connection Lines */}
          {connections.map(conn => {
            const start = getHandleCanvasPos(conn.source.nodeId, conn.source.handleId);
            const end = getHandleCanvasPos(conn.target.nodeId, conn.target.handleId);
            return (
              <path
                key={conn.id}
                d={getPathData(start.x, start.y, end.x, end.y)}
                className="connection-path"
                markerEnd={conn.type === 'arrow' || conn.type === 'bi-arrow' ? "url(#arrowhead)" : ""}
                markerStart={conn.type === 'bi-arrow' ? "url(#arrowhead)" : ""}
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

      <div className="canvas-controls">
        <button className="control-btn" onClick={() => setScale((s: number) => Math.min(s + 0.1, 5))}>+</button>
        <button className="control-btn" onClick={() => setScale((s: number) => Math.max(s - 0.1, 0.1))}>−</button>
        <button className="control-btn" onClick={resetTransform}>⟲</button>
      </div>

      <div className="glass-container" style={{
        position: 'fixed',
        top: '24px',
        left: '24px',
        padding: '12px 20px',
        color: '#a78bfa',
        fontSize: '0.875rem',
        fontWeight: 500,
        pointerEvents: 'none',
        zIndex: 100
      }}>
        CodeCanvas Web Prototype • {Math.round(scale * 100)}%
      </div>

      {/* Main Toolbar */}
      <div className="main-toolbar">
        <button className="toolbar-btn primary" onClick={addTextNode} title="Add Text Note">
          <i className="bi bi-plus-lg"></i>
        </button>
        <div className="toolbar-divider"></div>
        <button className="toolbar-btn" title="Add File (Coming Soon)">
          <i className="bi bi-file-earmark-plus"></i>
        </button>
        <button className="toolbar-btn" title="Connection Settings">
          <i className="bi bi-share"></i>
        </button>
      </div>
    </div>
  );
}

export default App;
