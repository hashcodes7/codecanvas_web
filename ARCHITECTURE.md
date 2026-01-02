# CodeCanvas Architecture

## Rendering Layers

### 1. Canvas Layer (StaticCanvas)
- **Purpose**: High-performance rendering of shapes
- **Technology**: HTML5 Canvas 2D API
- **Data Source**: `shapesRef.current` (for instant updates)
- **Updates**: Redraws on every `updateCanvasDisplay()` call

### 2. DOM Layer (ShapeHandles)
- **Purpose**: Interactive handles for selection, dragging, and resizing
- **Technology**: Positioned `<div>` elements
- **Data Source**: `shapes` React state (props passed to component)
- **Updates**: React re-renders when `shapes` state changes

## Synchronization Strategy

### The Problem
Mixing Canvas (bitmap) and DOM (vector) creates sync challenges:
- Canvas reads from refs for instant feedback
- DOM reads from React state for consistency
- If only one is updated, they desync visually

### The Solution: Dual Update Pattern

```typescript
// During drag/resize:
shape.x += delta;              // 1. Update ref (instant canvas feedback)
setShapes(prev => prev.map()); // 2. Update state (triggers React re-render)
updateCanvasDisplay();         // 3. Force canvas redraw
```

**Why this works:**
1. **Ref update** → Canvas redraws immediately with new position
2. **State update** → React re-renders ShapeHandles with new position
3. **Both read from same data** → Perfect sync

## Key Principles

### ✅ DO:
- Update both ref AND state for shapes during interactions
- Let ShapeHandles derive position from props (pure component)
- Force canvas redraws after ref updates

### ❌ DON'T:
- Manually manipulate DOM with `el.style.left =` for shapes
- Let DOM handles have internal position state
- Update only ref or only state (causes desync)

## Data Flow

```
User Interaction
    ↓
handlePointerMove()
    ↓
├─ Update shapesRef.current (instant)
├─ Update shapes state (React)
└─ Call updateCanvasDisplay()
    ↓
├─ StaticCanvas redraws (reads shapesRef)
└─ ShapeHandles re-renders (reads shapes prop)
    ↓
Perfect Sync ✓
```

## Performance Characteristics

- **Canvas rendering**: O(n) where n = number of shapes, ~60fps with 100+ shapes
- **React re-renders**: Only re-renders ShapeHandles for moved/resized shape
- **Memory**: Minimal overhead from dual storage (ref + state point to same objects)

## Why Not Other Approaches?

### All-Canvas
❌ Complex hit detection for handles
❌ Manual hover/cursor states
✅ Best raw performance

### All-SVG/DOM
❌ Slower with 100+ shapes
❌ Higher memory usage
✅ Easiest to code

### Current Hybrid
✅ Fast rendering
✅ Easy interaction
✅ Best of both worlds
⚠️ Requires careful sync (solved with dual update pattern)
