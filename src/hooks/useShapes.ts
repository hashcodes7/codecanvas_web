/**
 * Manages the state and logic for Geometric Shapes.
 * Handles creation, updates, and styling of shapes (Rectangles, Ellipses, Diamonds, etc).
 */
import { useState, useRef, useEffect } from 'react';
import type { ShapeData } from '../types';

export function useShapes() {
    const [shapes, setShapes] = useState<ShapeData[]>([]);
    const shapesRef = useRef(shapes);

    useEffect(() => { shapesRef.current = shapes; }, [shapes]);

    const addShape = (shape: ShapeData) => {
        setShapes(prev => [...prev, shape]);
    };

    const updateShape = (id: string, updates: Partial<ShapeData>) => {
        setShapes(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    };

    return {
        shapes,
        setShapes,
        shapesRef,
        addShape,
        updateShape
    };
}
