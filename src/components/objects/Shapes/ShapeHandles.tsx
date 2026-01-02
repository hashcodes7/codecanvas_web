import React, { memo, useEffect } from 'react';

/* =========================
   Types
   ========================= */

export interface ShapeData {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface ShapeHandlesProps {
    shape: ShapeData;
    isSelected: boolean;

    onPointerDown: (shapeId: string, handleId: string) => void;
    onResizePointerDown: (
        id: string,
        e: React.PointerEvent,
        direction: string
    ) => void;

    updateHandleOffsets: (id?: string) => void;
}

/* =========================
   Component
   ========================= */

const ShapeHandles: React.FC<ShapeHandlesProps> = memo(
    ({
        shape,
        isSelected,
        onPointerDown,
        onResizePointerDown,
        updateHandleOffsets,
    }) => {
        useEffect(() => {
            updateHandleOffsets(shape.id);
        }, [shape.id, shape.width, shape.height, updateHandleOffsets]);

        return (
            <div
                id={`handles-${shape.id}`}
                className={`shape-handle-container ${isSelected ? 'selected' : ''}`}
                style={{
                    position: 'absolute',
                    left: shape.x,
                    top: shape.y,
                    width: shape.width,
                    height: shape.height,
                    zIndex: 5,
                }}
            >
                {/* ---------- Corner Resize Handles ---------- */}
                <div
                    className="handle handle-top-left resize-sq"
                    onPointerDown={(e) =>
                        onResizePointerDown(shape.id, e, 'top-left')
                    }
                />
                <div
                    className="handle handle-top-right resize-sq"
                    onPointerDown={(e) =>
                        onResizePointerDown(shape.id, e, 'top-right')
                    }
                />
                <div
                    className="handle handle-bottom-left resize-sq"
                    onPointerDown={(e) =>
                        onResizePointerDown(shape.id, e, 'bottom-left')
                    }
                />
                <div
                    className="handle handle-bottom-right resize-sq"
                    onPointerDown={(e) =>
                        onResizePointerDown(shape.id, e, 'bottom-right')
                    }
                />

                {/* ---------- Mid-point Connection Handles ---------- */}
                <div
                    className="handle handle-left-mid"
                    data-handle-id="left-mid"
                    onPointerDown={(e) => {
                        e.stopPropagation();
                        onPointerDown(shape.id, 'left-mid');
                    }}
                />
                <div
                    className="handle handle-right-mid"
                    data-handle-id="right-mid"
                    onPointerDown={(e) => {
                        e.stopPropagation();
                        onPointerDown(shape.id, 'right-mid');
                    }}
                />
                <div
                    className="handle handle-top-mid"
                    data-handle-id="top-mid"
                    onPointerDown={(e) => {
                        e.stopPropagation();
                        onPointerDown(shape.id, 'top-mid');
                    }}
                />
                <div
                    className="handle handle-bottom-mid"
                    data-handle-id="bottom-mid"
                    onPointerDown={(e) => {
                        e.stopPropagation();
                        onPointerDown(shape.id, 'bottom-mid');
                    }}
                />
            </div>
        );
    }
);

export default ShapeHandles;
