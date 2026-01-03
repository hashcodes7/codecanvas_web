import { useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import type { ShapeData } from '../../types';
import { ShapeRenderer } from '../../utils/ShapeRenderer';

interface StaticCanvasProps {
    shapes: ShapeData[];
    shapesRef: React.MutableRefObject<ShapeData[]>;
    scale: number;
    offset: { x: number, y: number };
}

const StaticCanvas = forwardRef<{ syncTransform: (offset: { x: number, y: number }, scale: number) => void }, StaticCanvasProps>(
    ({ shapes, shapesRef, scale, offset }, ref) => {
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

            ctx.translate(currentOffset.x, currentOffset.y);
            ctx.scale(currentScale, currentScale);

            // Use ref.current for immediate updates during interaction
            // This prevents desync between the resizing box (DOM) and the shape (Canvas)
            if (shapesRef.current) {
                shapesRef.current.forEach(shape => {
                    ShapeRenderer.drawShape(ctx, shape);
                });
            }
            ctx.restore();
        }, [shapesRef]);

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
        }, [shapes, scale, offset, draw]);

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
