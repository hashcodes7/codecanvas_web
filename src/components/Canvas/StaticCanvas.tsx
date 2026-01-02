import { useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import type { ShapeData } from '../../types';
import { ShapeRenderer } from '../../utils/ShapeRenderer';

interface StaticCanvasProps {
    shapes: ShapeData[];
    scale: number;
    offset: { x: number, y: number };
    selectedShapeId: string | null;
}

const StaticCanvas = forwardRef<{ syncTransform: (offset: { x: number, y: number }, scale: number, selectedShapeId: string | null) => void }, StaticCanvasProps>(
    ({ shapes, scale, offset, selectedShapeId }, ref) => {
        const canvasRef = useRef<HTMLCanvasElement>(null);

        const draw = useCallback((currentOffset: { x: number, y: number }, currentScale: number, currentSelectedId: string | null) => {
            const canvas = canvasRef.current;
            if (!canvas) return;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const dpr = window.devicePixelRatio || 1;
            ctx.save();
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

            ctx.translate(currentOffset.x, currentOffset.y);
            ctx.scale(currentScale, currentScale);

            shapes.forEach(shape => {
                ShapeRenderer.drawShape(ctx, shape);

                // Draw selection highlight
                if (shape.id === currentSelectedId) {
                    ctx.save();
                    ctx.strokeStyle = '#3b82f6';
                    ctx.lineWidth = 2 / currentScale;
                    ctx.setLineDash([5 / currentScale, 5 / currentScale]);
                    const padding = 4 / currentScale;
                    ctx.strokeRect(
                        shape.x - padding,
                        shape.y - padding,
                        shape.width + padding * 2,
                        shape.height + padding * 2
                    );
                    ctx.restore();
                }
            });
            ctx.restore();
        }, [shapes]);

        useImperativeHandle(ref, () => ({
            syncTransform: (newOffset, newScale, newSelectedId) => {
                draw(newOffset, newScale, newSelectedId);
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
            draw(offset, scale, selectedShapeId); // Redraw on resize
        };

        useEffect(() => {
            updateCanvasSize();
            window.addEventListener('resize', updateCanvasSize);
            return () => window.removeEventListener('resize', updateCanvasSize);
        }, [draw]);

        useEffect(() => {
            draw(offset, scale, selectedShapeId);
        }, [shapes, scale, offset, selectedShapeId, draw]);

        return (
            <canvas
                ref={canvasRef}
                className="static-canvas"
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    pointerEvents: 'none',
                    zIndex: 1
                }}
            />
        );
    }
);

export default StaticCanvas;
