import React, { useState, useRef, useEffect, useCallback } from 'react';
import './index.css';
import { FileStorage } from './storage';
import { FileNodeService } from './FileNodeService';
import type { NodeData, ShapeData } from './types';
import StaticCanvas from './components/Canvas/StaticCanvas';
import InteractiveCanvas from './components/Canvas/InteractiveCanvas';
import { getPathData } from './utils/canvasUtils';
import CanvasNode from './components/objects/Nodes/CanvasNode';
import Sidebar from './components/UI/Sidebar';
import MainToolbar from './components/UI/MainToolbar';
import PropertiesToolbar from './components/UI/PropertiesToolbar';
import SettingsMenu from './components/UI/SettingsMenu';
import CanvasControls from './components/UI/CanvasControls';
import { useProjectManager } from './hooks/useProjectManager';
import { useCanvasTransform } from './hooks/useCanvasTransform';
import { useNodes } from './hooks/useNodes';
import { useConnections } from './hooks/useConnections';
import { useShapes } from './hooks/useShapes';
import { useSelection } from './hooks/useSelection';
import { useGestures } from './hooks/useGestures';
import { usePersistence } from './hooks/usePersistence';
import { useHistory } from './hooks/useHistory';
import ShapeHandles from './components/objects/Shapes/ShapeHandles';
import ConnectionLine from './components/objects/ConnectionLine';






function App() {
  const {
    currentProjectId,
    manifest,
    editingProjectId,
    setEditingProjectId,
    switchProject,
    createProject,
    deleteProject,
    renameProject,
    updateLastModified
  } = useProjectManager();

  // --- Core State ---
  // --- Core State ---
  const {
    scale,
    offset,
    scaleRef,
    offsetRef,
    setScale,
    setOffset,
    resetTransform,
    syncState
  } = useCanvasTransform();

  const viewportRef = useRef<HTMLDivElement>(null);
  const transformLayerRef = useRef<HTMLDivElement>(null);
  const staticCanvasRef = useRef<{ syncTransform: (offset: { x: number, y: number }, scale: number) => void }>(null);
  const interactiveCanvasRef = useRef<{ syncTransform: (offset: { x: number, y: number }, scale: number) => void }>(null);

  const {
    shapes,
    setShapes,
    shapesRef, // Exposed for useNodes handling
    addShape,
  } = useShapes();

  const {
    nodes,
    setNodes,
    nodesMapRef,
    handleOffsetsRef,
    addTextNode,
    addFileNode,
    syncNodeFromDisk,
    requestWritePermission,
    saveNodeToDisk,
    updateHandleOffsets,
    handleContentChange,
    handleToggleEditing
  } = useNodes({ scaleRef, shapesRef, viewportRef, offsetRef });

  const getHandleCanvasPos = useCallback((nodeId: string, handleId: string) => {
    const node = nodesMapRef.current.get(nodeId);
    const shape = shapesRef.current.find(s => s.id === nodeId);
    const item = node || shape;
    const hOffset = handleOffsetsRef.current[`${nodeId}:${handleId}`];

    if (!item || !hOffset) {
      return { x: (item?.x || 0) + 100, y: (item?.y || 0) + 100 };
    }

    return {
      x: item.x + hOffset.x,
      y: item.y + hOffset.y
    };
  }, []);

  const {
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
  } = useConnections({ nodesMapRef, scaleRef, offsetRef, viewportRef, getHandleCanvasPos, updateHandleOffsets });


  const {
    selectedNodeId,
    selectedConnectionId,
    selectedShapeId,
    selectNode,
    selectConnection,
    selectShape,
    clearSelection,
    selectedObject
  } = useSelection();

  const [backgroundPattern, setBackgroundPattern] = useState<'grid' | 'dots' | 'lines'>('grid');
  const [backgroundOpacity, setBackgroundOpacity] = useState<number>(0.7);
  const [theme, setTheme] = useState<'light' | 'dark' | 'paper'>('dark');
  const [syntaxTheme, setSyntaxTheme] = useState<'classic' | 'monokai' | 'nord' | 'solarized' | 'ink'>('classic');

  const [isPanning, setIsPanning] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);

  const [currentTool, setCurrentTool] = useState<'select' | 'rectangle' | 'ellipse' | 'diamond' | 'arrow' | 'pencil'>('select');
  const [showSettings, setShowSettings] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Freehand drawing state
  const drawingPointsRef = useRef<number[][]>([]);
  const [activeFreehandShape, setActiveFreehandShape] = useState<ShapeData | null>(null);

  // Default properties for new shapes
  const [defaultShapeStyle, setDefaultShapeStyle] = useState({
    strokeColor: '#d1d5db',
    strokeWidth: 2,
    opacity: 1
  });

  // Sync default color with theme
  useEffect(() => {
    setDefaultShapeStyle(prev => ({
      ...prev,
      strokeColor: theme === 'dark' ? '#d1d5db' : '#374151'
    }));
  }, [theme]);

  usePersistence({
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
  });

  const { addToHistory, undo, redo, clearHistory, canUndo, canRedo } = useHistory({
    nodes,
    connections,
    shapes,
    setNodes,
    setConnections,
    setShapes
  });

  useEffect(() => {
    // Clear history when project changes
    clearHistory();
  }, [currentProjectId, clearHistory]);

  // Refs for interactions
  const lastMousePos = useRef({ x: 0, y: 0 });
  const draggingNodeId = useRef<string | null>(null);
  const resizingNodeRef = useRef<{ id: string, startX: number, startY: number, startW: number, startH: number, direction: string, startNodeX: number, startNodeY: number } | null>(null);
  const selectedShapeIdRef = useRef(selectedShapeId);

  useEffect(() => { selectedShapeIdRef.current = selectedShapeId; }, [selectedShapeId]);

  const updateCanvasDisplay = useCallback(() => {
    const transform = `translate(${offsetRef.current.x}px, ${offsetRef.current.y}px) scale(${scaleRef.current})`;
    if (transformLayerRef.current) {
      transformLayerRef.current.style.transform = transform;
    }
    if (staticCanvasRef.current) {
      staticCanvasRef.current.syncTransform(offsetRef.current, scaleRef.current);
    }
    if (interactiveCanvasRef.current) {
      interactiveCanvasRef.current.syncTransform(offsetRef.current, scaleRef.current);
    }
    if (viewportRef.current) {
      viewportRef.current.style.setProperty('--canvas-x', `${offsetRef.current.x}px`);
      viewportRef.current.style.setProperty('--canvas-y', `${offsetRef.current.y}px`);
      viewportRef.current.style.setProperty('--canvas-scale', scaleRef.current.toString());
    }
  }, []);

  // --- Gestures ---
  useGestures({
    viewportRef,
    scaleRef,
    offsetRef,
    scale,
    updateCanvasDisplay,
    syncState,
    setIsInteracting,
    isInteracting
  });

  const updateSVGLinesForNode = useCallback((id: string) => {
    const connIds = connectionsByNodeRef.current.get(id) || [];
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



  const handlePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    const isNode = !!target.closest('.canvas-node');
    const isHandle = !!target.closest('[data-handle-id]');
    const isConnection = !!target.closest('.connection-path');
    const isShapeContainer = !!target.closest('.shape-handle-container');
    const isUI = !!target.closest('.main-toolbar') ||
      !!target.closest('.canvas-controls') ||
      !!target.closest('.glass-container') ||
      !!target.closest('.top-right-controls') ||
      !!target.closest('.properties-toolbar');

    // Clear selections if clicking the empty canvas
    if (!isNode && !isHandle && !isConnection && !isUI && !isShapeContainer) {
      // Check for shape selection if using select tool
      if (currentTool === 'select') {
        const rect = viewportRef.current?.getBoundingClientRect();
        if (rect) {
          const x = (e.clientX - rect.left - offsetRef.current.x) / scaleRef.current;
          const y = (e.clientY - rect.top - offsetRef.current.y) / scaleRef.current;

          // Simple reverse-order hit testing (top-most first)
          const hitShape = [...shapesRef.current].reverse().find(s => {
            return x >= s.x && x <= s.x + s.width && y >= s.y && y <= s.y + s.height;
          });

          if (hitShape) {
            selectShape(hitShape.id);
            draggingNodeId.current = hitShape.id;
            lastMousePos.current = { x: e.clientX, y: e.clientY };
          } else {
            clearSelection();
          }
        }
      } else {
        clearSelection();
      }
    } else if (isNode || isConnection || isHandle || isShapeContainer) {
      if (isShapeContainer) {
        const container = target.closest('.shape-handle-container');
        const shapeId = container?.id.replace('handles-', '');
        if (shapeId) {
          selectShape(shapeId);
          draggingNodeId.current = shapeId;
          lastMousePos.current = { x: e.clientX, y: e.clientY };
        }
      } else {
        selectShape(null);
      }
    }

    const handle = target.closest('[data-handle-id]');
    if (handle) {
      e.stopPropagation();
      const parentEl = target.closest('.canvas-node, .shape-handle-container');
      const objectId = parentEl?.id.startsWith('handles-') ? parentEl.id.replace('handles-', '') : parentEl?.id;
      const handleId = handle.getAttribute('data-handle-id');

      if (objectId && handleId) {
        const rect = viewportRef.current?.getBoundingClientRect();
        if (!rect) return;

        startLinking(objectId, handleId);
        return;
        return;
      }
    }

    if (e.button === 0 && !draggingNodeId.current) {
      if (currentTool === 'pencil') {
        // Start freehand drawing
        setIsPanning(false);
        const rect = viewportRef.current?.getBoundingClientRect();
        if (rect) {
          const x = (e.clientX - rect.left - offsetRef.current.x) / scaleRef.current;
          const y = (e.clientY - rect.top - offsetRef.current.y) / scaleRef.current;
          const pressure = (e as any).pressure || 0.5;

          drawingPointsRef.current = [[x, y, pressure]];
          setActiveFreehandShape({
            id: 'temp-drawing',
            type: 'pencil',
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            strokeColor: defaultShapeStyle.strokeColor,
            fillColor: 'transparent',
            strokeWidth: defaultShapeStyle.strokeWidth,
            opacity: defaultShapeStyle.opacity,
            points: drawingPointsRef.current
          });
          try {
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
          } catch (err) { console.warn('Failed to capture pointer'); }
        }
      } else if (currentTool !== 'select') {
        setIsPanning(false);
        const rect = viewportRef.current?.getBoundingClientRect();
        if (rect) {
          const x = (e.clientX - rect.left - offsetRef.current.x) / scaleRef.current;
          const y = (e.clientY - rect.top - offsetRef.current.y) / scaleRef.current;
          setLinkingState({
            sourceNodeId: 'drawing',
            sourceHandleId: currentTool,
            startX: x,
            startY: y,
            targetX: x,
            targetY: y
          });
        }
        try {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        } catch (err) { console.warn('Failed to capture pointer'); }
      } else {
        setIsPanning(true);
        try {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        } catch (err) { console.warn('Failed to capture pointer'); }
      }

      lastMousePos.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    // Handle freehand drawing
    if (activeFreehandShape) {
      const rect = viewportRef.current?.getBoundingClientRect();
      if (rect) {
        const x = (e.clientX - rect.left - offsetRef.current.x) / scaleRef.current;
        const y = (e.clientY - rect.top - offsetRef.current.y) / scaleRef.current;
        const pressure = (e as any).pressure || 0.5;

        // Append point to drawing
        drawingPointsRef.current.push([x, y, pressure]);

        // Update state with new points reference (triggers re-render for preview)
        // Performance: We only update the reference, not copy the array
        setActiveFreehandShape(prev => prev ? {
          ...prev,
          points: drawingPointsRef.current  // Reference, not copy!
        } : null);
      }
      return;
    }

    if (linkingState) {
      updateLinking(e);
      return;
    }

    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;

    if (isPanning) {
      if (!isInteracting) setIsInteracting(true);
      offsetRef.current = { x: offsetRef.current.x + dx, y: offsetRef.current.y + dy };
      updateCanvasDisplay();
    } else if (resizingNodeRef.current) {
      const { id, startX, startY, startW, startH, direction, startNodeX, startNodeY } = resizingNodeRef.current;
      const dX = (e.clientX - startX) / scaleRef.current;
      const dY = (e.clientY - startY) / scaleRef.current;

      let newW = startW;
      let newH = startH;
      let newX = startNodeX;
      let newY = startNodeY;

      if (direction.includes('right')) newW = Math.max(50, startW + dX);
      if (direction.includes('left')) { const d = Math.min(dX, startW - 50); newW = startW - d; newX = startNodeX + d; }
      if (direction.includes('bottom')) newH = Math.max(50, startH + dY);
      if (direction.includes('top')) { const d = Math.min(dY, startH - 50); newH = startH - d; newY = startNodeY + d; }

      const node = nodesMapRef.current.get(id);
      const shape = shapesRef.current.find(s => s.id === id);

      if (node) {
        const el = document.getElementById(id);
        if (el) {
          el.style.width = `${newW}px`;
          el.style.height = `${newH}px`;
          el.style.left = `${newX}px`;
          el.style.top = `${newY}px`;
        }
      } else if (shape) {
        // Update ref immediately for instant canvas drawing
        shape.x = newX;
        shape.y = newY;
        shape.width = newW;
        shape.height = newH;

        // Update React state to trigger ShapeHandles re-render with new dimensions
        setShapes(prev => prev.map(s => s.id === id ? {
          ...s,
          x: newX,
          y: newY,
          width: newW,
          height: newH
        } : s));

        updateCanvasDisplay();
      }
    } else if (draggingNodeId.current) {
      const dX_canvas = dx / scaleRef.current;
      const dY_canvas = dy / scaleRef.current;
      const id = draggingNodeId.current;

      const node = nodesMapRef.current.get(id);
      const shape = shapesRef.current.find(s => s.id === id);

      if (node) {
        // Update ref for canvas rendering
        node.x += dX_canvas;
        node.y += dY_canvas;

        // Manual DOM update for instant feedback (no React re-render during drag)
        const el = document.getElementById(node.id);
        if (el) {
          el.style.left = `${node.x}px`;
          el.style.top = `${node.y}px`;
        }

        updateSVGLinesForNode(id);
      } else if (shape) {
        // Update ref for canvas rendering
        shape.x += dX_canvas;
        shape.y += dY_canvas;

        // Manual DOM update for handles (no React re-render during drag)
        const el = document.getElementById(`handles-${id}`);
        if (el) {
          el.style.left = `${shape.x}px`;
          el.style.top = `${shape.y}px`;
        }

        updateSVGLinesForNode(id);
        updateCanvasDisplay(); // Redraw static canvas with updated ref
      }
    }
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsPanning(false);
    setIsInteracting(false);

    // Complete freehand drawing
    if (activeFreehandShape) {
      const points = drawingPointsRef.current;
      if (points.length > 2) {
        // Calculate bounding box
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        points.forEach(p => {
          if (p[0] < minX) minX = p[0];
          if (p[1] < minY) minY = p[1];
          if (p[0] > maxX) maxX = p[0];
          if (p[1] > maxY) maxY = p[1];
        });

        const width = maxX - minX;
        const height = maxY - minY;

        // Normalize points to 0-1 range for resize compatibility
        const safeWidth = width || 1;
        const safeHeight = height || 1;

        const normalizedPoints = points.map(p => [
          (p[0] - minX) / safeWidth,
          (p[1] - minY) / safeHeight,
          p[2]
        ]);

        // Add as permanent shape
        addShape({
          id: `shape-${Date.now()}`,
          type: 'pencil',
          x: minX,
          y: minY,
          width: width,
          height: height,
          strokeColor: activeFreehandShape.strokeColor,
          fillColor: 'transparent',
          strokeWidth: activeFreehandShape.strokeWidth,
          opacity: 1,
          points: normalizedPoints
        });

        addToHistory();
      }

      // Clear drawing state
      setActiveFreehandShape(null);
      drawingPointsRef.current = [];
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (err) { }
      return;
    }

    if (linkingState) {
      if (linkingState.sourceNodeId === 'drawing') {
        const rect = viewportRef.current?.getBoundingClientRect();
        if (rect) {
          const x2 = (e.clientX - rect.left - offsetRef.current.x) / scaleRef.current;
          const y2 = (e.clientY - rect.top - offsetRef.current.y) / scaleRef.current;

          const w = Math.abs(linkingState.startX - x2);
          const h = Math.abs(linkingState.startY - y2);

          if (w > 5 || h > 5) {
            addShape({
              id: `shape-${Date.now()}`,
              type: linkingState.sourceHandleId as any,
              x: Math.min(linkingState.startX, x2),
              y: Math.min(linkingState.startY, y2),
              width: w,
              height: h,
              strokeColor: defaultShapeStyle.strokeColor,
              fillColor: 'transparent',
              strokeWidth: defaultShapeStyle.strokeWidth,
              opacity: defaultShapeStyle.opacity
            });
            setCurrentTool('select');
            addToHistory();
          }
        }
      } else {
        const target = e.target as HTMLElement;
        const handle = target.closest('[data-handle-id]');
        if (handle) {
          const parentEl = handle.closest('.canvas-node, .shape-handle-container');
          const targetId = parentEl?.id.startsWith('handles-') ? parentEl.id.replace('handles-', '') : parentEl?.id;
          const targetHandleId = handle.getAttribute('data-handle-id');
          if (targetId && targetHandleId) {
            completeLinking(targetId, targetHandleId);
            addToHistory();
          }
        }
      }
      setLinkingState(null);
    }

    if (resizingNodeRef.current) {
      const { id, direction } = resizingNodeRef.current;
      const el = direction.startsWith('shape-') || document.getElementById(`handles-${id}`) ? document.getElementById(`handles-${id}`) : document.getElementById(id);
      const node = nodesMapRef.current.get(id);
      const shape = shapesRef.current.find(s => s.id === id);

      if (node && el) {
        const newW = el.offsetWidth;
        const newH = el.offsetHeight;
        const newX = parseFloat(el.style.left);
        const newY = parseFloat(el.style.top);
        setNodes(prev => prev.map(n => n.id === id ? { ...n, width: newW, height: newH, x: newX, y: newY } : n));
        updateHandleOffsets(id);
      } else if (shape && el) {
        setShapes(prev => prev.map(s => s.id === id ? { ...s, width: shape.width, height: shape.height, x: shape.x, y: shape.y } : s));
        updateHandleOffsets(id);
      }
      addToHistory();
      resizingNodeRef.current = null;
    }

    if (draggingNodeId.current) {
      const id = draggingNodeId.current;
      draggingNodeId.current = null;

      const node = nodesMapRef.current.get(id);
      const shape = shapesRef.current.find(s => s.id === id);

      if (node) {
        // Commit final position from ref to state
        setNodes(prev => prev.map(n => n.id === id ? {
          ...n,
          x: node.x,
          y: node.y,
          isDirty: true
        } : n));
      } else if (shape) {
        // Commit final position from ref to state
        setShapes(prev => prev.map(s => s.id === id ? {
          ...s,
          x: shape.x,
          y: shape.y
        } : s));
      }

      updateCanvasDisplay();
      updateHandleOffsets(id);
      addToHistory();
    }

    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (err) { }
  };

  const handleResizeStart = (id: string, e: React.PointerEvent, direction: string = 'bottom-right') => {
    e.stopPropagation();
    let el = document.getElementById(id);
    if (!el && id.startsWith('shape-')) {
      el = document.getElementById(`handles-${id}`);
    }
    if (!el) return;

    const node = nodesMapRef.current.get(id);
    const shape = shapesRef.current.find(s => s.id === id);
    const item = node || shape;
    if (!item) return;

    resizingNodeRef.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      startW: el.offsetWidth,
      startH: el.offsetHeight,
      startNodeX: item.x,
      startNodeY: item.y,
      direction
    };

    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch (err) { }
  };



  const handleNodeDragStart = (id: string, e: React.PointerEvent) => {
    e.stopPropagation();
    draggingNodeId.current = id;
    selectNode(id);
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const deleteSelected = useCallback(() => {
    if (selectedNodeId) {
      setNodes(prev => prev.filter(n => n.id !== selectedNodeId));
      setConnections(prev => prev.filter(c => c.source.nodeId !== selectedNodeId && c.target.nodeId !== selectedNodeId));
      clearSelection();
    } else if (selectedConnectionId) {
      setConnections(prev => prev.filter(c => c.id !== selectedConnectionId));
      clearSelection();
    } else if (selectedShapeId) {
      setShapes(prev => prev.filter(s => s.id !== selectedShapeId));
      // Also remove all connections to/from this shape
      setConnections(prev => prev.filter(c => c.source.nodeId !== selectedShapeId && c.target.nodeId !== selectedShapeId));
      clearSelection();
      addToHistory();
    }
  }, [selectedNodeId, selectedConnectionId, selectedShapeId, clearSelection, setNodes, setConnections, setShapes]);

  // Keyboard shortcuts  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Delete selected object with Delete or Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Don't delete if user is typing in a text input/textarea
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return;
        }

        e.preventDefault();
        deleteSelected();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteSelected]);

  const handlePointerDownNode = useCallback((id: string) => {
    selectNode(id);
  }, [selectNode]);

  const handleToggleEditingWrapper = useCallback((id: string, isEditing: boolean) => {
    handleToggleEditing(id, isEditing);
    if (!isEditing) {
      addToHistory();
    }
  }, [handleToggleEditing, addToHistory]);

  const addTextNodeWrapper = useCallback(() => {
    const id = addTextNode();
    addToHistory();
    return id;
  }, [addTextNode, addToHistory]);

  const addFileNodeWrapper = useCallback(async () => {
    const id = await addFileNode();
    if (id) addToHistory();
    return id;
  }, [addFileNode, addToHistory]);

  const unlinkNode = (nodeId: string) => {
    setConnections(prev => prev.filter(c => c.source.nodeId !== nodeId && c.target.nodeId !== nodeId));
  };

  const updateConnectionStyle = (id: string, style: Partial<{ color: string, width: number }>) => {
    setConnections(prev => prev.map(c =>
      c.id === id ? { ...c, style: { ...c.style, ...style } } : c
    ));
  };

  const updateShapeStyle = (id: string, style: Partial<{ strokeColor: string, strokeWidth: number }>) => {
    setShapes(prev => prev.map(s =>
      s.id === id ? { ...s, ...style } : s
    ));
  };

  const updateSelectedObjectStyle = (style: { color?: string, width?: number }) => {
    const obj = selectedObject;
    if (!obj) return;

    if (obj.type === 'connection') {
      updateConnectionStyle(obj.id, style);
    } else if (obj.type === 'shape') {
      const shapeStyle: Partial<{ strokeColor: string, strokeWidth: number }> = {};
      if (style.color) shapeStyle.strokeColor = style.color;
      if (style.width !== undefined) shapeStyle.strokeWidth = style.width;
      updateShapeStyle(obj.id, shapeStyle);
    }
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
      addToHistory();
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
      addToHistory();
    }
  };



  // Removed complex polling/global Prism logic as it's now handled by CanvasNode locally



  // Touch Handlers for Pinch Zoom
  // Touch Handlers for Pinch Zoom attached via Ref for passive: false support


  return (
    <div
      className={`canvas-viewport ${isInteracting ? 'is-interacting' : ''}`}
      ref={viewportRef}
      style={{
        '--grid-opacity': backgroundOpacity * 0.1,
        cursor: isPanning ? 'grabbing' : (currentTool === 'select' ? 'var(--cursor-select)' : 'crosshair')
      } as any}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="canvas-background-container" style={{ pointerEvents: 'none' }}>
        <div className={`canvas-background ${backgroundPattern}`} />
      </div>

      <StaticCanvas
        ref={staticCanvasRef}
        shapes={shapes}
        scale={scale}
        offset={offset}
      />

      <InteractiveCanvas
        ref={interactiveCanvasRef}
        activeShape={activeFreehandShape || (linkingState && linkingState.sourceNodeId === 'drawing' ? {
          type: linkingState.sourceHandleId as any,
          x: Math.min(linkingState.startX, linkingState.targetX),
          y: Math.min(linkingState.startY, linkingState.targetY),
          width: Math.abs(linkingState.startX - linkingState.targetX),
          height: Math.abs(linkingState.startY - linkingState.targetY),
          strokeColor: theme === 'dark' ? '#8b5cf6' : '#6366f1',
          fillColor: 'rgba(139, 92, 246, 0.1)',
          strokeWidth: 2,
          opacity: 1
        } : null)}
        scale={scale}
        offset={offset}
      />

      <div
        className="canvas-transform-layer"
        ref={transformLayerRef}
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`
        }}
      >

        {shapes.map(shape => (
          <ShapeHandles
            key={`handles-${shape.id}`}
            shape={shape}
            isSelected={selectedShapeId === shape.id}
            onPointerDown={startLinking}
            onResizePointerDown={handleResizeStart}
            updateHandleOffsets={updateHandleOffsets}
          />
        ))}

        {nodes.map(node => (
          <CanvasNode
            key={node.id}
            node={node}
            isSelected={selectedNodeId === node.id}
            onPointerDown={handlePointerDownNode}
            onHeaderPointerDown={handleNodeDragStart}
            onResizePointerDown={handleResizeStart}
            onContentChange={handleContentChange}
            onToggleEditing={handleToggleEditingWrapper}

            onSync={syncNodeFromDisk}
            onRequestPermission={requestWritePermission}
            onSave={saveNodeToDisk}
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
                onSelect={selectConnection}
              />
            );
          })}

          {linkingState && linkingState.sourceNodeId !== 'drawing' && (() => {
            return (
              <path
                d={getPathData(linkingState.startX, linkingState.startY, linkingState.targetX, linkingState.targetY)}
                className="temp-connection"
              />
            );
          })()}
        </svg>
      </div>

      <InteractiveCanvas
        ref={interactiveCanvasRef}
        activeShape={
          linkingState && linkingState.sourceNodeId === 'drawing' ? {
            type: linkingState.sourceHandleId as any,
            x: Math.min(linkingState.startX, linkingState.targetX),
            y: Math.min(linkingState.startY, linkingState.targetY),
            width: Math.abs(linkingState.startX - linkingState.targetX),
            height: Math.abs(linkingState.startY - linkingState.targetY),
            strokeColor: theme === 'dark' ? '#8b5cf6' : '#6366f1',
            fillColor: 'rgba(139, 92, 246, 0.1)',
            strokeWidth: 2,
            opacity: 1
          } : null
        }
        scale={scale}
        offset={offset}
      />

      <Sidebar
        manifest={manifest}
        currentProjectId={currentProjectId}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        switchProject={switchProject}
        createProject={createProject}
        deleteProject={deleteProject}
        editingProjectId={editingProjectId}
        setEditingProjectId={setEditingProjectId}
        renameProject={renameProject}
      />



      <CanvasControls
        scale={scale}
        setScale={setScale}
        resetTransform={resetTransform}
        isSidebarOpen={isSidebarOpen}
        manifest={manifest}
        currentProjectId={currentProjectId}
        undo={undo}
        redo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
      />

      <MainToolbar
        currentTool={currentTool}
        setCurrentTool={setCurrentTool}
        defaultLineType={defaultLineType}
        setDefaultLineType={setDefaultLineType}
        addTextNode={addTextNodeWrapper}
        addFileNode={addFileNodeWrapper}
      />

      <PropertiesToolbar
        selectedObject={selectedObject}
        deleteSelected={deleteSelected}
        unlinkNode={unlinkNode}
        updateSelectedObjectStyle={updateSelectedObjectStyle}
        connections={connections}
        shapes={shapes}
        currentTool={currentTool}
        defaultShapeStyle={defaultShapeStyle}
        updateDefaultShapeStyle={setDefaultShapeStyle}
      />

      <SettingsMenu
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        backgroundPattern={backgroundPattern}
        setBackgroundPattern={setBackgroundPattern}
        backgroundOpacity={backgroundOpacity}
        setBackgroundOpacity={setBackgroundOpacity}
        theme={theme}
        setTheme={setTheme}
        syntaxTheme={syntaxTheme}
        setSyntaxTheme={setSyntaxTheme}
      />
    </div >
  );
}

export default App;
