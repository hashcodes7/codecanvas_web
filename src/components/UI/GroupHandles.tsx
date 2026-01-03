import React, { memo } from 'react';

interface GroupHandlesProps {
    bounds: { x: number, y: number, width: number, height: number };
    rotation?: number;
    onResizePointerDown: (e: React.PointerEvent, direction: string) => void;
    onRotatePointerDown: (e: React.PointerEvent) => void;
}

const GroupHandles: React.FC<GroupHandlesProps> = memo(({
    bounds,
    rotation = 0,
    onResizePointerDown,
    onRotatePointerDown
}) => {
    const { x, y, width, height } = bounds;

    // Common handle styles
    const handleStyle: React.CSSProperties = {
        position: 'absolute',
        width: '10px',
        height: '10px',
        background: 'var(--accent-secondary)', // Distinct color for group
        border: '1px solid white',
        borderRadius: '50%',
        zIndex: 100, // Above everything
        pointerEvents: 'auto',
    };

    return (
        <div
            className="group-selection-box"
            style={{
                position: 'absolute',
                left: x,
                top: y,
                width: width,
                height: height,
                transform: `rotate(${rotation}deg)`,
                border: '1px dashed var(--accent-secondary)',
                boxSizing: 'border-box',
                pointerEvents: 'none',
                zIndex: 90
            }}
        >
            {/* We can add a specialized "drag handler" overlay but typically you just drag the items. */}

            {/* Resize Handles */}
            {/* Top Left */}
            <div
                style={{ ...handleStyle, left: -5, top: -5, cursor: 'nwse-resize' }}
                onPointerDown={(e) => onResizePointerDown(e, 'top-left')}
            />
            {/* Top Right */}
            <div
                style={{ ...handleStyle, right: -5, top: -5, cursor: 'nesw-resize' }}
                onPointerDown={(e) => onResizePointerDown(e, 'top-right')}
            />
            {/* Bottom Left */}
            <div
                style={{ ...handleStyle, left: -5, bottom: -5, cursor: 'nesw-resize' }}
                onPointerDown={(e) => onResizePointerDown(e, 'bottom-left')}
            />
            {/* Bottom Right */}
            <div
                style={{ ...handleStyle, right: -5, bottom: -5, cursor: 'nwse-resize' }}
                onPointerDown={(e) => onResizePointerDown(e, 'bottom-right')}
            />

            {/* Mid Handles */}
            <div style={{ ...handleStyle, left: '50%', top: -5, transform: 'translateX(-50%)', cursor: 'ns-resize' }} onPointerDown={(e) => onResizePointerDown(e, 'top')} />
            <div style={{ ...handleStyle, left: '50%', bottom: -5, transform: 'translateX(-50%)', cursor: 'ns-resize' }} onPointerDown={(e) => onResizePointerDown(e, 'bottom')} />
            <div style={{ ...handleStyle, top: '50%', left: -5, transform: 'translateY(-50%)', cursor: 'ew-resize' }} onPointerDown={(e) => onResizePointerDown(e, 'left')} />
            <div style={{ ...handleStyle, top: '50%', right: -5, transform: 'translateY(-50%)', cursor: 'ew-resize' }} onPointerDown={(e) => onResizePointerDown(e, 'right')} />

            {/* Rotation Handle */}
            <div
                style={{
                    position: 'absolute',
                    left: '50%',
                    top: -25, // Above the box
                    width: '10px',
                    height: '10px',
                    background: 'var(--bg-card)', // Hollow look (matches background)
                    border: '2px solid var(--accent-secondary)', // Color only on border
                    borderRadius: '50%',
                    transform: 'translateX(-50%)',
                    cursor: 'grab',
                    pointerEvents: 'auto',
                    zIndex: 100
                }}
                onPointerDown={onRotatePointerDown}
            />
        </div>
    );
});

export default GroupHandles;
