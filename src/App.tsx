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
import GroupHandles from './components/UI/GroupHandles';

// Selection Box Rect Helper
const getNormalizedRect = (start: { x: number, y: number }, current: { x: number, y: number }) => {
  return {
    x: Math.min(start.x, current.x),
    y: Math.min(start.y, current.y),
    width: Math.abs(current.x - start.x),
    height: Math.abs(current.y - start.y)
  };
};

const rotatePoint = (px: number, py: number, cx: number, cy: number, angleRad: number) => {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const dx = px - cx;
  const dy = py - cy;
  return {
    x: cx + (dx * cos - dy * sin),
    y: cy + (dx * sin + dy * cos)
  };
};








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
    updateShape,
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
  } = useConnections({ scaleRef, offsetRef, viewportRef, getHandleCanvasPos, updateHandleOffsets });


  const {
    selectedShapeId,    // Legacy / Single helper
    selectedNodeIds,
    selectedConnectionIds,
    selectedShapeIds,
    selectNode,
    selectConnection,
    selectShape,
    setSelection,
    clearSelection,
    selectedObject
  } = useSelection();

  // Selection Box State
  const [selectionBox, setSelectionBox] = useState<{ startX: number, startY: number, currentX: number, currentY: number } | null>(null);

  // Group Transformation State (to maintain group box rotation during interaction)
  const [groupTransform, setGroupTransform] = useState<{ bounds: { x: number, y: number, width: number, height: number } | null, rotation: number }>({ bounds: null, rotation: 0 });

  const [backgroundPattern, setBackgroundPattern] = useState<'grid' | 'dots' | 'lines'>('grid');
  const [backgroundOpacity, setBackgroundOpacity] = useState<number>(0.7);
  const [theme, setTheme] = useState<'light' | 'dark' | 'paper'>('dark');
  const [syntaxTheme, setSyntaxTheme] = useState<'classic' | 'monokai' | 'nord' | 'solarized' | 'ink'>('classic');

  const [isPanning, setIsPanning] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);

  const [currentTool, setCurrentTool] = useState<'select' | 'hand' | 'rectangle' | 'ellipse' | 'diamond' | 'arrow' | 'pencil'>('select');
  const [showSettings, setShowSettings] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Freehand drawing state
  const drawingPointsRef = useRef<number[][]>([]);
  const [activeFreehandShape, setActiveFreehandShape] = useState<ShapeData | null>(null);
  const [editingShapeId, setEditingShapeId] = useState<string | null>(null);

  // Default properties for new shapes
  const [defaultShapeStyle, setDefaultShapeStyle] = useState({
    strokeColor: '#d1d5db',
    fillColor: 'transparent',
    textColor: '#d1d5db',
    strokeWidth: 2,
    fontSize: 14,
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
  // --- Theme Application ---
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-syntax-theme', syntaxTheme);
  }, [theme, syntaxTheme]);

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
  const rotatingShapeRef = useRef<{ id: string, startX: number, startY: number, startRotation: number, centerX: number, centerY: number } | null>(null);
  const selectedShapeIdRef = useRef(selectedShapeId);

  // Helper to get bounding box of current selection
  const getSelectionBounds = useCallback(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let hasSelection = false;

    if (selectedNodeIds.size > 0) {
      nodesMapRef.current.forEach((node) => {
        if (selectedNodeIds.has(node.id)) {
          hasSelection = true;
          minX = Math.min(minX, node.x);
          minY = Math.min(minY, node.y);
          const w = node.width || 200;
          const h = node.height || 100;
          maxX = Math.max(maxX, node.x + w);
          maxY = Math.max(maxY, node.y + h);
        }
      });
    }

    if (selectedShapeIds.size > 0) {
      shapesRef.current.forEach(shape => {
        if (selectedShapeIds.has(shape.id)) {
          hasSelection = true;
          minX = Math.min(minX, shape.x);
          minY = Math.min(minY, shape.y);
          maxX = Math.max(maxX, shape.x + shape.width);
          maxY = Math.max(maxY, shape.y + shape.height);
        }
      });
    }

    if (!hasSelection) return null;
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }, [selectedNodeIds, selectedShapeIds]);

  // Group interaction ref
  const groupInteractionRef = useRef<{
    type: 'move' | 'resize' | 'rotate',
    startX: number,
    startY: number,
    startBounds: { x: number, y: number, width: number, height: number, rotation?: number },
    startItems: Map<string, { x: number, y: number, width: number, height: number, rotation: number }>,
    direction?: string,
    centerX?: number,
    centerY?: number
  } | null>(null);

  const selectionBounds = getSelectionBounds();

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

    if (currentTool === 'hand') {
      if (!isUI) {
        setIsPanning(true);
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        try {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        } catch (err) { }
      }
      return;
    }

    // Clear selections if clicking the empty canvas
    let isSelectionStart = false;
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
            // Single select logic
            selectShape(hitShape.id);
            draggingNodeId.current = hitShape.id;
            lastMousePos.current = { x: e.clientX, y: e.clientY };
          } else {
            // Check if clicking inside Group Selection (Multi-Select Move)
            const bounds = groupTransform.bounds || selectionBounds;
            const isMultiSelection = (selectedNodeIds.size + selectedShapeIds.size) > 1;

            if (isMultiSelection && bounds && currentTool === 'select') {
              if (
                x >= bounds.x &&
                x <= bounds.x + bounds.width &&
                y >= bounds.y &&
                y <= bounds.y + bounds.height
              ) {
                // Drag the group by using a proxy ID (first selected item)
                // The dragging logic checks for isMultiSelection and moves all items
                const firstId = selectedNodeIds.values().next().value || selectedShapeIds.values().next().value;
                if (firstId) {
                  draggingNodeId.current = firstId;
                  lastMousePos.current = { x: e.clientX, y: e.clientY };
                  try {
                    (e.target as HTMLElement).setPointerCapture(e.pointerId);
                  } catch (err) { }
                  return;
                }
              }
            }

            // START BOX SELECTION
            // Clear existing unless shift/ctrl held? For now simple clear.
            clearSelection();
            setSelectionBox({
              startX: x,
              startY: y,
              currentX: x,
              currentY: y
            });
            isSelectionStart = true;
            try {
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
            } catch (err) { }
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
        if (!isSelectionStart) {
          setIsPanning(true);
          try {
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
          } catch (err) { console.warn('Failed to capture pointer'); }
        }
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

    if (selectionBox) {
      const rect = viewportRef.current?.getBoundingClientRect();
      if (rect) {
        const x = (e.clientX - rect.left - offsetRef.current.x) / scaleRef.current;
        const y = (e.clientY - rect.top - offsetRef.current.y) / scaleRef.current;

        setSelectionBox(prev => prev ? { ...prev, currentX: x, currentY: y } : null);

        // Live Selection Logic
        const box = getNormalizedRect({ x: selectionBox.startX, y: selectionBox.startY }, { x, y });

        const selectedNodes: string[] = [];
        const selectedShapes: string[] = [];
        const selectedConn: string[] = [];

        // optimized: standard loop
        nodesMapRef.current.forEach((node) => {
          const nw = node.width || 200;
          const nh = node.height || 100;
          if (
            node.x < box.x + box.width &&
            node.x + nw > box.x &&
            node.y < box.y + box.height &&
            node.y + nh > box.y
          ) {
            selectedNodes.push(node.id);
          }
        });

        shapesRef.current.forEach((shape) => {
          if (
            shape.x < box.x + box.width &&
            shape.x + shape.width > box.x &&
            shape.y < box.y + box.height &&
            shape.y + shape.height > box.y
          ) {
            selectedShapes.push(shape.id);
          }
        });

        // Connections: simple bounding box of start/end
        connectionsRef.current.forEach((conn) => {
          const start = getHandleCanvasPos(conn.source.nodeId, conn.source.handleId);
          const end = getHandleCanvasPos(conn.target.nodeId, conn.target.handleId);
          const minX = Math.min(start.x, end.x);
          const maxX = Math.max(start.x, end.x);
          const minY = Math.min(start.y, end.y);
          const maxY = Math.max(start.y, end.y);

          // Check intersection
          if (
            minX < box.x + box.width &&
            maxX > box.x &&
            minY < box.y + box.height &&
            maxY > box.y
          ) {
            selectedConn.push(conn.id);
          }
        });

        setSelection(selectedNodes, selectedShapes, selectedConn);
      }
      return;
    }

    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;

    if (isPanning) {
      if (!isInteracting) setIsInteracting(true);
      offsetRef.current = { x: offsetRef.current.x + dx, y: offsetRef.current.y + dy };
      updateCanvasDisplay();
    } else if (rotatingShapeRef.current) {
      const { id, centerX, centerY } = rotatingShapeRef.current;

      // Calculate angle from center to mouse
      const rect = viewportRef.current?.getBoundingClientRect();
      const mouseX = (e.clientX - (rect?.left || 0) - offsetRef.current.x) / scaleRef.current;
      const mouseY = (e.clientY - (rect?.top || 0) - offsetRef.current.y) / scaleRef.current;

      const angleRad = Math.atan2(mouseY - centerY, mouseX - centerX);
      let angleDeg = angleRad * (180 / Math.PI);

      // Adjust angle so 0 is up (or matches initial handle position)
      // atan2 returns 0 for right, 90 for down. We want rotation relative to initial internal rotation.
      // But actually, we want absolute rotation. Valid range 0-360 or -180 to 180.

      // Align 0 degrees to TOP (where the handle is)
      angleDeg += 90;

      setShapes(prev => {
        const shape = prev.find(s => s.id === id);
        if (shape) {
          return prev.map(s => s.id === id ? { ...s, rotation: angleDeg } : s);
        }
        return prev;
      });

      setNodes(prev => {
        const node = prev.find(n => n.id === id);
        if (node) {
          return prev.map(n => n.id === id ? { ...n, rotation: angleDeg } : n);
        }
        return prev;
      });

      // Update handles position implicitly by React re-render or ref update
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

      const isMultiSelection = (selectedNodeIds.size + selectedShapeIds.size) > 1 &&
        (selectedNodeIds.has(id) || selectedShapeIds.has(id));

      if (isMultiSelection) {
        selectedNodeIds.forEach(nId => {
          const node = nodesMapRef.current.get(nId);
          if (node) {
            node.x += dX_canvas;
            node.y += dY_canvas;
            const el = document.getElementById(nId);
            if (el) { el.style.left = `${node.x}px`; el.style.top = `${node.y}px`; }
            updateSVGLinesForNode(nId);
          }
        });
        let shapesUpdated = false;
        selectedShapeIds.forEach(sId => {
          const shape = shapesRef.current.find(s => s.id === sId);
          if (shape) {
            shape.x += dX_canvas;
            shape.y += dY_canvas;
            const el = document.getElementById(`handles-${sId}`);
            if (el) { el.style.left = `${shape.x}px`; el.style.top = `${shape.y}px`; }
            updateSVGLinesForNode(sId);
            shapesUpdated = true;
          }
        });
        if (shapesUpdated) {
          setShapes(prev => [...prev]);
          updateCanvasDisplay();
        }

        setGroupTransform(prev => {
          if (prev.bounds) {
            return { ...prev, bounds: { ...prev.bounds, x: prev.bounds.x + dX_canvas, y: prev.bounds.y + dY_canvas } };
          }
          return prev;
        });

      } else {
        const node = nodesMapRef.current.get(id);
        const shape = shapesRef.current.find(s => s.id === id);

        if (node) {
          node.x += dX_canvas;
          node.y += dY_canvas;
          const el = document.getElementById(node.id);
          if (el) {
            el.style.left = `${node.x}px`;
            el.style.top = `${node.y}px`;
          }
          updateSVGLinesForNode(id);
        } else if (shape) {
          shape.x += dX_canvas;
          shape.y += dY_canvas;
          const el = document.getElementById(`handles-${id}`);
          if (el) {
            el.style.left = `${shape.x}px`;
            el.style.top = `${shape.y}px`;
          }
          updateSVGLinesForNode(id);
          updateCanvasDisplay();
        }
      }
    } else if (groupInteractionRef.current) {
      // Handle Group Interaction
      const { type, startX, startY, startBounds, startItems, direction } = groupInteractionRef.current;
      const dX = (e.clientX - startX) / scaleRef.current;
      const dY = (e.clientY - startY) / scaleRef.current;

      if (type === 'resize' && direction) {
        // Calculate new Group Bounds
        let newGroupW = startBounds.width;
        let newGroupH = startBounds.height;
        let newGroupX = startBounds.x;
        let newGroupY = startBounds.y;

        if (direction.includes('right')) newGroupW = Math.max(10, startBounds.width + dX);
        if (direction.includes('left')) { const d = Math.min(dX, startBounds.width - 10); newGroupW = startBounds.width - d; newGroupX = startBounds.x + d; }
        if (direction.includes('bottom')) newGroupH = Math.max(10, startBounds.height + dY);
        if (direction.includes('top')) { const d = Math.min(dY, startBounds.height - 10); newGroupH = startBounds.height - d; newGroupY = startBounds.y + d; }

        // Calculate Scale Factors
        const scaleX = newGroupW / startBounds.width;
        const scaleY = newGroupH / startBounds.height;

        // Apply to all items
        startItems.forEach((dims, id) => {
          const node = nodesMapRef.current.get(id);
          const shape = shapesRef.current.find(s => s.id === id);

          // Calculate new position relative to group origin
          const relX = dims.x - startBounds.x;
          const relY = dims.y - startBounds.y;

          const newX = newGroupX + (relX * scaleX);
          const newY = newGroupY + (relY * scaleY);
          const newW = dims.width * scaleX;
          const newH = dims.height * scaleY;

          if (node) {
            node.x = newX;
            node.y = newY;
            node.width = newW;
            node.height = newH;
            const el = document.getElementById(id);
            if (el) {
              el.style.left = `${newX}px`;
              el.style.top = `${newY}px`;
              el.style.width = `${newW}px`;
              el.style.height = `${newH}px`;
            }
            updateSVGLinesForNode(id);
          } else if (shape) {
            shape.x = newX;
            shape.y = newY;
            shape.width = newW;
            shape.height = newH;
            // Force React update for shapes to re-render properly as they use canvas or DOM handles
            // But for performance, we might wait for pointer up? 
            // Shapes are SVG/Canvas rendered, so we MUST re-render or update their refs and call render. 
            // InteractiveCanvas uses 'activeShape', StaticCanvas uses 'shapes'.
            // We need to trigger a re-render of App to update StaticCanvas?
            // Or verify if mutable updates reflect. StaticCanvas uses shapes prop.
            // Let's setShapes on pointer up, but for now we need visual feedback.
            // We can just update setShapes throttled, or just accept the ref update if we trigger updateCanvasDisplay?
            // StaticCanvas is memoized on shapes prop. If we mutate ref, it won't re-render unless we force it.
            // Actually, let's just trigger a re-render every frame? No, expensive.
            // Better: updating the DOM group box handles it visually? No, individual shapes need to move.

            // QUICK FIX: For smooth resize, we trigger re-render on mouse up, BUT we need visual feedback.
            // Let's update setShapes immediately? It might be fast enough for < 100 shapes.
            setShapes(prev => [...prev]); // Trigger re-render
          }
        });
      } else if (type === 'rotate' && startItems && groupInteractionRef.current.centerX !== undefined && groupInteractionRef.current.centerY !== undefined) {
        const cx = groupInteractionRef.current.centerX;
        const cy = groupInteractionRef.current.centerY;

        // Calculate angle
        const rect = viewportRef.current?.getBoundingClientRect();
        if (rect) {
          const screenCx = rect.left + offsetRef.current.x + cx * scaleRef.current;
          const screenCy = rect.top + offsetRef.current.y + cy * scaleRef.current;

          const angleStart = Math.atan2(startY - screenCy, startX - screenCx);
          const angleNow = Math.atan2(e.clientY - screenCy, e.clientX - screenCx);
          const angleDiff = angleNow - angleStart;
          const angleDeg = angleDiff * (180 / Math.PI);
          setGroupTransform(prev => ({ ...prev, rotation: angleDeg }));

          startItems.forEach((vals, id) => {
            const node = nodesMapRef.current.get(id);
            const shape = shapesRef.current.find(s => s.id === id);

            // 1. Rotate center point
            const itemCx = vals.x + vals.width / 2;
            const itemCy = vals.y + vals.height / 2;

            const newCenter = rotatePoint(itemCx, itemCy, cx, cy, angleDiff);

            const newX = newCenter.x - vals.width / 2;
            const newY = newCenter.y - vals.height / 2;

            // 2. Add rotation to item itself
            const newRotation = (vals.rotation || 0) + angleDeg;

            if (node) {
              node.x = newX;
              node.y = newY;

              const el = document.getElementById(id);
              if (el) {
                el.style.left = `${newX}px`;
                el.style.top = `${newY}px`;
              }
              updateSVGLinesForNode(id);
            } else if (shape) {
              shape.x = newX;
              shape.y = newY;
              shape.rotation = newRotation;

              setShapes(prev => [...prev]);
            }
          });
        }
      }
    }
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsPanning(false);
    setIsInteracting(false);

    if (selectionBox) {
      setSelectionBox(null);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (err) { }
      return;
    }

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
              fillColor: defaultShapeStyle.fillColor || 'transparent',
              strokeWidth: defaultShapeStyle.strokeWidth,
              opacity: defaultShapeStyle.opacity,
              fontSize: defaultShapeStyle.fontSize,
              textColor: defaultShapeStyle.textColor
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

    if (rotatingShapeRef.current) {
      rotatingShapeRef.current = null;
      addToHistory();
    }

    if (groupInteractionRef.current) {
      groupInteractionRef.current = null;
      // Trigger final state save
      setNodes(prev => [...prev]); // Commit changes
      setShapes(prev => [...prev]);
      addToHistory();
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

  const handleGroupResizeStart = useCallback((e: React.PointerEvent, direction: string) => {
    e.stopPropagation();
    const bounds = getSelectionBounds();
    if (!bounds) return;
    setGroupTransform({ bounds: null, rotation: 0 });

    const startItems = new Map<string, { x: number, y: number, width: number, height: number, rotation: number }>();

    selectedNodeIds.forEach(id => {
      const n = nodesMapRef.current.get(id);
      if (n) startItems.set(id, { x: n.x, y: n.y, width: n.width || 200, height: n.height || 100, rotation: 0 });
    });
    selectedShapeIds.forEach(id => {
      const s = shapesRef.current.find(shape => shape.id === id);
      if (s) startItems.set(id, { x: s.x, y: s.y, width: s.width, height: s.height, rotation: s.rotation || 0 });
    });

    groupInteractionRef.current = {
      type: 'resize',
      startX: e.clientX,
      startY: e.clientY,
      startBounds: bounds,
      startItems,
      direction
    };

    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch (err) { }
  }, [getSelectionBounds, selectedNodeIds, selectedShapeIds]); // Dependencies

  const handleGroupRotateStart = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    const bounds = getSelectionBounds();
    if (!bounds) return;
    setGroupTransform({ bounds, rotation: 0 });

    const startItems = new Map<string, { x: number, y: number, width: number, height: number, rotation: number }>();

    selectedNodeIds.forEach(id => {
      const n = nodesMapRef.current.get(id);
      // Nodes don't have rotation yet, default 0
      if (n) startItems.set(id, { x: n.x, y: n.y, width: n.width || 200, height: n.height || 100, rotation: 0 });
    });
    selectedShapeIds.forEach(id => {
      const s = shapesRef.current.find(shape => shape.id === id);
      if (s) startItems.set(id, { x: s.x, y: s.y, width: s.width, height: s.height, rotation: s.rotation || 0 });
    });

    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;

    groupInteractionRef.current = {
      type: 'rotate',
      startX: e.clientX,
      startY: e.clientY,
      startBounds: bounds,
      startItems,
      centerX,
      centerY
    };

    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch (err) { }
  }, [getSelectionBounds, selectedNodeIds, selectedShapeIds]);

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

  const handleRotateStart = (id: string, e: React.PointerEvent) => {
    e.stopPropagation();
    const shape = shapesRef.current.find(s => s.id === id);
    const node = nodesMapRef.current.get(id);
    const item = shape || node;

    if (!item) return;

    let width = item.width;
    let height = item.height;

    // specificNodeId logic for DOM access if dimensions missing
    if (!width || !height) {
      const el = document.getElementById(id);
      if (el) {
        const rect = el.getBoundingClientRect();
        width = rect.width / scaleRef.current;
        height = rect.height / scaleRef.current;
      } else {
        width = 200; // Fallback
        height = 100;
      }
    }

    const centerX = item.x + (width || 0) / 2;
    const centerY = item.y + (height || 0) / 2;

    rotatingShapeRef.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      startRotation: item.rotation || 0,
      centerX,
      centerY
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
    const hasSelection = selectedNodeIds.size > 0 || selectedShapeIds.size > 0 || selectedConnectionIds.size > 0;

    if (hasSelection) {
      setNodes(prev => prev.filter(n => !selectedNodeIds.has(n.id)));
      setShapes(prev => prev.filter(s => !selectedShapeIds.has(s.id)));
      setConnections(prev => prev.filter(c =>
        !selectedConnectionIds.has(c.id) &&
        !selectedNodeIds.has(c.source.nodeId) && !selectedNodeIds.has(c.target.nodeId) &&
        !selectedShapeIds.has(c.source.nodeId) && !selectedShapeIds.has(c.target.nodeId)
      ));
      clearSelection();
      addToHistory();
    }
  }, [selectedNodeIds, selectedShapeIds, selectedConnectionIds, clearSelection, setNodes, setShapes, setConnections, addToHistory]);

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

  const handleDoubleClick = (e: React.MouseEvent) => {
    // Check if clicking on UI
    const target = e.target as HTMLElement;
    if (target.closest('.main-toolbar') || target.closest('.properties-toolbar') || target.closest('.canvas-controls')) return;

    // Calculate canvas coordinates
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left - offsetRef.current.x) / scaleRef.current;
    const y = (e.clientY - rect.top - offsetRef.current.y) / scaleRef.current;

    // Hit test shapes (Top-most first)
    const hitShape = [...shapesRef.current].reverse().find(s => {
      if (!['rectangle', 'ellipse', 'diamond'].includes(s.type)) return false;
      return x >= s.x && x <= s.x + s.width && y >= s.y && y <= s.y + s.height;
    });

    if (hitShape) {
      setEditingShapeId(hitShape.id);
      setIsPanning(false); // Stop panning if triggered
    } else {
      // Create new text node if double clicking empty space? (Optional, maybe later)
    }
  };

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

  const updateShapeStyle = (id: string, style: Partial<ShapeData>) => {
    setShapes(prev => prev.map(s =>
      s.id === id ? { ...s, ...style } : s
    ));
  };

  const updateSelectedObjectStyle = (style: { color?: string, fillColor?: string, textColor?: string, width?: number, fontSize?: number }) => {
    const obj = selectedObject;
    if (!obj) return;

    if (obj.type === 'connection') {
      updateConnectionStyle(obj.id, style);
    } else if (obj.type === 'shape') {
      const shapeStyle: Partial<ShapeData> = {};
      if (style.color) shapeStyle.strokeColor = style.color;
      if (style.fillColor) shapeStyle.fillColor = style.fillColor;
      if (style.textColor) shapeStyle.textColor = style.textColor;
      if (style.width !== undefined) shapeStyle.strokeWidth = style.width;
      if (style.fontSize !== undefined) shapeStyle.fontSize = style.fontSize;
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


  const clearCanvas = () => {
    if (window.confirm('Are you sure you want to clear the entire canvas? This cannot be undone.')) {
      addToHistory();
      setNodes([]);
      setConnections([]);
      setShapes([]);
      clearSelection();
      setSelectionBox(null);
    }
  };

  return (
    <div
      className={`canvas-viewport ${isInteracting ? 'is-interacting' : ''}`}
      ref={viewportRef}
      style={{
        '--grid-opacity': backgroundOpacity * 0.1,
        cursor: isPanning ? 'grabbing' : (currentTool === 'select' ? 'var(--cursor-select)' : (currentTool === 'hand' ? 'grab' : 'crosshair'))
      } as any}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDoubleClick={handleDoubleClick}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="canvas-background-container" style={{ pointerEvents: 'none' }}>
        <div className={`canvas-background ${backgroundPattern}`} />
      </div>

      <StaticCanvas
        ref={staticCanvasRef}
        shapes={shapes}
        shapesRef={shapesRef}
        scale={scale}
        offset={offset}
        editingShapeId={editingShapeId}
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
            isSelected={selectedShapeIds.has(shape.id)}
            hideHandles={(selectedNodeIds.size + selectedShapeIds.size) > 1}
            onPointerDown={startLinking}
            onResizePointerDown={handleResizeStart}
            updateHandleOffsets={updateHandleOffsets}
            onRotatePointerDown={handleRotateStart}
            isLinking={!!linkingState}
            ignoreEvents={['rectangle', 'ellipse', 'diamond', 'arrow', 'pencil'].includes(currentTool)}
          />
        ))}

        {nodes.map(node => (
          <CanvasNode
            key={node.id}
            node={node}
            isSelected={selectedNodeIds.has(node.id)}
            hideHandles={(selectedNodeIds.size + selectedShapeIds.size) > 1}
            onPointerDown={handlePointerDownNode}
            onHeaderPointerDown={handleNodeDragStart}
            onResizePointerDown={handleResizeStart}
            onContentChange={handleContentChange}
            onToggleEditing={handleToggleEditingWrapper}

            onSync={syncNodeFromDisk}
            onRequestPermission={requestWritePermission}
            onSave={saveNodeToDisk}
            updateHandleOffsets={updateHandleOffsets}
            onRotatePointerDown={handleRotateStart}
            isLinking={!!linkingState}
            ignoreEvents={['rectangle', 'ellipse', 'diamond', 'arrow', 'pencil'].includes(currentTool)}
          />
        ))}

        {/* Group Selection Overlay */}
        {/* Group Selection Overlay */}
        {(groupTransform.bounds || selectionBounds) && (selectedNodeIds.size + selectedShapeIds.size) > 1 && (
          <GroupHandles
            bounds={groupTransform.bounds || selectionBounds || { x: 0, y: 0, width: 0, height: 0 }}
            rotation={groupTransform.rotation}
            onResizePointerDown={handleGroupResizeStart}
            onRotatePointerDown={handleGroupRotateStart}
          />
        )}

        {/* Shape Text Editor Overlay */}
        {editingShapeId && (() => {
          const shape = shapes.find(s => s.id === editingShapeId);
          if (!shape) return null;
          return (
            <div
              style={{
                position: 'absolute',
                left: shape.x,
                top: shape.y,
                width: shape.width,
                height: shape.height,
                transform: `rotate(${shape.rotation || 0}deg)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 100,
                pointerEvents: 'none' // Let clicks pass through container
              }}
            >
              <div
                contentEditable
                suppressContentEditableWarning
                spellCheck={false}
                style={{
                  minWidth: '10px',
                  maxWidth: '100%',
                  outline: 'none',
                  color: shape.strokeColor,
                  fontFamily: 'Inter, sans-serif',
                  fontSize: `${shape.fontSize || 14}px`,
                  textAlign: 'center',
                  whiteSpace: 'pre-wrap',
                  background: 'transparent',
                  caretColor: shape.strokeColor,
                  cursor: 'text',
                  pointerEvents: 'auto'
                }}
                onKeyDown={(e) => e.stopPropagation()}
                onBlur={(e) => {
                  updateShape(shape.id, { text: e.currentTarget.innerText });
                  setEditingShapeId(null);
                  addToHistory();
                }}
                ref={(el) => {
                  if (el && document.activeElement !== el) {
                    el.focus();
                  }
                }}
              >
                {shape.text}
              </div>
            </div>
          );
        })()}

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
                isSelected={selectedConnectionIds.has(conn.id)}
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

          {/* Selection Box Overlay */}
          {selectionBox && (() => {
            const box = getNormalizedRect(
              { x: selectionBox.startX, y: selectionBox.startY },
              { x: selectionBox.currentX, y: selectionBox.currentY }
            );
            return (
              <rect
                x={box.x}
                y={box.y}
                width={box.width}
                height={box.height}
                fill="rgba(59, 130, 246, 0.1)"
                stroke="rgba(59, 130, 246, 0.5)"
                strokeWidth="1"
                pointerEvents="none"
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
        clearCanvas={clearCanvas}
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
