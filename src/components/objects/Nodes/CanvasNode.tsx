import React, { useRef, useEffect, memo, useMemo } from 'react';
import type { NodeData } from '../../../types';
import { getLanguageFromFilename } from '../../../utils/fileUtils';
import { activateSymbols, addGenericHandlesToCode } from '../../../utils/codeUtils';

interface CanvasNodeProps {
    node: NodeData;
    isSelected: boolean;
    onPointerDown: (id: string) => void;
    onHeaderPointerDown: (id: string, e: React.PointerEvent) => void;
    onResizePointerDown: (id: string, e: React.PointerEvent, direction: string) => void;
    onContentChange: (id: string, content: string) => void;
    onToggleEditing: (id: string, editing: boolean) => void;
    onSync: (id: string) => void;
    onRequestPermission: (id: string) => void;
    onSave: (id: string, content: string) => void;
    updateHandleOffsets: (id?: string) => void;
    ignoreEvents?: boolean;
    hideHandles?: boolean;
}

const CanvasNode = memo(({
    node,
    isSelected,
    onPointerDown,
    onHeaderPointerDown,
    onResizePointerDown,
    onContentChange,
    onToggleEditing,
    onSync,
    onRequestPermission,
    onSave,
    updateHandleOffsets,
    ignoreEvents = false,
    hideHandles = false
}: CanvasNodeProps) => {
    const codeRef = useRef<HTMLPreElement>(null);

    // Localized status logic to prevent object creation in parent
    const status = useMemo(() => {
        if (node.isDirty) {
            return { icon: 'bi-three-dots', text: 'Saving...', color: '#fbbf24', animate: true };
        }
        if (node.type === 'file' && !node.hasWritePermission) {
            return { icon: 'bi-lock', text: 'Read-only', color: '#9ca3af', animate: false };
        }
        return { icon: 'bi-check2', text: 'Saved', color: '#4ade80', animate: false };
    }, [node.isDirty, node.type, node.hasWritePermission]);

    useEffect(() => {
        if (codeRef.current && (window as any).Prism && !node.isEditing) {
            const el = codeRef.current;
            const code = el.querySelector('code');
            if (code && node.content) {
                (window as any).Prism.highlightElement(code);

                // Apply handles after highlighting
                activateSymbols(el);
                addGenericHandlesToCode(el);
                addGenericHandlesToCode(el);
                updateHandleOffsets(node.id);
            } else if (node.type === 'text') {
                activateSymbols(el);
                addGenericHandlesToCode(el);
                updateHandleOffsets(node.id);
            }
        }
    }, [node.content, node.isEditing, node.type, updateHandleOffsets, node.id, node.title]);

    return (
        <div
            id={node.id}
            className={`canvas-node ${isSelected ? 'selected' : ''} ${node.type}-node`}
            style={{
                left: node.x,
                top: node.y,
                width: node.width,
                height: node.height,
                maxWidth: node.width ? 'none' : undefined,
                maxHeight: node.height ? 'none' : undefined,
                transform: 'translate3d(0,0,0)', // Force GPU layer
                willChange: 'transform, width, height',
                pointerEvents: ignoreEvents ? 'none' : 'auto'
            }}
            onPointerDown={() => onPointerDown(node.id)}
        >
            <div
                className="node-header"
                onPointerDown={(e) => onHeaderPointerDown(node.id, e)}
            >
                <div className="node-title-container">
                    {node.type === 'file' && <i className="bi bi-file-earmark-code node-header-icon file-icon"></i>}
                    {node.type === 'text' && <i className="bi bi-sticky node-header-icon text-icon"></i>}
                    <span className="node-title">{node.title}</span>
                </div>
                <div className="status-container">
                    <span className="node-status-text" style={{ color: status.color }}>
                        {status.text}
                    </span>
                    <i
                        className={`bi ${status.icon} ${status.animate ? 'animate-pulse' : ''} node-status-icon`}
                        style={{
                            color: status.color,
                            animation: status.animate ? 'pulse 1.5s infinite' : 'none'
                        }}
                    />
                </div>
            </div>
            <div className="node-content">
                {node.type === 'text' ? (
                    node.isEditing ? (
                        <textarea
                            className="text-node-input"
                            placeholder="Type something..."
                            value={node.content}
                            onChange={(e) => onContentChange(node.id, e.target.value)}
                            onPointerDown={(e) => e.stopPropagation()}
                            autoFocus
                            onBlur={() => onToggleEditing(node.id, false)}
                        />
                    ) : (
                        <pre
                            ref={codeRef}
                            className="text-node-content code-editor"
                            onDoubleClick={() => onToggleEditing(node.id, true)}
                        >
                            {node.content || 'Double-click to edit'}
                        </pre>
                    )
                ) : (
                    <div className="node-content-flex">
                        {node.content !== undefined ? (
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
                                        onChange={(e) => onContentChange(node.id, e.target.value)}
                                        onPointerDown={(e) => e.stopPropagation()}
                                        autoFocus
                                        onBlur={() => onToggleEditing(node.id, false)}
                                    />
                                ) : (
                                    <pre
                                        ref={codeRef}
                                        className={`code-editor language-${getLanguageFromFilename(node.title)}`}
                                        onDoubleClick={() => {
                                            if (node.content !== undefined) {
                                                onToggleEditing(node.id, true);
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
                            <div className="node-empty-content">
                                <i className="bi bi-cloud-download node-empty-icon"></i>
                                Content not loaded from system
                            </div>
                        )}
                    </div>
                )}
                {node.type === 'file' && (
                    <div className="uri-footer">
                        <i className="bi bi-link-45deg"></i>
                        <span className="truncate" title={node.uri}>{node.uri}</span>
                        <button
                            className="sync-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                onSync(node.id);
                            }}
                            title="Sync with file on disk"
                        >
                            <i className="bi bi-arrow-repeat"></i>
                        </button>

                        {!node.hasWritePermission ? (
                            <button
                                className="sync-btn sync-btn-request"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRequestPermission(node.id);
                                }}
                                title="Request Edit Permission"
                            >
                                <i className="bi bi-pencil"></i>
                            </button>
                        ) : (
                            <button
                                className="sync-btn sync-btn-save"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSave(node.id, node.content || '');
                                }}
                                title="Save to Disk"
                            >
                                <i className="bi bi-save"></i>
                            </button>
                        )}
                    </div>
                )}
            </div>
            {/* Only show handles if not hidden (e.g. during multi-selection) */}
            {!ignoreEvents && !hideHandles && isSelected && (
                <>
                    <div className="handle handle-left-mid" data-handle-id="left-mid"></div>
                    <div className="handle handle-right-mid" data-handle-id="right-mid"></div>
                    <div className="handle handle-top-mid" data-handle-id="top-mid"></div>
                    <div className="handle handle-bottom-mid" data-handle-id="bottom-mid"></div>

                    <div
                        className="resize-handle"
                        onPointerDown={(e) => onResizePointerDown(node.id, e, 'bottom-right')}
                    />
                </>
            )}
        </div >
    );
});

export default CanvasNode;
