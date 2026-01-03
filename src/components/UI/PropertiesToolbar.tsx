import React, { useState, useRef } from 'react';
import { PASTEL_COLORS } from '../../constants';
import type { Connection, ShapeData } from '../../types';

interface PropertiesToolbarProps {
    selectedObject: { type: 'node' | 'connection' | 'shape'; id: string } | null;
    deleteSelected: () => void;
    unlinkNode: (id: string) => void;
    updateSelectedObjectStyle: (style: { color?: string; fillColor?: string; textColor?: string; width?: number; fontSize?: number }) => void;
    connections: Connection[];
    shapes: ShapeData[];
    currentTool?: string;
    defaultShapeStyle?: { strokeColor: string; fillColor: string; textColor?: string; strokeWidth: number; fontSize?: number; opacity: number };
    updateDefaultShapeStyle?: (style: any) => void;
}

type SubPropertyType = 'color' | 'fill' | 'stroke' | 'font' | 'text-color';

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
    const [activeTab, setActiveTab] = useState<SubPropertyType | null>(null);
    const [panelTop, setPanelTop] = useState<number>(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const toggleTab = (tab: SubPropertyType, e: React.MouseEvent<HTMLButtonElement>) => {
        if (activeTab === tab) {
            setActiveTab(null);
        } else {
            setActiveTab(tab);
            if (containerRef.current) {
                const btnRect = e.currentTarget.getBoundingClientRect();
                const containerRect = containerRef.current.getBoundingClientRect();
                setPanelTop(btnRect.top - containerRect.top);
            }
        }
    };

    const renderSubPropertyPanel = (
        currentColor: string,
        currentFillColor: string,
        currentTextColor: string,
        currentWidth: number,
        currentFontSize: number,
        isDefaultMode: boolean = false
    ) => {
        if (!activeTab) return null;

        return (
            <div
                className="glass-panel"
                style={{
                    position: 'absolute',
                    right: 'calc(100% + 12px)',
                    top: panelTop,
                    width: 'max-content',
                    minWidth: '160px',
                    padding: '12px',
                    borderRadius: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    background: 'var(--bg-ui)',
                    border: '1px solid var(--border-subtle)',
                    boxShadow: 'var(--shadow-ui)',
                    animation: 'fadeIn 0.2s ease',
                    transition: 'top 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
            >
                <div style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '4px'
                }}>
                    {activeTab === 'color' ? 'Stroke Color' :
                        activeTab === 'fill' ? 'Fill Color' :
                            activeTab === 'text-color' ? 'Text Color' :
                                activeTab === 'stroke' ? 'Stroke Width' : 'Font Size'}
                </div>

                {(activeTab === 'color' || activeTab === 'fill' || activeTab === 'text-color') && (
                    <>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                            {activeTab === 'fill' && (
                                <button
                                    className="color-swatch-btn"
                                    style={{
                                        background: 'linear-gradient(to bottom right, transparent 45%, var(--text-muted) 50%, transparent 55%)',
                                        border: currentFillColor === 'transparent' ? '2px solid white' : '1px solid var(--border-subtle)',
                                        width: '24px',
                                        height: '24px'
                                    }}
                                    onClick={() => {
                                        if (isDefaultMode && updateDefaultShapeStyle) {
                                            updateDefaultShapeStyle((prev: any) => ({ ...prev, fillColor: 'transparent' }));
                                        } else {
                                            updateSelectedObjectStyle({ fillColor: 'transparent' });
                                        }
                                    }}
                                    title="None"
                                />
                            )}
                            {PASTEL_COLORS.map(color => (
                                <button
                                    key={color.value}
                                    className="color-swatch-btn"
                                    style={{
                                        backgroundColor: color.value.startsWith('var') ? (color.value === 'var(--accent-primary)' ? '#8b5cf6' : color.value) : color.value,
                                        width: '24px',
                                        height: '24px',
                                        border: (
                                            (activeTab === 'color' && currentColor === color.value) ||
                                            (activeTab === 'fill' && currentFillColor === color.value) ||
                                            (activeTab === 'text-color' && currentTextColor === color.value)
                                        ) ? '2px solid white' : '2px solid transparent'
                                    }}
                                    onClick={() => {
                                        if (isDefaultMode && updateDefaultShapeStyle) {
                                            if (activeTab === 'color') {
                                                updateDefaultShapeStyle((prev: any) => ({ ...prev, strokeColor: color.value }));
                                            } else if (activeTab === 'text-color') {
                                                updateDefaultShapeStyle((prev: any) => ({ ...prev, textColor: color.value }));
                                            } else {
                                                updateDefaultShapeStyle((prev: any) => ({ ...prev, fillColor: color.value }));
                                            }
                                        } else {
                                            if (activeTab === 'color') {
                                                updateSelectedObjectStyle({ color: color.value });
                                            } else if (activeTab === 'text-color') {
                                                updateSelectedObjectStyle({ textColor: color.value });
                                            } else {
                                                updateSelectedObjectStyle({ fillColor: color.value });
                                            }
                                        }
                                    }}
                                    title={color.name}
                                />
                            ))}
                        </div>

                        <div style={{ width: '100%', height: '1px', background: 'var(--border-subtle)', margin: '4px 0' }} />

                        {/* Custom Color Picker */}
                        <div className="custom-color-picker" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '0.7rem', color: 'var(--text-subtle)' }}>Custom</label>
                            <input
                                type="color"
                                value={(() => {
                                    const val = activeTab === 'color' ? currentColor :
                                        activeTab === 'fill' ? currentFillColor : currentTextColor;

                                    if (!val) return '#000000';
                                    if (val.startsWith('#')) return val;
                                    if (val === 'transparent') return '#ffffff';
                                    if (val.includes('accent-primary')) return '#8b5cf6';
                                    return '#000000';
                                })()}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (isDefaultMode && updateDefaultShapeStyle) {
                                        if (activeTab === 'color') {
                                            updateDefaultShapeStyle((prev: any) => ({ ...prev, strokeColor: val }));
                                        } else if (activeTab === 'text-color') {
                                            updateDefaultShapeStyle((prev: any) => ({ ...prev, textColor: val }));
                                        } else {
                                            updateDefaultShapeStyle((prev: any) => ({ ...prev, fillColor: val }));
                                        }
                                    } else {
                                        if (activeTab === 'color') {
                                            updateSelectedObjectStyle({ color: val });
                                        } else if (activeTab === 'text-color') {
                                            updateSelectedObjectStyle({ textColor: val });
                                        } else {
                                            updateSelectedObjectStyle({ fillColor: val });
                                        }
                                    }
                                }}
                                style={{
                                    width: '100%',
                                    height: '32px',
                                    padding: '0',
                                    border: '1px solid var(--border-medium)',
                                    borderRadius: '6px',
                                    background: 'var(--bg-node)',
                                    cursor: 'pointer'
                                }}
                            />
                        </div>
                    </>
                )}

                {activeTab === 'stroke' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <input
                            type="range"
                            min="1"
                            max="20"
                            step="1"
                            value={currentWidth}
                            onChange={(e) => {
                                const val = Number(e.target.value);
                                if (isDefaultMode && updateDefaultShapeStyle) {
                                    updateDefaultShapeStyle((prev: any) => ({ ...prev, strokeWidth: val }));
                                } else {
                                    updateSelectedObjectStyle({ width: val });
                                }
                            }}
                            style={{ width: '100%' }}
                        />
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', textAlign: 'center' }}>
                            {currentWidth}px
                        </div>
                    </div>
                )}

                {activeTab === 'font' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <input
                            type="range"
                            min="10"
                            max="100"
                            step="1"
                            value={currentFontSize}
                            onChange={(e) => {
                                const val = Number(e.target.value);
                                if (isDefaultMode && updateDefaultShapeStyle) {
                                    updateDefaultShapeStyle((prev: any) => ({ ...prev, fontSize: val }));
                                } else {
                                    updateSelectedObjectStyle({ fontSize: val });
                                }
                            }}
                            style={{ width: '100%' }}
                        />
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', textAlign: 'center' }}>
                            {currentFontSize}px
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // Mode 1: Object Selected
    if (selectedObject) {
        const shape = selectedObject.type === 'shape' ? shapes.find(s => s.id === selectedObject.id) : null;
        const conn = selectedObject.type === 'connection' ? connections.find(c => c.id === selectedObject.id) : null;

        const currentColor = (conn?.style?.color || shape?.strokeColor) || 'var(--accent-primary)';
        const currentFillColor = shape?.fillColor || 'transparent';
        const currentTextColor = shape?.textColor || shape?.strokeColor || 'var(--text-main)';
        const currentWidth = (conn?.style?.width || shape?.strokeWidth) || 2;
        const currentFontSize = shape?.fontSize || 14;

        const supportsFill = selectedObject.type === 'shape' && ['rectangle', 'ellipse', 'diamond'].includes(shape?.type || '');
        // Supports Text Color if it supports Text (same condition)
        const supportsText = supportsFill;

        return (
            <div className="properties-toolbar" ref={containerRef} onPointerDown={(e) => e.stopPropagation()}>
                {renderSubPropertyPanel(currentColor, currentFillColor, currentTextColor, currentWidth, currentFontSize, false)}

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

                        {/* Stroke Color Toggle */}
                        <div className="toolbar-group">
                            <button
                                className={`color-swatch-btn ${activeTab === 'color' ? 'active' : ''}`}
                                style={{
                                    backgroundColor: currentColor.startsWith('var') ? (currentColor === 'var(--accent-primary)' ? '#8b5cf6' : currentColor) : currentColor,
                                    border: activeTab === 'color' ? '2px solid white' : 'none'
                                }}
                                onClick={(e) => toggleTab('color', e)}
                                title="Stroke Color"
                            />
                        </div>

                        {/* Fill Color Toggle (Shapes Only) */}
                        {supportsFill && (
                            <div className="toolbar-group">
                                <button
                                    className={`color-swatch-btn ${activeTab === 'fill' ? 'active' : ''}`}
                                    style={{
                                        backgroundColor: currentFillColor && currentFillColor !== 'transparent' ?
                                            (currentFillColor.startsWith('var') ? (currentFillColor === 'var(--accent-primary)' ? '#8b5cf6' : currentFillColor) : currentFillColor)
                                            : 'transparent',
                                        border: activeTab === 'fill' ? '2px solid white' : '1px solid var(--border-subtle)',
                                        background: currentFillColor === 'transparent' ? 'linear-gradient(to bottom right, transparent 45%, var(--text-muted) 50%, transparent 55%)' : undefined
                                    }}
                                    onClick={(e) => toggleTab('fill', e)}
                                    title="Fill Color"
                                />
                            </div>
                        )}

                        <div className="toolbar-divider"></div>

                        {/* Stroke Width Toggle */}
                        <div className="toolbar-group">
                            <button
                                className={`toolbar-btn ${activeTab === 'stroke' ? 'active' : ''}`}
                                onClick={(e) => toggleTab('stroke', e)}
                                title="Stroke Width"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M3 17h18v-2H3v2zm0 3h18v-1H3v1zm0-7h18v-3H3v3zm0-9v4h18V4H3z" />
                                </svg>
                            </button>
                        </div>

                        {supportsText && (
                            <>
                                <div className="toolbar-divider"></div>
                                {/* Font Size Toggle */}
                                <div className="toolbar-group">
                                    <button
                                        className={`toolbar-btn ${activeTab === 'font' ? 'active' : ''}`}
                                        onClick={(e) => toggleTab('font', e)}
                                        title="Font Size"
                                    >
                                        <span style={{ fontSize: '16px', fontWeight: 'bold' }}>T</span>
                                    </button>
                                </div>
                                {/* Font Color Toggle */}
                                <div className="toolbar-group">
                                    <button
                                        className={`toolbar-btn ${activeTab === 'text-color' ? 'active' : ''}`}
                                        onClick={(e) => toggleTab('text-color', e)}
                                        title="Text Color"
                                        style={{
                                            border: activeTab === 'text-color' ? '1px solid var(--accent-primary)' : 'none',
                                            color: currentTextColor.startsWith('var') ? undefined : currentTextColor
                                        }}
                                    >
                                        <div style={{
                                            width: '18px', height: '18px', background: currentTextColor,
                                            borderRadius: '50%', border: '1px solid var(--border-subtle)'
                                        }}></div>
                                    </button>
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
    const supportsFillDefault = ['rectangle', 'ellipse', 'diamond'].includes(currentTool);

    if (isShapeTool && defaultShapeStyle && updateDefaultShapeStyle) {
        const currentFill = (defaultShapeStyle as any).fillColor || 'transparent';
        const currentTextClr = defaultShapeStyle.textColor || defaultShapeStyle.strokeColor || '#d1d5db';
        const currentFontSize = defaultShapeStyle.fontSize || 14;

        return (
            <div className="properties-toolbar" ref={containerRef} onPointerDown={(e) => e.stopPropagation()}>
                {renderSubPropertyPanel(
                    defaultShapeStyle.strokeColor,
                    currentFill,
                    currentTextClr,
                    defaultShapeStyle.strokeWidth,
                    currentFontSize,
                    true
                )}

                <div className="properties-header">
                    {currentTool}
                </div>

                {/* Stroke Color */}
                <div className="toolbar-group">
                    <button
                        className={`color-swatch-btn ${activeTab === 'color' ? 'active' : ''}`}
                        style={{
                            backgroundColor: defaultShapeStyle.strokeColor,
                            border: activeTab === 'color' ? '2px solid white' : 'none'
                        }}
                        onClick={(e) => toggleTab('color', e)}
                        title="Stroke Color"
                    />
                </div>

                {/* Fill Color */}
                {supportsFillDefault && (
                    <div className="toolbar-group">
                        <button
                            className={`color-swatch-btn ${activeTab === 'fill' ? 'active' : ''}`}
                            style={{
                                backgroundColor: currentFill && currentFill !== 'transparent' ? currentFill : 'transparent',
                                border: activeTab === 'fill' ? '2px solid white' : '1px solid var(--border-subtle)',
                                background: currentFill === 'transparent' ? 'linear-gradient(to bottom right, transparent 45%, var(--text-muted) 50%, transparent 55%)' : undefined
                            }}
                            onClick={(e) => toggleTab('fill', e)}
                            title="Fill Color"
                        />
                    </div>
                )}

                <div className="toolbar-divider"></div>

                {/* Stroke Width Toggle */}
                <div className="toolbar-group">
                    <button
                        className={`toolbar-btn ${activeTab === 'stroke' ? 'active' : ''}`}
                        onClick={(e) => toggleTab('stroke', e)}
                        title="Stroke Width"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M3 17h18v-2H3v2zm0 3h18v-1H3v1zm0-7h18v-3H3v3zm0-9v4h18V4H3z" />
                        </svg>
                    </button>
                </div>

                {/* Font Size & Color Toggle (Defaults) */}
                {supportsFillDefault && (
                    <>
                        <div className="toolbar-divider"></div>

                        {/* Font Size Toggle */}
                        <div className="toolbar-group">
                            <button
                                className={`toolbar-btn ${activeTab === 'font' ? 'active' : ''}`}
                                onClick={(e) => toggleTab('font', e)}
                                title="Font Size"
                            >
                                <span style={{ fontSize: '16px', fontWeight: 'bold' }}>T</span>
                            </button>
                        </div>

                        {/* Text Color Toggle */}
                        <div className="toolbar-group">
                            <button
                                className={`toolbar-btn ${activeTab === 'text-color' ? 'active' : ''}`}
                                onClick={(e) => toggleTab('text-color', e)}
                                title="Text Color"
                                style={{
                                    border: activeTab === 'text-color' ? '1px solid var(--accent-primary)' : 'none',
                                    color: currentTextClr.startsWith('var') ? undefined : currentTextClr
                                }}
                            >
                                <div style={{
                                    width: '18px', height: '18px', background: currentTextClr,
                                    borderRadius: '50%', border: '1px solid var(--border-subtle)'
                                }}></div>
                            </button>
                        </div>
                    </>
                )}

            </div>
        );
    }

    return null;
};

export default PropertiesToolbar;
