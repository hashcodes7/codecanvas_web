// Calculates a smooth path (Bezier curve) between two points
export const getPathData = (x1: number, y1: number, x2: number, y2: number) => {
    const dx = x2 - x1;
    const dy = y2 - y1;

    // Curvature factor for the Bezier control points
    const curvature = 0.5;
    // Adjust vertical bias if nodes are vertically aligned
    const vBias = Math.abs(dy) > Math.abs(dx) ? 0.2 : 0;

    const cx1 = x1 + dx * curvature;
    const cy1 = y1 + dy * vBias;
    const cx2 = x2 - dx * curvature;
    const cy2 = y2 - dy * vBias;

    return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
};
