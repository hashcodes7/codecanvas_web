import React, { useState, useRef } from 'react';
import './index.css';

interface NodeData {
  id: string;
  title: string;
  content: string;
  x: number;
  y: number;
}

const INITIAL_NODES: NodeData[] = [
  {
    id: '1',
    title: 'Main.tsx',
    content: 'import React from "react";\nimport ReactDOM from "react-dom";\n\nReactDOM.render(<App />, document.getElementById("root"));',
    x: 100,
    y: 100,
  },
  {
    id: '2',
    title: 'App.tsx',
    content: 'function App() {\n  return <div>Hello Infinite Canvas</div>;\n}',
    x: 500,
    y: 150,
  },
];

function App() {
  const [nodes, setNodes] = useState<NodeData[]>(INITIAL_NODES);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const viewportRef = useRef<HTMLDivElement>(null);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const draggingNodeId = useRef<string | null>(null);

  // Zoom logic
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = -e.deltaY;
      const factor = Math.pow(1.1, delta / 100); // Smoother scaling

      const newScale = Math.min(Math.max(scale * factor, 0.1), 5);

      // Zoom relative to mouse position
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const newOffsetX = mouseX - (mouseX - offset.x) * (newScale / scale);
      const newOffsetY = mouseY - (mouseY - offset.y) * (newScale / scale);

      setScale(newScale);
      setOffset({ x: newOffsetX, y: newOffsetY });
    } else {
      // Pan with touchpads
      setOffset(prev => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY
      }));
    }
  };

  // Pan logic
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button === 0 && !draggingNodeId.current) {
      setIsPanning(true);
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
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
    setIsPanning(false);
    draggingNodeId.current = null;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
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

  return (
    <div
      className="canvas-viewport"
      ref={viewportRef}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div
        className="canvas-transform-layer"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`
        }}
      >
        <div className="canvas-background" />

        <svg className="canvas-svg-layer">
          {/* We would render connection lines here */}
        </svg>

        {nodes.map(node => (
          <div
            key={node.id}
            className={`canvas-node ${selectedNodeId === node.id ? 'selected' : ''}`}
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
              <span className="node-title">{node.title}</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ff5f56' }} />
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ffbd2e' }} />
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#27c93f' }} />
              </div>
            </div>
            <div className="node-content">
              {node.content}
            </div>
          </div>
        ))}
      </div>

      {/* Overlay UI */}
      <div className="canvas-controls">
        <button className="control-btn" onClick={() => setScale(s => Math.min(s + 0.1, 5))}>+</button>
        <button className="control-btn" onClick={() => setScale(s => Math.max(s - 0.1, 0.1))}>−</button>
        <button className="control-btn" onClick={resetTransform}>⟲</button>
      </div>

      <div style={{
        position: 'fixed',
        top: '24px',
        left: '24px',
        padding: '12px 20px',
        borderRadius: '100px',
        background: 'rgba(139, 92, 246, 0.1)',
        border: '1px solid rgba(139, 92, 246, 0.2)',
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
