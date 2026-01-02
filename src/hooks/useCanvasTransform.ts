import { useState, useRef, useEffect, useCallback } from 'react';

export interface Transform {
    scale: number;
    offset: { x: number; y: number };
}

export const useCanvasTransform = () => {
    const [scale, setScale] = useState<number>(1);
    const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

    const scaleRef = useRef(scale);
    const offsetRef = useRef(offset);

    // Keep refs in sync with state for transient updates
    useEffect(() => {
        scaleRef.current = scale;
    }, [scale]);

    useEffect(() => {
        offsetRef.current = offset;
    }, [offset]);

    const resetTransform = useCallback(() => {
        setScale(1);
        setOffset({ x: 0, y: 0 });
        scaleRef.current = 1;
        offsetRef.current = { x: 0, y: 0 };
    }, []);

    const updateTransform = useCallback((newScale: number, newOffset: { x: number; y: number }) => {
        scaleRef.current = newScale;
        offsetRef.current = newOffset;
        // We don't necessarily call setScale/setOffset here to avoid React lag during high-frequency events (panning/zooming)
        // The caller should call syncState() when appropriate (e.g., onPointerUp)
    }, []);

    const syncState = useCallback(() => {
        setScale(scaleRef.current);
        setOffset({ ...offsetRef.current });
    }, []);

    return {
        scale,
        offset,
        scaleRef,
        offsetRef,
        setScale,
        setOffset,
        resetTransform,
        updateTransform,
        syncState
    };
};
