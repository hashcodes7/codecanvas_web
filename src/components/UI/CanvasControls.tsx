import React from 'react';
import type { CanvasManifestItem } from '../../types';

interface CanvasControlsProps {
    scale: number;
    setScale: (scale: number | ((s: number) => number)) => void;
    resetTransform: () => void;
    isSidebarOpen: boolean;
    manifest: CanvasManifestItem[];
    currentProjectId: string;
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
}

const CanvasControls: React.FC<CanvasControlsProps> = ({
    scale,
    setScale,
    resetTransform,
    isSidebarOpen,
    manifest,
    currentProjectId,
    undo,
    redo,
    canUndo,
    canRedo
}) => {
    return (
        <>
            <div className="canvas-controls">
                <button className="control-btn" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" style={{ opacity: canUndo ? 1 : 0.5 }}>↩</button>
                <button className="control-btn" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)" style={{ opacity: canRedo ? 1 : 0.5 }}>↪</button>
                <div style={{ width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.1)', margin: '0 4px' }}></div>
                <button className="control-btn" onClick={() => setScale((s: number) => Math.min(s + 0.1, 5))}>+</button>
                <button className="control-btn" onClick={() => setScale((s: number) => Math.max(s - 0.1, 0.1))}>−</button>
                <button className="control-btn" onClick={resetTransform}>⟲</button>
            </div>
            {!isSidebarOpen && (
                <div className="glass-container canvas-info-glass">
                    {manifest.find(m => m.id === currentProjectId)?.name} • {Math.round(scale * 100)}%
                </div>
            )}
        </>
    );
};

export default CanvasControls;
