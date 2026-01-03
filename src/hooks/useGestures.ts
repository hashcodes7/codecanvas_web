/**
 * Manages touch gestures (pinch-zoom) and mouse wheel interactions for the canvas.
 * Implements non-passive event listeners for proper browser zoom prevention.
 */
import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';

interface UseGesturesProps {
    viewportRef: MutableRefObject<HTMLDivElement | null>;
    scaleRef: MutableRefObject<number>;
    offsetRef: MutableRefObject<{ x: number; y: number }>;
    scale: number; // Reactive state if needed? (Usually refs are enough for events)
    updateCanvasDisplay: () => void;
    syncState: () => void;
    setIsInteracting: (is: boolean) => void;
    isInteracting: boolean;
}

export function useGestures({
    viewportRef,
    scaleRef,
    offsetRef,
    updateCanvasDisplay,
    syncState,
    setIsInteracting,
    isInteracting
}: UseGesturesProps) {

    const lastTouchDistance = useRef<number | null>(null);
    const initialPinchCenter = useRef<{ x: number, y: number } | null>(null);

    useEffect(() => {
        const el = viewportRef.current;
        if (!el) return;

        const handleTouchStart = (e: TouchEvent) => {
            if (e.touches.length === 2) {
                e.stopPropagation();
                const t1 = e.touches[0];
                const t2 = e.touches[1];
                const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
                lastTouchDistance.current = dist;
                initialPinchCenter.current = {
                    x: (t1.clientX + t2.clientX) / 2,
                    y: (t1.clientY + t2.clientY) / 2
                };
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (e.touches.length === 2 && lastTouchDistance.current) {
                // Critical: This prevents browser zoom
                if (e.cancelable) e.preventDefault();
                e.stopPropagation();

                const t1 = e.touches[0];
                const t2 = e.touches[1];
                const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
                const center = {
                    x: (t1.clientX + t2.clientX) / 2,
                    y: (t1.clientY + t2.clientY) / 2
                };

                const scaleRatio = dist / lastTouchDistance.current;

                const prevScale = scaleRef.current;
                const newScale = Math.min(Math.max(prevScale * scaleRatio, 0.1), 5); // Clamped

                if (newScale !== prevScale) {
                    if (!isInteracting) setIsInteracting(true);
                    scaleRef.current = newScale;
                    const rect = el.getBoundingClientRect();
                    const cx = center.x - rect.left;
                    const cy = center.y - rect.top;

                    const newOffsetX = cx - (cx - offsetRef.current.x) * (newScale / prevScale);
                    const newOffsetY = cy - (cy - offsetRef.current.y) * (newScale / prevScale);
                    offsetRef.current = { x: newOffsetX, y: newOffsetY };

                    updateCanvasDisplay();
                }

                lastTouchDistance.current = dist;
            }
        };

        const handleTouchEnd = (e: TouchEvent) => {
            if (e.touches.length < 2) {
                lastTouchDistance.current = null;
                initialPinchCenter.current = null;
                setIsInteracting(false);
                // Sync back to React state only when gesture ends
                syncState();
            }
        };

        const handleWheel = (e: WheelEvent) => {
            // Prevent browser zoom (Ctrl + Wheel)
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                if (!isInteracting) setIsInteracting(true);

                const delta = -e.deltaY;
                const prevScale = scaleRef.current;
                const factor = Math.pow(1.1, delta / 100);
                const newScale = Math.min(Math.max(prevScale * factor, 0.1), 5);

                const rect = el.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;

                const newOffsetX = mouseX - (mouseX - offsetRef.current.x) * (newScale / prevScale);
                const newOffsetY = mouseY - (mouseY - offsetRef.current.y) * (newScale / prevScale);

                scaleRef.current = newScale;
                offsetRef.current = { x: newOffsetX, y: newOffsetY };

                updateCanvasDisplay();

                // Debounced sync for wheel
                if ((window as any).wheelSyncTimeout) clearTimeout((window as any).wheelSyncTimeout);
                (window as any).wheelSyncTimeout = setTimeout(() => {
                    syncState();
                    setIsInteracting(false);
                }, 150);
            } else {
                if (!isInteracting) setIsInteracting(true);
                offsetRef.current = {
                    x: offsetRef.current.x - e.deltaX,
                    y: offsetRef.current.y - e.deltaY
                };
                updateCanvasDisplay();

                if ((window as any).wheelSyncTimeout) clearTimeout((window as any).wheelSyncTimeout);
                (window as any).wheelSyncTimeout = setTimeout(() => {
                    syncState();
                    setIsInteracting(false);
                }, 150);
            }
        };

        el.addEventListener('touchstart', handleTouchStart, { passive: false });
        el.addEventListener('touchmove', handleTouchMove, { passive: false });
        el.addEventListener('touchend', handleTouchEnd);
        el.addEventListener('wheel', handleWheel, { passive: false });

        return () => {
            el.removeEventListener('touchstart', handleTouchStart);
            el.removeEventListener('touchmove', handleTouchMove);
            el.removeEventListener('touchend', handleTouchEnd);
            el.removeEventListener('wheel', handleWheel);
        };
    }, [updateCanvasDisplay, syncState, isInteracting, setIsInteracting]); // Deps for effect recreation
}
