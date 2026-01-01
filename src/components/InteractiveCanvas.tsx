import { useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import type { ShapeData } from '../types';
import { ShapeRenderer } from '../utils/ShapeRenderer';

interface InteractiveCanvasProps {
    activeShape: Partial<ShapeData> | null;
    scale: number;
    offset: { x: number, y: number };
}

const InteractiveCanvas = forwardRef<{ syncTransform: (offset: { x: number, y: number }, scale: number) => void }, InteractiveCanvasProps>(
    ({ activeShape, scale, offset }, ref) => {
        const canvasRef = useRef<HTMLCanvasElement>(null);

        const draw = useCallback((currentOffset: { x: number, y: number }, currentScale: number) => {
            const canvas = canvasRef.current;
            if (!canvas) return;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const dpr = window.devicePixelRatio || 1;
            ctx.save();
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

            if (activeShape) {
                ctx.translate(currentOffset.x, currentOffset.y);
                ctx.scale(currentScale, currentScale);
                // Draw a preview of the shape being drawn/dragged
                ShapeRenderer.drawShape(ctx, activeShape as ShapeData);
            }
            ctx.restore();
        }, [activeShape]);

        useImperativeHandle(ref, () => ({
            syncTransform: (newOffset, newScale) => {
                draw(newOffset, newScale);
            }
        }));

        const updateCanvasSize = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const dpr = window.devicePixelRatio || 1;
            const width = window.innerWidth;
            const height = window.innerHeight;

            canvas.width = width * dpr;
            canvas.height = height * dpr;
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
            draw(offset, scale); // Redraw on resize
        };

        useEffect(() => {
            updateCanvasSize();
            window.addEventListener('resize', updateCanvasSize);
            return () => window.removeEventListener('resize', updateCanvasSize);
        }, [draw]);

        useEffect(() => {
            draw(offset, scale);
        }, [activeShape, scale, offset, draw]);

        return (
            <canvas
                ref={canvasRef}
                className="interactive-canvas"
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    pointerEvents: 'none',
                    zIndex: 10
                }}
            />
        );
    }
);

export default InteractiveCanvas;
