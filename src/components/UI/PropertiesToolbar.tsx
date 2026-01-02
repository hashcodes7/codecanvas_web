import React from 'react';
import { PASTEL_COLORS, THICKNESS_OPTIONS } from '../../constants';
import type { Connection, ShapeData } from '../../types';

interface PropertiesToolbarProps {
    selectedObject: { type: 'node' | 'connection' | 'shape'; id: string } | null;
    deleteSelected: () => void;
    unlinkNode: (id: string) => void;
    updateSelectedObjectStyle: (style: { color?: string; width?: number }) => void;
    connections: Connection[];
    shapes: ShapeData[];
}

const PropertiesToolbar: React.FC<PropertiesToolbarProps> = ({
    selectedObject,
    deleteSelected,
    unlinkNode,
    updateSelectedObjectStyle,
    connections,
    shapes
}) => {
    if (!selectedObject) return null;

    return (
        <div className="properties-toolbar" onPointerDown={(e) => e.stopPropagation()}>
            <div className="properties-header">
                {selectedObject.type} {selectedObject.type === 'node' ? 'Block' : ''}
            </div>

            <div className="toolbar-group">
                <button
                    className="toolbar-btn danger"
                    onClick={deleteSelected}
                    title="Delete Selected Object"
                >
                    <i className="bi bi-trash"></i>
                </button>
            </div>

            {(selectedObject.type === 'connection' || selectedObject.type === 'shape') && (
                <>
                    <div className="toolbar-divider"></div>
                    <div className="toolbar-group">
                        {PASTEL_COLORS.map(color => {
                            const isActive = selectedObject.type === 'connection'
                                ? connections.find(c => c.id === selectedObject.id)?.style?.color === color.value
                                : shapes.find(s => s.id === selectedObject.id)?.strokeColor === color.value;

                            return (
                                <button
                                    key={color.value}
                                    className={`color-swatch-btn ${isActive ? 'active' : ''}`}
                                    style={{ backgroundColor: color.value.startsWith('var') ? (color.value === 'var(--accent-primary)' ? '#8b5cf6' : color.value) : color.value }}
                                    onClick={() => updateSelectedObjectStyle({ color: color.value })}
                                    title={color.name}
                                />
                            );
                        })}
                    </div>
                    <div className="toolbar-divider"></div>
                    <div className="toolbar-group">
                        <select
                            className="toolbar-select"
                            onChange={(e) => updateSelectedObjectStyle({ width: Number(e.target.value) })}
                            value={
                                selectedObject.type === 'connection'
                                    ? (connections.find(c => c.id === selectedObject.id)?.style?.width || 2)
                                    : (shapes.find(s => s.id === selectedObject.id)?.strokeWidth || 2)
                            }
                        >
                            {THICKNESS_OPTIONS.map(w => (
                                <option key={w} value={w}>{w}px</option>
                            ))}
                        </select>
                    </div>
                </>
            )}

            {selectedObject.type === 'node' && (
                <>
                    <div className="toolbar-divider"></div>
                    <div className="toolbar-group">
                        <button
                            className="toolbar-btn"
                            onClick={() => unlinkNode(selectedObject.id)}
                            title="Unlink All Connections"
                        >
                            <i className="bi bi-scissors"></i>
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default PropertiesToolbar;
