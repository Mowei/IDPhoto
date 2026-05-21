import {
  EditorState,
  PhotoType,
  PHOTO_SIZES,
  LAYOUTS,
  COMBO_LAYOUT,
  BRAND_TEXT,
  BRAND_SUB,
} from './types';
import { PhotoEditor } from './photo-editor';

export class ExportManager {
  constructor(private state: EditorState) {}

  private getEditor(): PhotoEditor {
    // Access the editor instance — we'll get it from the global scope
    // Instead, we render directly using state + image
    return null as unknown as PhotoEditor;
  }

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

    // We need to map offset from display coordinates to export coordinates
    // The display canvas dimensions depend on the screen layout
    // We store offset in CSS pixels; convert to export pixels
    const photoSize = this.getPhotoSizeForType(this.state.photoType);
    const refW = photoSize.widthPx;
    const refH = photoSize.heightPx;
    const offsetScaleX = targetW / refW;
    const offsetScaleY = targetH / refH;

    // Recompute offset relative to export target
    // Original render: offset in CSS px, canvas = displayWidth * dpr
    // For export, we map: offset * (targetW / displayCanvasW) but we don't have displayCanvasW
    // Instead, use the reference photo size as the common coordinate
    const dpr = window.devicePixelRatio || 1;
    const offsetX = this.state.offsetX * dpr * offsetScaleX;
    const offsetY = this.state.offsetY * dpr * offsetScaleY;

    const drawX = x + (targetW - drawW) / 2 + offsetX;
    const drawY = y + (targetH - drawH) / 2 + offsetY;

    // Apply filters
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

    const canvas = document.createElement('canvas');
    canvas.width = layout.canvasWidth;
    canvas.height = layout.canvasHeight;
    const ctx = canvas.getContext('2d')!;

    // White background
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const photoW = layout.photoSize.widthPx;
    const photoH = layout.photoSize.heightPx;

    // Calculate centering margins
    const totalPhotosW = layout.cols * photoW;
    const totalPhotosH = layout.rows * photoH;
    const marginX = (canvas.width - totalPhotosW) / 2;
    const marginY = (canvas.height - totalPhotosH) / 2;

    // Draw photos in grid
    for (let row = 0; row < layout.rows; row++) {
      for (let col = 0; col < layout.cols; col++) {
        const x = marginX + col * photoW;
        const y = marginY + row * photoH;
        this.renderPhoto(ctx, x, y, photoW, photoH);
      }
    }

    // Draw cut lines and scissors
    this.drawCutLines(ctx, canvas.width, canvas.height, marginX, marginY, totalPhotosW, totalPhotosH, layout.cols, layout.rows, photoW, photoH);

    // Draw label text
    const labelText = isOneInch ? '一吋半身照' : this.getLabelForType(type);
    this.drawLabelText(ctx, canvas.width, canvas.height, marginX, marginY, totalPhotosW, totalPhotosH, labelText, isOneInch);

    // Draw brand
    this.drawBrand(ctx, canvas.width, canvas.height, isOneInch);

    this.downloadCanvas(canvas, `證件照_${layout.label}_列印圖.jpg`);
  }

  private exportCombo(): void {
    const combo = COMBO_LAYOUT;
    const canvas = document.createElement('canvas');
    canvas.width = combo.canvasWidth;
    canvas.height = combo.canvasHeight;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const leftPhotoW = combo.left.photoSize.widthPx;
    const leftPhotoH = combo.left.photoSize.heightPx;
    const rightPhotoW = combo.right.photoSize.widthPx;
    const rightPhotoH = combo.right.photoSize.heightPx;

    // Left section: 2 cols × 2 rows of two-inch photos
    const leftTotalW = combo.left.cols * leftPhotoW;
    const leftTotalH = combo.left.rows * leftPhotoH;
    const leftMarginX = 30;
    const leftMarginY = (canvas.height - leftTotalH) / 2;

    for (let row = 0; row < combo.left.rows; row++) {
      for (let col = 0; col < combo.left.cols; col++) {
        const x = leftMarginX + col * leftPhotoW;
        const y = leftMarginY + row * leftPhotoH;
        this.renderPhoto(ctx, x, y, leftPhotoW, leftPhotoH);
      }
    }

    // Right section: 2 cols × 2 rows of one-inch photos
    const rightStartX = leftMarginX + leftTotalW + 20;
    const rightTotalW = combo.right.cols * rightPhotoW;
    const rightTotalH = combo.right.rows * rightPhotoH;
    const rightMarginY = leftMarginY;

    for (let row = 0; row < combo.right.rows; row++) {
      for (let col = 0; col < combo.right.cols; col++) {
        const x = rightStartX + col * rightPhotoW;
        const y = rightMarginY + row * rightPhotoH;
        // For one-inch, we need to render at a different crop (same photo, smaller crop)
        this.renderPhotoOneInch(ctx, x, y, rightPhotoW, rightPhotoH);
      }
    }

    // Draw cut lines for left section
    this.drawCutLines(ctx, canvas.width, canvas.height, leftMarginX, leftMarginY, leftTotalW, leftTotalH, combo.left.cols, combo.left.rows, leftPhotoW, leftPhotoH);

    // Draw cut lines for right section
    this.drawCutLinesSection(ctx, rightStartX, rightMarginY, rightTotalW, rightTotalH, combo.right.cols, combo.right.rows, rightPhotoW, rightPhotoH);

    // Labels
    ctx.fillStyle = '#666';
    ctx.font = '24px sans-serif';
    ctx.fillText('兩吋半身照', leftMarginX + leftTotalW / 2 - 60, canvas.height - 20);
    ctx.fillText('一吋半身照', rightStartX + rightTotalW / 2 - 60, rightMarginY + rightTotalH + 30);

    // Brand
    this.drawBrand(ctx, canvas.width, canvas.height, false);

    this.downloadCanvas(canvas, '證件照_兩吋加一吋_列印圖.jpg');
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

    // Use the two-inch photo size as reference for offset mapping (combo uses same position)
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

  private drawCutLines(
    ctx: CanvasRenderingContext2D,
    canvasW: number,
    canvasH: number,
    marginX: number,
    marginY: number,
    totalW: number,
    totalH: number,
    cols: number,
    rows: number,
    photoW: number,
    photoH: number
  ): void {
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 4]);

    // Horizontal lines
    for (let i = 0; i <= rows; i++) {
      const y = marginY + i * photoH;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasW, y);
      ctx.stroke();
    }

    // Vertical lines
    for (let j = 0; j <= cols; j++) {
      const x = marginX + j * photoW;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasH);
      ctx.stroke();
    }

    ctx.setLineDash([]);

    // Scissors symbols at intersections
    ctx.fillStyle = '#333';
    ctx.font = '28px sans-serif';
    // Top-left corner
    ctx.fillText('✂', marginX - 18, marginY - 6);
    // Top at first vertical division
    if (cols > 1) {
      ctx.fillText('✂', marginX + photoW - 18, marginY - 6);
    }
    // Left at first horizontal division
    if (rows > 1) {
      ctx.fillText('✂', marginX - 18, marginY + photoH - 6);
    }
    // Bottom-left
    ctx.fillText('✂', marginX - 18, marginY + totalH + 20);
    // Bottom at first vertical division
    if (cols > 1) {
      ctx.fillText('✂', marginX + photoW - 18, marginY + totalH + 20);
    }
  }

  private drawCutLinesSection(
    ctx: CanvasRenderingContext2D,
    startX: number,
    startY: number,
    totalW: number,
    totalH: number,
    cols: number,
    rows: number,
    photoW: number,
    photoH: number
  ): void {
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 4]);

    for (let i = 0; i <= rows; i++) {
      const y = startY + i * photoH;
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(startX + totalW, y);
      ctx.stroke();
    }

    for (let j = 0; j <= cols; j++) {
      const x = startX + j * photoW;
      ctx.beginPath();
      ctx.moveTo(x, startY);
      ctx.lineTo(x, startY + totalH);
      ctx.stroke();
    }

    ctx.setLineDash([]);
  }

  private getLabelForType(type: PhotoType): string {
    switch (type) {
      case PhotoType.TwoInchHead: return '兩吋大頭照';
      case PhotoType.TwoInchHalf: return '兩吋半身照';
      case PhotoType.OneInchHalf: return '一吋半身照';
      case PhotoType.Combo: return '兩吋+一吋';
    }
  }

  private drawLabelText(
    ctx: CanvasRenderingContext2D,
    canvasW: number,
    canvasH: number,
    marginX: number,
    marginY: number,
    totalW: number,
    totalH: number,
    label: string,
    isLandscape: boolean
  ): void {
    ctx.fillStyle = '#666';
    ctx.font = '24px sans-serif';

    if (isLandscape) {
      // Bottom label for landscape
      ctx.fillText(label, marginX + 30, canvasH - 20);
    } else {
      // Bottom label for portrait
      ctx.fillText(label, marginX + totalW / 2 - 50, canvasH - 20);
    }
  }

  private drawBrand(
    ctx: CanvasRenderingContext2D,
    canvasW: number,
    canvasH: number,
    isLandscape: boolean
  ): void {
    const brandW = isLandscape ? 260 : 40;
    const brandH = isLandscape ? 36 : 300;

    ctx.save();

    if (isLandscape) {
      // Horizontal brand bar at bottom-right
      const bx = canvasW / 2 + 40;
      const by = canvasH - 46;

      // Orange background
      ctx.fillStyle = '#e87530';
      this.roundRect(ctx, bx, by, brandW, brandH, 4);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(BRAND_TEXT, bx + 10, by + 24);

      ctx.font = '12px sans-serif';
      ctx.fillText(BRAND_SUB, bx + 150, by + 24);
    } else {
      // Vertical brand bar on the left side
      const bx = 8;
      const by = canvasH / 2 - brandH / 2;

      ctx.fillStyle = '#e87530';
      this.roundRect(ctx, bx, by, brandW, brandH, 4);
      ctx.fill();

      // Draw vertical text
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 20px sans-serif';
      const mainChars = BRAND_TEXT.split('');
      let ty = by + 30;
      for (const ch of mainChars) {
        ctx.fillText(ch, bx + 10, ty);
        ty += 24;
      }

      ctx.font = '12px sans-serif';
      const subChars = BRAND_SUB.split('');
      ty += 10;
      for (const ch of subChars) {
        ctx.fillText(ch, bx + 14, ty);
        ty += 16;
      }
    }

    ctx.restore();
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
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
    this.downloadCanvas(canvas, `證件照_${label}_單張.jpg`);
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
      'image/jpeg',
      0.95
    );
  }
}
