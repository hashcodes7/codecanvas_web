import React, { useState, useRef } from 'react';
import './index.css';

interface NodeData {
  id: string;
  title: string;
  type: 'file' | 'code';
  content?: string;
  uri?: string;
  x: number;
  y: number;
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

function App() {
  const [nodes, setNodes] = useState<NodeData[]>(INITIAL_NODES);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [linkingState, setLinkingState] = useState<{
    sourceNodeId: string;
    sourceHandleId: string;
    targetX: number;
    targetY: number;
  } | null>(null);

  const [handleOffsets, setHandleOffsets] = useState<Record<string, { x: number, y: number }>>({});

  const viewportRef = useRef<HTMLDivElement>(null);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const draggingNodeId = useRef<string | null>(null);

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
            }}
            onPointerDown={() => setSelectedNodeId(node.id)}
          >
            <div
              className="node-header"
              onPointerDown={(e) => handleNodeDragStart(node.id, e)}
            >
              <div className="node-title-container">
                {node.type === 'file' && <i className="bi bi-file-earmark-code" style={{ marginRight: '8px', color: '#a78bfa' }}></i>}
                <span className="node-title">{node.title}</span>
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ff5f56' }} />
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ffbd2e' }} />
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#27c93f' }} />
              </div>
            </div>
            <div className="node-content">
              <div style={{ display: 'flex' }}>
                <div className="line-numbers">
                  {node.content?.split('\n').map((_, i) => (
                    <span key={i}>{i + 1}</span>
                  ))}
                </div>
                <pre className={`code-editor language-${getLanguageFromFilename(node.title)}`}>
                  <code className={`language-${getLanguageFromFilename(node.title)}`}>
                    {node.content}
                  </code>
                </pre>
              </div>
              {node.type === 'file' && (
                <div className="uri-footer">
                  <i className="bi bi-link-45deg"></i>
                  {node.uri}
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
        <button className="control-btn" onClick={() => setScale(s => Math.min(s + 0.1, 5))}>+</button>
        <button className="control-btn" onClick={() => setScale(s => Math.max(s - 0.1, 0.1))}>−</button>
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
        pointerEvents: 'none'
      }}>
        CodeCanvas Web Prototype • {Math.round(scale * 100)}%
      </div>
    </div>
  );
}

export default App;
