import React from 'react';
import { PASTEL_COLORS, THICKNESS_OPTIONS } from '../../constants';
import type { Connection, ShapeData } from '../../types';

interface PropertiesToolbarProps {
    selectedObject: { type: 'node' | 'connection' | 'shape'; id: string } | null;
    deleteSelected: () => void;
    unlinkNode: (id: string) => void;
    updateSelectedObjectStyle: (style: { color?: string; width?: number; fontSize?: number }) => void;
    connections: Connection[];
    shapes: ShapeData[];
    currentTool?: string;
    defaultShapeStyle?: { strokeColor: string; strokeWidth: number; opacity: number };
    updateDefaultShapeStyle?: (style: any) => void;
}

const PropertiesToolbar: React.FC<PropertiesToolbarProps> = ({
    selectedObject,
    deleteSelected,
    unlinkNode,
    updateSelectedObjectStyle,
    connections,
    shapes,
    currentTool = 'select',
    defaultShapeStyle,
    updateDefaultShapeStyle
}) => {
    // Mode 1: Object Selected
    if (selectedObject) {
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
                        <div className="toolbar-group" title="Stroke Width">
                            <input
                                type="range"
                                min="1"
                                max="20"
                                step="1"
                                value={
                                    selectedObject.type === 'connection'
                                        ? (connections.find(c => c.id === selectedObject.id)?.style?.width || 2)
                                        : (shapes.find(s => s.id === selectedObject.id)?.strokeWidth || 2)
                                }
                                onChange={(e) => updateSelectedObjectStyle({ width: Number(e.target.value) })}
                            />
                        </div>

                        {selectedObject.type === 'shape' && (
                            <>
                                <div className="toolbar-divider"></div>
                                <div className="toolbar-group" title="Font Size">
                                    <span style={{ fontSize: '10px', color: '#888', marginRight: '4px' }}>T</span>
                                    <input
                                        type="range"
                                        min="10"
                                        max="100"
                                        step="1"
                                        value={shapes.find(s => s.id === selectedObject.id)?.fontSize || 14}
                                        onChange={(e) => updateSelectedObjectStyle({ fontSize: Number(e.target.value) })}
                                    />
                                </div>
                            </>
                        )}
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
    }

    // Mode 2: Tool Selected (Defaults)
    const isShapeTool = ['rectangle', 'ellipse', 'diamond', 'arrow', 'pencil'].includes(currentTool);

    if (isShapeTool && defaultShapeStyle && updateDefaultShapeStyle) {
        return (
            <div className="properties-toolbar" onPointerDown={(e) => e.stopPropagation()}>
                <div className="properties-header">
                    {currentTool} Props
                </div>

                <div className="toolbar-group">
                    {PASTEL_COLORS.map(color => {
                        const isActive = defaultShapeStyle.strokeColor === color.value;
                        return (
                            <button
                                key={color.value}
                                className={`color-swatch-btn ${isActive ? 'active' : ''}`}
                                style={{ backgroundColor: color.value.startsWith('var') ? (color.value === 'var(--accent-primary)' ? '#8b5cf6' : color.value) : color.value }}
                                onClick={() => updateDefaultShapeStyle((prev: any) => ({ ...prev, strokeColor: color.value }))}
                                title={color.name}
                            />
                        );
                    })}
                </div>

                <div className="toolbar-divider"></div>

                <div className="toolbar-group">
                    <select
                        className="toolbar-select"
                        onChange={(e) => updateDefaultShapeStyle((prev: any) => ({ ...prev, strokeWidth: Number(e.target.value) }))}
                        value={defaultShapeStyle.strokeWidth}
                    >
                        {THICKNESS_OPTIONS.map(w => (
                            <option key={w} value={w}>{w}px</option>
                        ))}
                    </select>
                </div>
            </div>
        );
    }

    return null;
};

export default PropertiesToolbar;
