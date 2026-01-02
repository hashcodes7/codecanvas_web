import { memo } from 'react'
import { getPathData } from '../../utils/canvasUtils'
import type { Connection } from '../../types'

export default memo(function ConnectionLine({
    conn,
    isSelected,
    startX,
    startY,
    endX,
    endY,
    onSelect
}: {
    conn: Connection
    isSelected: boolean
    startX: number
    startY: number
    endX: number
    endY: number
    onSelect: (id: string) => void
}) {
    return (
        <path
            id={`path-${conn.id}`}
            d={getPathData(startX, startY, endX, endY)}
            className={`connection-path ${isSelected ? 'selected' : ''}`}
            style={{
                stroke: conn.style?.color || 'var(--accent-primary)',
                strokeWidth: isSelected
                    ? (conn.style?.width || 2) + 2
                    : (conn.style?.width || 2)
            }}
            markerEnd={conn.type !== 'line' ? 'url(#arrowhead)' : ''}
            markerStart={conn.type === 'bi-arrow' ? 'url(#arrowhead-start)' : ''}
            onPointerDown={e => {
                e.stopPropagation()
                onSelect(conn.id)
            }}
        />
    )
})
