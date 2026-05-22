import {
  EditorState,
  PhotoType,
  PhotoSize,
  PHOTO_SIZES,
  LAYOUTS,
  LayoutConfig,
  GRID_BORDER,
  PRINT_WIDTH,
  PRINT_HEIGHT,
  BRAND_TEXT,
  BRAND_SUB,
} from './types';

export class ExportManager {
  constructor(private state: EditorState) {}

  /**
   * Render a single cropped photo onto a context at the specified size.
   */
  private renderPhoto(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    targetW: number,
    targetH: number
  ): void {
    if (!this.state.image) return;

    const img = this.state.image;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, targetW, targetH);
    ctx.clip();

    ctx.fillStyle = '#fff';
    ctx.fillRect(x, y, targetW, targetH);

    const baseScale = Math.max(targetW / img.naturalWidth, targetH / img.naturalHeight);
    const userScale = this.state.scale / 100;
    const drawScale = baseScale * userScale;

    const drawW = img.naturalWidth * drawScale;
    const drawH = img.naturalHeight * drawScale;

    const photoSize = this.getPhotoSizeForType(this.state.photoType);
    const refW = photoSize.widthPx;
    const refH = photoSize.heightPx;
    const offsetScaleX = targetW / refW;
    const offsetScaleY = targetH / refH;

    const dpr = window.devicePixelRatio || 1;
    const offsetX = this.state.offsetX * dpr * offsetScaleX;
    const offsetY = this.state.offsetY * dpr * offsetScaleY;

    const drawX = x + (targetW - drawW) / 2 + offsetX;
    const drawY = y + (targetH - drawH) / 2 + offsetY;

    const filters: string[] = [];
    if (this.state.brightness !== 100) {
      filters.push(`brightness(${this.state.brightness}%)`);
    }
    ctx.filter = filters.length > 0 ? filters.join(' ') : 'none';

    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    if (this.state.smooth > 0) {
      const blurScale = targetW / refW;
      ctx.filter = `blur(${Math.round(this.state.smooth * blurScale)}px)`;
      ctx.globalAlpha = 0.5;
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.globalAlpha = 1.0;
    }

    if (this.state.brighten > 0) {
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = `rgba(255, 255, 255, ${this.state.brighten / 100})`;
      ctx.fillRect(x, y, targetW, targetH);
      ctx.globalCompositeOperation = 'source-over';
    }

    ctx.filter = 'none';
    ctx.restore();
  }

  private getPhotoSizeForType(type: PhotoType) {
    switch (type) {
      case PhotoType.OneInch: return PHOTO_SIZES.oneInch;
      case PhotoType.TwoInchHead: return PHOTO_SIZES.twoInchHead;
      case PhotoType.TwoInchHalf: return PHOTO_SIZES.twoInchHalf;
      case PhotoType.ThreeByFour: return PHOTO_SIZES.threeByFour;
      case PhotoType.FiveByFive: return PHOTO_SIZES.fiveByFive;
    }
  }

  private getLayoutForType(type: PhotoType): LayoutConfig {
    switch (type) {
      case PhotoType.OneInch: return LAYOUTS.oneInch;
      case PhotoType.TwoInchHead: return LAYOUTS.twoInchHead;
      case PhotoType.TwoInchHalf: return LAYOUTS.twoInchHalf;
      case PhotoType.ThreeByFour: return LAYOUTS.threeByFour;
      case PhotoType.FiveByFive: return LAYOUTS.fiveByFive;
    }
  }

  exportPrintLayout(): void {
    if (!this.state.image) {
      alert('請先上傳照片');
      return;
    }

    const type = this.state.photoType;
    const layout = this.getLayoutForType(type);

    // Portrait 1200×1800 (4×6 吋 @300DPI)
    const canvasW = PRINT_WIDTH;
    const canvasH = PRINT_HEIGHT;

    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvasW, canvasH);

    const photoW = layout.photoSize.widthPx;
    const photoH = layout.photoSize.heightPx;
    const cols = layout.cols;
    const rows = layout.rows;
    const border = GRID_BORDER;

    // Total grid size including borders between photos
    const totalW = cols * photoW + (cols - 1) * border;
    const totalH = rows * photoH + (rows - 1) * border;
    const startX = (canvasW - totalW) / 2;
    const startY = (canvasH - totalH) / 2;

    // Draw photos in grid
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = startX + col * (photoW + border);
        const y = startY + row * (photoH + border);
        this.renderPhoto(ctx, x, y, photoW, photoH);
      }
    }

    this.applyExtraPrintDarken(ctx, startX, startY, cols, rows, photoW, photoH, border);

    // Draw 3px border lines between photos
    this.drawGridBorders(ctx, startX, startY, totalW, totalH, cols, rows, photoW, photoH, border);

    // Draw label at bottom-left corner
    ctx.fillStyle = '#333';
    ctx.font = '24px sans-serif';
    ctx.fillText(layout.label, 12, canvasH - 10);

    // Draw brand at bottom-right corner
    this.drawBrand(ctx, canvasW, canvasH);

    this.downloadCanvas(canvas, `證件照_${layout.label}_列印圖.png`);
  }

  private applyExtraPrintDarken(
    ctx: CanvasRenderingContext2D,
    startX: number,
    startY: number,
    cols: number,
    rows: number,
    photoW: number,
    photoH: number,
    border: number
  ): void {
    if (this.state.exportDarkenPercent <= 0) return;

    const alpha = this.state.exportDarkenPercent / 100;
    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = startX + col * (photoW + border);
        const y = startY + row * (photoH + border);
        ctx.fillRect(x, y, photoW, photoH);
      }
    }

    ctx.restore();
  }

  /**
   * Draw 3px grid border lines between photos and around the outer edge.
   */
  private drawGridBorders(
    ctx: CanvasRenderingContext2D,
    startX: number,
    startY: number,
    totalW: number,
    totalH: number,
    cols: number,
    rows: number,
    photoW: number,
    photoH: number,
    border: number
  ): void {
    ctx.strokeStyle = '#999';
    ctx.lineWidth = border;

    // Outer rectangle
    ctx.strokeRect(
      startX - border / 2,
      startY - border / 2,
      totalW + border,
      totalH + border
    );

    // Vertical lines between columns
    for (let col = 1; col < cols; col++) {
      const x = startX + col * photoW + (col - 0.5) * border;
      ctx.beginPath();
      ctx.moveTo(x, startY);
      ctx.lineTo(x, startY + totalH);
      ctx.stroke();
    }

    // Horizontal lines between rows
    for (let row = 1; row < rows; row++) {
      const y = startY + row * photoH + (row - 0.5) * border;
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(startX + totalW, y);
      ctx.stroke();
    }
  }

  private drawBrand(
    ctx: CanvasRenderingContext2D,
    canvasW: number,
    canvasH: number
  ): void {
    ctx.save();
    ctx.textAlign = 'right';
    ctx.fillStyle = '#e87530';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(BRAND_TEXT, canvasW - 12, canvasH - 22);
    ctx.font = '12px sans-serif';
    ctx.fillText(BRAND_SUB, canvasW - 12, canvasH - 6);
    ctx.restore();
  }

  exportSingle(): void {
    if (!this.state.image) {
      alert('請先上傳照片');
      return;
    }

    const type = this.state.photoType;
    const photoSize = this.getPhotoSizeForType(type);

    const canvas = document.createElement('canvas');
    canvas.width = photoSize.widthPx;
    canvas.height = photoSize.heightPx;
    const ctx = canvas.getContext('2d')!;

    this.renderPhoto(ctx, 0, 0, photoSize.widthPx, photoSize.heightPx);

    this.downloadCanvas(canvas, `證件照_${photoSize.label}_單張.png`);
  }

  private downloadCanvas(canvas: HTMLCanvasElement, filename: string): void {
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      },
      'image/png'
    );
  }
}
