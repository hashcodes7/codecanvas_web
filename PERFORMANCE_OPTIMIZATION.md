# Performance Optimization Plan for Note-Taking

## Current Bottlenecks

### 1. React Re-render Storm (HIGH IMPACT)
**Problem**: `setActiveFreehandShape` called on every mouse move
- **Impact**: 60 re-renders/sec while drawing
- **Fix**: Draw directly to canvas ref, skip React during drawing

### 2. Too Many Separate Shapes (MEDIUM IMPACT)
**Problem**: Each stroke = separate shape in React array
- **Impact**: 500 strokes = slow DOM updates, state management overhead
- **Fix**: Group strokes into "pages" or "layers"

### 3. Excessive Point Storage (LOW IMPACT)
**Problem**: Every mouse position stored
- **Impact**: Memory bloat, larger save files
- **Fix**: Point simplification (Douglas-Peucker algorithm)

## Implementation Priority

### Phase 1: Eliminate Re-render Storm (Quick Win)
```typescript
// Current (BAD):
setActiveFreehandShape({ points: [...all points] }); // 60x/sec

// Optimized (GOOD):
// Draw directly to tempCanvas ref
const tempCtx = tempCanvasRef.current.getContext('2d');
const outline = getStroke(drawingPointsRef.current, {...});
drawOutline(tempCtx, outline); // No React!
```

### Phase 2: Point Simplification
```typescript
// Before save, reduce points:
const simplified = simplifyPoints(rawPoints, tolerance = 1.0);
// 200 points → 50 points (75% reduction)
```

### Phase 3: Stroke Grouping (Advanced)
```typescript
// Group strokes by layer/page:
{
  type: 'freehand-group',
  strokes: [
    { points: [...], color: '#000' },
    { points: [...], color: '#000' },
    // ... 100 strokes
  ]
}
// 1 React item instead of 100
```

## Expected Performance Gains

| Optimization | Before | After | Improvement |
|-------------|--------|-------|-------------|
| Drawing FPS | 30fps | 60fps | 2x |
| Max Strokes | ~100 | ~1000+ | 10x |
| Memory/Stroke | 10KB | 2KB | 5x |

## Implementation Strategy

**Week 1**: Phase 1 (biggest impact, easiest)
**Week 2**: Phase 2 (moderate effort)
**Week 3**: Phase 3 (complex, but enables infinite canvas)
