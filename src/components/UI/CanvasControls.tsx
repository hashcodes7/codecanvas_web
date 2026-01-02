import React from 'react';
import type { CanvasManifestItem } from '../../types';

interface CanvasControlsProps {
    scale: number;
    setScale: (scale: number | ((s: number) => number)) => void;
    resetTransform: () => void;
    isSidebarOpen: boolean;
    manifest: CanvasManifestItem[];
    currentProjectId: string;
}

const CanvasControls: React.FC<CanvasControlsProps> = ({
    scale,
    setScale,
    resetTransform,
    isSidebarOpen,
    manifest,
    currentProjectId
}) => {
    return (
        <>
            <div className="canvas-controls">
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
