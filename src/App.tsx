import React, { useState, useRef, useEffect } from 'react';
import './index.css';
import { FileStorage } from './storage';
import { FileNodeService } from './FileNodeService';
import type { NodeData, Connection } from './types';
import { INITIAL_NODES, STORAGE_KEYS } from './constants';
import { getPathData } from './utils/canvasUtils';
import { getLanguageFromFilename } from './utils/fileUtils';
import { activateSymbols, addGenericHandlesToCode } from './utils/codeUtils';




function App() {
  const getNodeStatus = (node: NodeData) => {
    if (node.isDirty) {
      return { icon: 'bi-three-dots', text: 'Saving...', color: '#fbbf24', animate: true };
    }
    if (node.type === 'file' && !node.hasWritePermission) {
      return { icon: 'bi-lock', text: 'Read-only', color: '#9ca3af', animate: false };
    }
    return { icon: 'bi-check2', text: 'Saved', color: '#4ade80', animate: false };
  };

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

  const viewportRef = useRef<HTMLDivElement>(null);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const draggingNodeId = useRef<string | null>(null);
  const resizingNodeRef = useRef<{ id: string, startX: number, startY: number, startW: number, startH: number } | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);

  // Touch gestures state
  const lastTouchDistance = useRef<number | null>(null);
  const initialPinchCenter = useRef<{ x: number, y: number } | null>(null);

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

      // Clean nodes for localStorage: remove content from file type nodes
      // Also clear isDirty flag since we just saved
      const persistentNodes = nodes.map(node => {
        if (node.type === 'file') {
          const { content, ...rest } = node;
          return { ...rest, isDirty: false };
        }
        return { ...node, isDirty: false };
      });

      // Update state to reflect saved status
      setNodes(prev => prev.map(n => ({ ...n, isDirty: false })));

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
    } catch (e) { console.warn('Failed to capture pointer'); }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    const isNode = !!target.closest('.canvas-node');
    const isHandle = !!target.closest('[data-handle-id]');
    const isConnection = !!target.closest('.connection-path');
    const isUI = !!target.closest('.main-toolbar') || !!target.closest('.canvas-controls') || !!target.closest('.glass-container');

    // Clear selections if clicking the empty canvas (not a node, handle, connection, or UI)
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
    } else if (resizingNodeRef.current) {
      const { id, startX, startY, startW, startH } = resizingNodeRef.current;
      const deltaX = (e.clientX - startX) / scale;
      const deltaY = (e.clientY - startY) / scale;

      setNodes(prev => prev.map(node =>
        node.id === id
          ? {
            ...node,
            width: Math.max(200, startW + deltaX),
            height: Math.max(100, startH + deltaY)
          }
          : node
      ));
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
          type: defaultLineType
        };
        setConnections(prev => [...prev, newConnection]);
      }
      setLinkingState(null);
    }

    setIsPanning(false);
    draggingNodeId.current = null;
    resizingNodeRef.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (err) { }
  };

  const handleNodeDragStart = (id: string, e: React.PointerEvent) => {
    e.stopPropagation();
    draggingNodeId.current = id;
    setSelectedNodeId(id);
    setSelectedConnectionId(null); // Clear connection selection when a node is selected
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const deleteSelected = () => {
    if (selectedNodeId) {
      setNodes(prev => prev.filter(n => n.id !== selectedNodeId));
      setConnections(prev => prev.filter(c => c.source.nodeId !== selectedNodeId && c.target.nodeId !== selectedNodeId));
      setSelectedNodeId(null);
    } else if (selectedConnectionId) {
      setConnections(prev => prev.filter(c => c.id !== selectedConnectionId));
      setSelectedConnectionId(null);
    }
  };

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



  React.useEffect(() => {
    // Function to apply handles to a specific container
    const applyHandles = (container: HTMLElement) => {
      // First, try standard Prism tokens
      activateSymbols(container);
      // Then catch anything Prism missed or plain text
      addGenericHandlesToCode(container);
    };

    if ((window as any).Prism) {
      // Highlight Code Blocks
      document.querySelectorAll('.code-editor code').forEach((codeBlock: any) => {
        // Force highlight immediately (async callback)
        (window as any).Prism.highlightElement(codeBlock, false, () => {
          const preElement = codeBlock.parentElement;
          if (preElement) applyHandles(preElement);
          updateHandleOffsets();
        });
      });

      // Handle Plain Text Nodes
      document.querySelectorAll('.text-node-content').forEach((textBlock: any) => {
        applyHandles(textBlock);
      });

      // Poll ensures that if Prism is slow or DOM updates lag, we still get handles
      const pollInterval = setInterval(() => {
        let appliedCount = 0;
        document.querySelectorAll('.code-editor').forEach((editor: any) => {
          // Check if we have handles already
          if (editor.querySelectorAll('[data-handle-id]').length === 0) {
            const code = editor.querySelector('code');
            if (code) {
              // Re-apply handles if missing
              applyHandles(editor);
            }
          } else {
            appliedCount++;
          }
        });

        if (appliedCount > 0 && appliedCount === document.querySelectorAll('.code-editor').length) {
          updateHandleOffsets(); // Final position update
          clearInterval(pollInterval);
        }
      }, 500);

      // Timeout safety to clear interval
      setTimeout(() => clearInterval(pollInterval), 5000);
    } else {
      // Fallback if Prism is not present at all
      document.querySelectorAll('.code-editor').forEach((editor: any) => {
        applyHandles(editor);
      });
    }
  }, [nodes]);



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
              height: node.height,
              maxWidth: node.width ? 'none' : undefined,
              maxHeight: node.height ? 'none' : undefined
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {(() => {
                  const status = getNodeStatus(node);
                  return (
                    <>
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
                    </>
                  );
                })()}
              </div>
            </div>
            <div className="node-content">
              {node.type === 'text' ? (
                node.isEditing ? (
                  <textarea
                    className="text-node-input"
                    placeholder="Type something..."
                    value={node.content}
                    onChange={(e) => {
                      setNodes(prev => prev.map(n =>
                        n.id === node.id ? { ...n, content: e.target.value, isDirty: true } : n
                      ));
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    autoFocus
                    onBlur={() => setNodes(prev => prev.map(n => n.id === node.id ? { ...n, isEditing: false } : n))}
                  />
                ) : (
                  <pre
                    className="text-node-content code-editor"
                    onDoubleClick={() => setNodes(prev => prev.map(n => n.id === node.id ? { ...n, isEditing: true } : n))}
                  >
                    {node.content || 'Double-click to edit'}
                  </pre>
                )
              ) : (
                <div style={{ display: 'flex', flex: 1, minWidth: 0 }}>
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
                              n.id === node.id ? { ...n, content: e.target.value, isDirty: true } : n
                            ));
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                          autoFocus
                          onBlur={() => setNodes(prev => prev.map(n => n.id === node.id ? { ...n, isEditing: false } : n))}
                        />
                      ) : (
                        <pre
                          className={`code-editor language-${getLanguageFromFilename(node.title)}`}
                          onDoubleClick={() => {
                            // Only allow edit if write permission/loaded
                            if (node.content) {
                              setNodes(prev => prev.map(n => n.id === node.id ? { ...n, isEditing: true } : n));
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
              onPointerDown={(e) => handleResizeStart(node.id, e)}
            />
          </div>
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
            const isSelected = selectedConnectionId === conn.id;
            return (
              <path
                key={conn.id}
                d={getPathData(start.x, start.y, end.x, end.y)}
                className={`connection-path ${isSelected ? 'selected' : ''}`}
                style={{
                  stroke: conn.style?.color || 'var(--accent-primary)',
                  strokeWidth: isSelected ? (conn.style?.width || 2) + 2 : (conn.style?.width || 2)
                }}
                markerEnd={conn.type === 'arrow' || conn.type === 'bi-arrow' ? "url(#arrowhead)" : ""}
                markerStart={conn.type === 'bi-arrow' ? "url(#arrowhead-start)" : ""}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setSelectedConnectionId(conn.id);
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
    </div >
  );
}

export default App;
