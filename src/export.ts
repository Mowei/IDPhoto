import {
  EditorState,
  PhotoType,
  PHOTO_SIZES,
  LAYOUTS,
  COMBO_LAYOUT,
  GRID_BORDER,
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

  private renderPhotoOneInch(
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

    // Combo mode: use two-inch reference for offset mapping
    const refSize = PHOTO_SIZES.twoInch;
    const offsetScaleX = targetW / refSize.widthPx;
    const offsetScaleY = targetH / refSize.heightPx;
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
      const blurScale = targetW / refSize.widthPx;
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
    if (type === PhotoType.OneInchHalf) return PHOTO_SIZES.oneInch;
    return PHOTO_SIZES.twoInch;
  }

  exportPrintLayout(): void {
    if (!this.state.image) {
      alert('請先上傳照片');
      return;
    }

    const type = this.state.photoType;

    if (type === PhotoType.Combo) {
      this.exportCombo();
      return;
    }

    const isOneInch = type === PhotoType.OneInchHalf;
    const layout = isOneInch ? LAYOUTS.oneInch : LAYOUTS.twoInch;

    // Landscape orientation (1800×1200)
    const canvasW = 1800;
    const canvasH = 1200;

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

    // Draw 3px border lines between photos
    this.drawGridBorders(ctx, startX, startY, totalW, totalH, cols, rows, photoW, photoH, border);

    // Draw label at bottom-left corner
    const labelText = isOneInch ? '一吋半身照' : this.getLabelForType(type);
    ctx.fillStyle = '#333';
    ctx.font = '24px sans-serif';
    ctx.fillText(labelText, 12, canvasH - 10);

    // Draw brand bar
    this.drawBrandHorizontal(ctx, canvasW, canvasH);

    this.downloadCanvas(canvas, `證件照_${layout.label}_列印圖.png`);
  }

  private exportCombo(): void {
    const combo = COMBO_LAYOUT;
    const canvasW = 1800;
    const canvasH = 1200;
    const border = GRID_BORDER;

    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvasW, canvasH);

    const leftPhotoW = combo.left.photoSize.widthPx;
    const leftPhotoH = combo.left.photoSize.heightPx;
    const rightPhotoW = combo.right.photoSize.widthPx;
    const rightPhotoH = combo.right.photoSize.heightPx;

    // Left section: 2 cols × 2 rows of two-inch photos
    const leftTotalW = combo.left.cols * leftPhotoW + (combo.left.cols - 1) * border;
    const leftTotalH = combo.left.rows * leftPhotoH + (combo.left.rows - 1) * border;
    const leftStartX = 50;
    const leftStartY = (canvasH - leftTotalH) / 2;

    for (let row = 0; row < combo.left.rows; row++) {
      for (let col = 0; col < combo.left.cols; col++) {
        const x = leftStartX + col * (leftPhotoW + border);
        const y = leftStartY + row * (leftPhotoH + border);
        this.renderPhoto(ctx, x, y, leftPhotoW, leftPhotoH);
      }
    }

    this.drawGridBorders(ctx, leftStartX, leftStartY, leftTotalW, leftTotalH, combo.left.cols, combo.left.rows, leftPhotoW, leftPhotoH, border);

    // Right section: 2 cols × 2 rows of one-inch photos
    const rightStartX = leftStartX + leftTotalW + 50;
    const rightTotalW = combo.right.cols * rightPhotoW + (combo.right.cols - 1) * border;
    const rightTotalH = combo.right.rows * rightPhotoH + (combo.right.rows - 1) * border;
    const rightStartY = leftStartY;

    for (let row = 0; row < combo.right.rows; row++) {
      for (let col = 0; col < combo.right.cols; col++) {
        const x = rightStartX + col * (rightPhotoW + border);
        const y = rightStartY + row * (rightPhotoH + border);
        this.renderPhotoOneInch(ctx, x, y, rightPhotoW, rightPhotoH);
      }
    }

    this.drawGridBorders(ctx, rightStartX, rightStartY, rightTotalW, rightTotalH, combo.right.cols, combo.right.rows, rightPhotoW, rightPhotoH, border);

    // Labels at bottom-left corner
    ctx.fillStyle = '#333';
    ctx.font = '24px sans-serif';
    ctx.fillText('兩吋半身照', 12, canvasH - 10);
    ctx.fillText('一吋半身照', rightStartX, canvasH - 10);

    // Brand bar
    this.drawBrandHorizontal(ctx, canvasW, canvasH);

    this.downloadCanvas(canvas, '證件照_兩吋加一吋_列印圖.png');
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

  private drawBrandHorizontal(
    ctx: CanvasRenderingContext2D,
    canvasW: number,
    canvasH: number
  ): void {
    // Position at the very bottom-right corner, outside photo grid
    ctx.save();
    ctx.textAlign = 'right';
    ctx.fillStyle = '#e87530';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(BRAND_TEXT, canvasW - 12, canvasH - 22);
    ctx.font = '12px sans-serif';
    ctx.fillText(BRAND_SUB, canvasW - 12, canvasH - 6);
    ctx.restore();
  }

  private getLabelForType(type: PhotoType): string {
    switch (type) {
      case PhotoType.TwoInchHead: return '兩吋大頭照';
      case PhotoType.TwoInchHalf: return '兩吋半身照';
      case PhotoType.OneInchHalf: return '一吋半身照';
      case PhotoType.Combo: return '兩吋+一吋';
    }
  }

  exportSingle(): void {
    if (!this.state.image) {
      alert('請先上傳照片');
      return;
    }

    const type = this.state.photoType;
    const photoSize =
      type === PhotoType.OneInchHalf ? PHOTO_SIZES.oneInch : PHOTO_SIZES.twoInch;

    const canvas = document.createElement('canvas');
    canvas.width = photoSize.widthPx;
    canvas.height = photoSize.heightPx;
    const ctx = canvas.getContext('2d')!;

    this.renderPhoto(ctx, 0, 0, photoSize.widthPx, photoSize.heightPx);

    const label = this.getLabelForType(type);
    this.downloadCanvas(canvas, `證件照_${label}_單張.png`);
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
