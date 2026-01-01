import type { ShapeData } from '../types';

export class ShapeRenderer {
    static drawShape(ctx: CanvasRenderingContext2D, shape: ShapeData) {
        ctx.save();
        ctx.globalAlpha = shape.opacity;
        ctx.strokeStyle = shape.strokeColor;
        ctx.fillStyle = shape.fillColor;
        ctx.lineWidth = shape.strokeWidth;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        const { x, y, width, height } = shape;

        ctx.beginPath();
        switch (shape.type) {
            case 'rectangle':
                this.drawRoundedRect(ctx, x, y, width, height, 8);
                break;
            case 'ellipse':
                ctx.ellipse(x + width / 2, y + height / 2, Math.abs(width / 2), Math.abs(height / 2), 0, 0, Math.PI * 2);
                break;
            case 'diamond':
                ctx.moveTo(x + width / 2, y);
                ctx.lineTo(x + width, y + height / 2);
                ctx.lineTo(x + width / 2, y + height);
                ctx.lineTo(x, y + height / 2);
                ctx.closePath();
                break;
            case 'arrow':
                this.drawArrow(ctx, x, y, x + width, y + height);
                break;
        }

        if (shape.fillColor !== 'transparent') {
            ctx.fill();
        }
        ctx.stroke();
        ctx.restore();
    }

    private static drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
        if (w < 2 * r) r = w / 2;
        if (h < 2 * r) r = h / 2;
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    private static drawArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
        const headLength = 15;
        const angle = Math.atan2(y2 - y1, x2 - x1);

        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);

        ctx.lineTo(x2 - headLength * Math.cos(angle - Math.PI / 6), y2 - headLength * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - headLength * Math.cos(angle + Math.PI / 6), y2 - headLength * Math.sin(angle + Math.PI / 6));
    }
}
