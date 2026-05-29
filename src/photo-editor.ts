import {
  EditorState,
  PhotoType,
  PHOTO_SIZES,
} from './types';

export class PhotoEditor {
  private photoCanvas: HTMLCanvasElement;
  private overlayCanvas: HTMLCanvasElement;
  private previewCanvas: HTMLCanvasElement;
  private photoCtx: CanvasRenderingContext2D;
  private overlayCtx: CanvasRenderingContext2D;
  private previewCtx: CanvasRenderingContext2D;
  private container: HTMLElement;
  private placeholder: HTMLElement;
  private zoomControls: HTMLElement;
  private singlePreview: HTMLElement;

  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private startOffsetX = 0;
  private startOffsetY = 0;

  // Display dimensions for the crop frame on canvas
  private displayWidth = 0;
  private displayHeight = 0;
  private cropFrameX = 0;
  private cropFrameY = 0;
  private cropFrameW = 0;
  private cropFrameH = 0;

  // Guide proportions per photo type
  // headCenterY: head center vertical position (fraction of height)
  // headRx: head oval horizontal radius (fraction of width)
  // headRy: head oval vertical radius (fraction of height)
  // showBody: whether to draw shoulder/body outline
  // headTopLine: top of head line (fraction of height)
  // headBottomLineMin/Max: chin range limits (fraction of height)
  // earLeftX/earRightX: ear horizontal range (fraction of width)
  // eyeLine: eye alignment line (fraction of height)
  private static GUIDE_PARAMS: Record<PhotoType, {
    headCenterY: number;
    headRx: number;
    headRy: number;
    showBody: boolean;
    shoulderY: number;
    shoulderWidth: number;
    headTopLine?: number;
    headBottomLineMin?: number;
    headBottomLineMax?: number;
    earLeftX?: number;
    earRightX?: number;
    eyeLine?: number;
  }> = {
    // 1吋大頭貼 (2.8×3.5cm, 331×413px)
    // 下巴 72%~80%, 耳朵 25%~75% (寬度50%)
    [PhotoType.OneInch]: {
      headCenterY: 0.39,
      headRx: 0.25,
      headRy: 0.34,
      showBody: true,
      shoulderY: 0.88,
      shoulderWidth: 0.50,
      headTopLine: 0.07,
      headBottomLineMin: 0.72,
      headBottomLineMax: 0.80,
      earLeftX: 0.25,
      earRightX: 0.75,
    },
    // 2吋大頭照 (3.5×4.5cm, 413×531px) —— 護照、身分證（最嚴格）
    // 下巴 81%~88%, 耳朵 20%~80%, 頭部極大
    [PhotoType.TwoInchHead]: {
      headCenterY: 0.45,
      headRx: 0.30,
      headRy: 0.36,
      showBody: true,
      shoulderY: 0.94,
      shoulderWidth: 0.40,
      headTopLine: 0.08,
      headBottomLineMin: 0.81,
      headBottomLineMax: 0.88,
      earLeftX: 0.20,
      earRightX: 0.80,
    },
    // 2吋半身照 (4.2×4.7cm, 496×555px) —— 健保卡、國際駕照
    // 下巴 64%~70%, 耳朵 28%~72%, 頭部比例較小
    [PhotoType.TwoInchHalf]: {
      headCenterY: 0.385,
      headRx: 0.22,
      headRy: 0.27,
      showBody: true,
      shoulderY: 0.78,
      shoulderWidth: 0.90,
      headTopLine: 0.11,
      headBottomLineMin: 0.64,
      headBottomLineMax: 0.70,
      earLeftX: 0.28,
      earRightX: 0.72,
    },
    // 3×4大頭照 (3.0×4.0cm, 354×472px) —— 赴日簽證
    // 下巴 78%~83%, 耳朵 18%~82%, 照片窄長
    [PhotoType.ThreeByFour]: {
      headCenterY: 0.42,
      headRx: 0.32,
      headRy: 0.36,
      showBody: true,
      shoulderY: 0.90,
      shoulderWidth: 0.75,
      headTopLine: 0.075,
      headBottomLineMin: 0.78,
      headBottomLineMax: 0.83,
      earLeftX: 0.18,
      earRightX: 0.82,
    },
    // 5×5大頭照 (5.0×5.0cm, 591×591px) —— 美簽（正方形）
    // 下巴 64%~72%, 耳朵 26%~74%, 頭寬 48%~50%
    [PhotoType.FiveByFive]: {
      headCenterY: 0.40,
      headRx: 0.24,
      headRy: 0.28,
      showBody: true,
      shoulderY: 0.82,
      shoulderWidth: 0.76,
      headTopLine: 0.12,
      headBottomLineMin: 0.64,
      headBottomLineMax: 0.72,
      earLeftX: 0.26,
      earRightX: 0.74,
      eyeLine: 0.37,
    },
  };

  // Default composition presets based on sample templates.
  // fitMultiplier controls initial zoom amount after fill-scale.
  // offsetYRatio uses display height as unit; negative lifts subject upward.
  private static COMPOSITION_PRESETS: Record<PhotoType, {
    fitMultiplier: number;
    offsetYRatio: number;
  }> = {
    [PhotoType.OneInch]: {
      fitMultiplier: 1.12,
      offsetYRatio: -0.055,
    },
    [PhotoType.TwoInchHead]: {
      fitMultiplier: 1.16,
      offsetYRatio: -0.065,
    },
    [PhotoType.TwoInchHalf]: {
      fitMultiplier: 1.04,
      offsetYRatio: -0.04,
    },
    [PhotoType.ThreeByFour]: {
      fitMultiplier: 1.14,
      offsetYRatio: -0.06,
    },
    [PhotoType.FiveByFive]: {
      fitMultiplier: 1.08,
      offsetYRatio: -0.05,
    },
  };

  constructor(private state: EditorState) {
    this.photoCanvas = document.getElementById('photoCanvas') as HTMLCanvasElement;
    this.overlayCanvas = document.getElementById('overlayCanvas') as HTMLCanvasElement;
    this.previewCanvas = document.getElementById('previewCanvas') as HTMLCanvasElement;
    this.photoCtx = this.photoCanvas.getContext('2d')!;
    this.overlayCtx = this.overlayCanvas.getContext('2d')!;
    this.previewCtx = this.previewCanvas.getContext('2d')!;
    this.container = document.getElementById('canvasContainer')!;
    this.placeholder = document.getElementById('placeholder')!;
    this.zoomControls = document.getElementById('zoomControls')!;
    this.singlePreview = document.getElementById('singlePreview')!;

    this.bindDragEvents();

    // Initial container sizing based on default photo type
    requestAnimationFrame(() => this.resizeContainer());
  }

  private getPhotoSize() {
    const type = this.state.photoType;
    switch (type) {
      case PhotoType.OneInch: return PHOTO_SIZES.oneInch;
      case PhotoType.TwoInchHead: return PHOTO_SIZES.twoInchHead;
      case PhotoType.TwoInchHalf: return PHOTO_SIZES.twoInchHalf;
      case PhotoType.ThreeByFour: return PHOTO_SIZES.threeByFour;
      case PhotoType.FiveByFive: return PHOTO_SIZES.fiveByFive;
    }
  }

  onTypeChange(): void {
    this.resizeContainer();
    if (this.state.image) {
      this.setupCanvas();
      this.autoFitScale();
      this.render();
    }
  }

  /** Resize the container to match the current photo type's aspect ratio (no image needed) */
  private resizeContainer(): void {
    const wrapper = this.container.parentElement!;
    const wrapperRect = wrapper.getBoundingClientRect();
    const wrapperW = wrapperRect.width;
    const wrapperH = wrapperRect.height;

    const photoSize = this.getPhotoSize();
    const aspectRatio = photoSize.widthPx / photoSize.heightPx;

    const padding = 40;
    const maxW = wrapperW - padding * 2;
    const maxH = wrapperH - padding * 2;

    let w: number, h: number;
    if (maxW / maxH > aspectRatio) {
      h = maxH;
      w = maxH * aspectRatio;
    } else {
      w = maxW;
      h = maxW / aspectRatio;
    }

    this.container.style.width = `${w}px`;
    this.container.style.height = `${h}px`;
  }

  onImageLoaded(): void {
    this.placeholder.classList.add('hidden');
    this.zoomControls.classList.add('visible');
    this.singlePreview.classList.add('visible');

    this.setupCanvas();

    // Auto-scale to fit crop frame and align initial composition
    this.autoFitScale();
    this.render();
  }

  private autoFitScale(): void {
    const img = this.state.image!;
    const photoSize = this.getPhotoSize();
    const preset = PhotoEditor.COMPOSITION_PRESETS[this.state.photoType];

    // Calculate scale so image fills the crop area
    // We work in a normalized coordinate system where crop frame = photoSize pixels
    const scaleToFillW = photoSize.widthPx / img.naturalWidth;
    const scaleToFillH = photoSize.heightPx / img.naturalHeight;
    const fillScale = Math.max(scaleToFillW, scaleToFillH);
    const fittedScale = fillScale * preset.fitMultiplier;

    // Convert to percentage (100% = image exactly fills crop frame on the larger dimension)
    this.state.scale = Math.round(fittedScale * 100);
    this.state.offsetX = 0;
    // offsetY in displayHeight space (what user sees), will convert to photoSize space in render()
    this.state.offsetY = this.displayHeight * preset.offsetYRatio;

    // Update zoom slider
    const zoomSlider = document.getElementById('zoomSlider') as HTMLInputElement;
    const zoomValue = document.getElementById('zoomValue')!;
    zoomSlider.value = String(this.state.scale);
    zoomValue.textContent = `${this.state.scale}%`;
  }

  private setupCanvas(): void {
    const photoSize = this.getPhotoSize();
    
    // Set displayWidth/Height to match photoSize exactly (1:1 scale)
    this.displayWidth = photoSize.widthPx;
    this.displayHeight = photoSize.heightPx;

    // Resize the container to match photo size
    this.container.style.width = `${this.displayWidth}px`;
    this.container.style.height = `${this.displayHeight}px`;

    // Canvas width/height and style.width/height all match photoSize (no scaling)
    this.photoCanvas.width = photoSize.widthPx;
    this.photoCanvas.height = photoSize.heightPx;
    this.photoCanvas.style.width = `${photoSize.widthPx}px`;
    this.photoCanvas.style.height = `${photoSize.heightPx}px`;

    this.overlayCanvas.width = photoSize.widthPx;
    this.overlayCanvas.height = photoSize.heightPx;
    this.overlayCanvas.style.width = `${photoSize.widthPx}px`;
    this.overlayCanvas.style.height = `${photoSize.heightPx}px`;

    // Overlay canvas covers the photo canvas exactly
    this.overlayCanvas.style.position = 'absolute';
    this.overlayCanvas.style.top = '0';
    this.overlayCanvas.style.left = '0';

    // Crop frame fills the actual output size (no DPR scaling)
    this.cropFrameX = 0;
    this.cropFrameY = 0;
    this.cropFrameW = photoSize.widthPx;
    this.cropFrameH = photoSize.heightPx;

    // Setup preview canvas with 1:1 mapping
    this.previewCanvas.width = photoSize.widthPx;
    this.previewCanvas.height = photoSize.heightPx;
    this.previewCanvas.style.width = `${photoSize.widthPx}px`;
    this.previewCanvas.style.height = `${photoSize.heightPx}px`;
  }

  render(): void {
    if (!this.state.image) return;

    const img = this.state.image;
    const ctx = this.photoCtx;
    const photoSize = this.getPhotoSize();

    const canvasW = this.photoCanvas.width;
    const canvasH = this.photoCanvas.height;

    // Clear
    ctx.clearRect(0, 0, canvasW, canvasH);

    // The canvas represents the crop frame area (= photoSize in real pixels)
    // scale: percentage, 100% means image.naturalWidth * (photoSize.widthPx / img.naturalWidth) for fill
    const baseScale = Math.max(
      canvasW / img.naturalWidth,
      canvasH / img.naturalHeight
    );
    const userScale = this.state.scale / 100;
    const drawScale = baseScale * userScale;

    const drawW = img.naturalWidth * drawScale;
    const drawH = img.naturalHeight * drawScale;

    // offset is already in photoSize space (1:1 with canvas)
    const drawX = (canvasW - drawW) / 2 + this.state.offsetX;
    const drawY = (canvasH - drawH) / 2 + this.state.offsetY;

    // Apply beauty filters
    const filters: string[] = [];
    if (this.state.brightness !== 100) {
      filters.push(`brightness(${this.state.brightness}%)`);
    }
    ctx.filter = filters.length > 0 ? filters.join(' ') : 'none';

    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    // Apply smooth (blur blend)
    if (this.state.smooth > 0) {
      ctx.save();
      ctx.filter = `blur(${this.state.smooth}px)`;
      ctx.globalAlpha = 0.5;
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.restore();
    }

    // Apply brighten (screen overlay)
    if (this.state.brighten > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = `rgba(255, 255, 255, ${this.state.brighten / 100})`;
      ctx.fillRect(0, 0, canvasW, canvasH);
      ctx.restore();
    }

    ctx.filter = 'none';

    // Draw overlay (crop frame, guides)
    this.drawOverlay();

    // Draw single preview
    this.drawPreview();
  }

  private drawOverlay(): void {
    const ctx = this.overlayCtx;
    const w = this.overlayCanvas.width;
    const h = this.overlayCanvas.height;
    const photoSize = this.getPhotoSize();

    ctx.clearRect(0, 0, w, h);

    const params = PhotoEditor.GUIDE_PARAMS[this.state.photoType];
    // Guides are calculated in photoSize pixel space
    const cx = photoSize.widthPx / 2;
    const headCy = photoSize.heightPx * params.headCenterY;
    const headRx = photoSize.widthPx * params.headRx;
    const headRy = photoSize.heightPx * params.headRy;
    const chinY = headCy + headRy;

    ctx.save();
    // No DPR scaling needed - canvas is already in photoSize pixels

    // ── Face outline ────────────────────────────────────────────────────
    // Face shape defined ONCE in normalized space, scaled by a FIXED pixel
    // aspect ratio (FACE_ASPECT) so it looks identical across all photo types.
    // headRy controls size; FACE_ASPECT controls shape consistency.
    const FACE_ASPECT = 0.72;                     // natural face width:height ratio
    const faceRyPx = headRy;                      // already in pixels from headRy = displayH * params.headRy
    const faceRxPx = faceRyPx * FACE_ASPECT;      // half-width = 0.72 × height (always consistent)

    const earYn   = -0.12;
    const upperHn = earYn - (-1);   // 0.88
    const lowerHn = 1 - earYn;      // 1.12
    const k       = 0.55;
    const kChin   = 0.40;

    ctx.save();
    ctx.translate(cx, headCy);
    ctx.scale(faceRxPx, faceRyPx);  // uniform face shape regardless of photo type

    ctx.beginPath();
    ctx.moveTo(0, -1);   // crown
    ctx.bezierCurveTo( k,     -1,                   1, earYn - upperHn * k,  1, earYn );
    ctx.bezierCurveTo( 1,      earYn + lowerHn * k,  kChin, 1,               0, 1     );
    ctx.bezierCurveTo(-kChin,  1,                   -1, earYn + lowerHn * k, -1, earYn );
    ctx.bezierCurveTo(-1,      earYn - upperHn * k,  -k, -1,                 0, -1    );
    ctx.closePath();

    ctx.restore();  // back to display coords — path is already baked in screen space

    ctx.strokeStyle = 'rgba(0, 180, 255, 0.7)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.stroke();

    // ── Neck + shoulder curves ───────────────────────────────────────────
    if (params.showBody) {
      const shoulderY    = photoSize.heightPx * params.shoulderY;
      const shoulderHalfW = photoSize.widthPx * params.shoulderWidth / 2;
      const neckHalfW    = headRx * 0.42;

      ctx.strokeStyle = 'rgba(0, 180, 255, 0.6)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);

      // Left
      ctx.beginPath();
      ctx.moveTo(cx - neckHalfW, chinY);
      ctx.quadraticCurveTo(
        cx - neckHalfW, shoulderY - (shoulderY - chinY) * 0.3,
        cx - shoulderHalfW, shoulderY
      );
      ctx.stroke();

      // Right
      ctx.beginPath();
      ctx.moveTo(cx + neckHalfW, chinY);
      ctx.quadraticCurveTo(
        cx + neckHalfW, shoulderY - (shoulderY - chinY) * 0.3,
        cx + shoulderHalfW, shoulderY
      );
      ctx.stroke();
    }

    // ── Head-top / chin strict lines (2吋大頭照 etc.) ────────────────────
    if (params.headTopLine != null) {
      const topY = photoSize.heightPx * params.headTopLine;

      ctx.strokeStyle = 'rgba(255, 120, 0, 0.7)';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 5]);

      ctx.beginPath(); ctx.moveTo(0, topY); ctx.lineTo(photoSize.widthPx, topY); ctx.stroke();

      ctx.font = '11px sans-serif';
      ctx.fillStyle = 'rgba(255, 120, 0, 0.85)';
      ctx.setLineDash([]);
      ctx.fillText('頭頂', 6, topY - 5);
    }

    // ── Chin range lines (all types) ─────────────────────────────────────
    if (params.headBottomLineMin != null && params.headBottomLineMax != null) {
      const chinMinY = photoSize.heightPx * params.headBottomLineMin;
      const chinMaxY = photoSize.heightPx * params.headBottomLineMax;

      ctx.strokeStyle = 'rgba(200, 100, 200, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 6]);

      // Min line
      ctx.beginPath(); ctx.moveTo(0, chinMinY); ctx.lineTo(photoSize.widthPx, chinMinY); ctx.stroke();
      // Max line
      ctx.beginPath(); ctx.moveTo(0, chinMaxY); ctx.lineTo(photoSize.widthPx, chinMaxY); ctx.stroke();

      ctx.font = '10px sans-serif';
      ctx.fillStyle = 'rgba(200, 100, 200, 0.85)';
      ctx.setLineDash([]);
      ctx.fillText('下巴範圍', 6, (chinMinY + chinMaxY) / 2 + 5);
    }

    // ── Ear range lines (all types) ──────────────────────────────────────
    if (params.earLeftX != null && params.earRightX != null) {
      const earLeftX = photoSize.widthPx * params.earLeftX;
      const earRightX = photoSize.widthPx * params.earRightX;

      ctx.strokeStyle = 'rgba(0, 200, 100, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 6]);

      // Left ear line
      ctx.beginPath(); ctx.moveTo(earLeftX, 0); ctx.lineTo(earLeftX, photoSize.heightPx); ctx.stroke();
      // Right ear line
      ctx.beginPath(); ctx.moveTo(earRightX, 0); ctx.lineTo(earRightX, photoSize.heightPx); ctx.stroke();

      ctx.font = '10px sans-serif';
      ctx.fillStyle = 'rgba(0, 200, 100, 0.85)';
      ctx.setLineDash([]);
      ctx.fillText('耳朵', (earLeftX + earRightX) / 2 - 10, 15);
    }

    // ── Eye line (5×5 美簽) ───────────────────────────────────────────────
    if (params.eyeLine != null) {
      const eyeY = photoSize.heightPx * params.eyeLine;

      ctx.strokeStyle = 'rgba(0, 220, 120, 0.7)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);

      ctx.beginPath(); ctx.moveTo(0, eyeY); ctx.lineTo(photoSize.widthPx, eyeY); ctx.stroke();

      ctx.font = '11px sans-serif';
      ctx.fillStyle = 'rgba(0, 220, 120, 0.85)';
      ctx.setLineDash([]);
      ctx.fillText('眼睛對齊', 6, eyeY - 5);
    }

    // ── Center vertical guide (faint) ────────────────────────────────────
    ctx.strokeStyle = 'rgba(0, 180, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 8]);
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, photoSize.heightPx); ctx.stroke();

    ctx.restore();
  }

  private drawPreview(): void {
    if (!this.state.image) return;

    const img = this.state.image;
    const ctx = this.previewCtx;
    const photoSize = this.getPhotoSize();
    const pw = photoSize.widthPx;
    const ph = photoSize.heightPx;

    ctx.clearRect(0, 0, pw, ph);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, pw, ph);

    // Replicate the same drawing logic but at full DPI resolution
    const baseScale = Math.max(pw / img.naturalWidth, ph / img.naturalHeight);
    const userScale = this.state.scale / 100;
    const drawScale = baseScale * userScale;

    const drawW = img.naturalWidth * drawScale;
    const drawH = img.naturalHeight * drawScale;

    // offset is already in photoSize space
    const drawX = (pw - drawW) / 2 + this.state.offsetX;
    const drawY = (ph - drawH) / 2 + this.state.offsetY;

    const filters: string[] = [];
    if (this.state.brightness !== 100) {
      filters.push(`brightness(${this.state.brightness}%)`);
    }
    ctx.filter = filters.length > 0 ? filters.join(' ') : 'none';

    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    if (this.state.smooth > 0) {
      ctx.save();
      ctx.filter = `blur(${this.state.smooth}px)`;
      ctx.globalAlpha = 0.5;
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.restore();
    }

    if (this.state.brighten > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = `rgba(255, 255, 255, ${this.state.brighten / 100})`;
      ctx.fillRect(0, 0, pw, ph);
      ctx.restore();
    }

    ctx.filter = 'none';
  }

  /**
   * Render a single photo at full DPI onto the given canvas context.
   * Used by the export module.
   */
  renderToContext(
    ctx: CanvasRenderingContext2D,
    targetW: number,
    targetH: number
  ): void {
    if (!this.state.image) return;

    const img = this.state.image;

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, targetW, targetH);

    const baseScale = Math.max(targetW / img.naturalWidth, targetH / img.naturalHeight);
    const userScale = this.state.scale / 100;
    const drawScale = baseScale * userScale;

    const drawW = img.naturalWidth * drawScale;
    const drawH = img.naturalHeight * drawScale;

    // Convert offset from photoSize to target size
    // (photoSize = displayWidth/Height after setup)
    const offsetX = this.state.offsetX * (targetW / this.displayWidth);
    const offsetY = this.state.offsetY * (targetH / this.displayHeight);

    const drawX = (targetW - drawW) / 2 + offsetX;
    const drawY = (targetH - drawH) / 2 + offsetY;

    const filters: string[] = [];
    if (this.state.brightness !== 100) {
      filters.push(`brightness(${this.state.brightness}%)`);
    }
    ctx.filter = filters.length > 0 ? filters.join(' ') : 'none';

    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    if (this.state.smooth > 0) {
      ctx.save();
      ctx.filter = `blur(${Math.round(this.state.smooth * (targetW / this.displayWidth))}px)`;
      ctx.globalAlpha = 0.5;
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.restore();
    }

    if (this.state.brighten > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = `rgba(255, 255, 255, ${this.state.brighten / 100})`;
      ctx.fillRect(0, 0, targetW, targetH);
      ctx.restore();
    }

    ctx.filter = 'none';
  }

  private bindDragEvents(): void {
    // Use photoCanvas for drag since overlay has pointer-events: none
    this.photoCanvas.style.cursor = 'grab';

    this.photoCanvas.addEventListener('mousedown', (e) => {
      if (!this.state.image) return;
      this.isDragging = true;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.startOffsetX = this.state.offsetX;
      this.startOffsetY = this.state.offsetY;
      this.photoCanvas.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      // offsetX/Y stay in displayHeight space - screen pixels map 1:1
      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;
      this.state.offsetX = this.startOffsetX + dx;
      this.state.offsetY = this.startOffsetY + dy;
      this.render();
    });

    window.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.photoCanvas.style.cursor = 'grab';
      }
    });

    // Touch support
    this.photoCanvas.addEventListener('touchstart', (e) => {
      if (!this.state.image || e.touches.length !== 1) return;
      e.preventDefault();
      const touch = e.touches[0];
      this.isDragging = true;
      this.dragStartX = touch.clientX;
      this.dragStartY = touch.clientY;
      this.startOffsetX = this.state.offsetX;
      this.startOffsetY = this.state.offsetY;
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if (!this.isDragging) return;
      // offsetX/Y stay in displayHeight space - screen pixels map 1:1
      const touch = e.touches[0];
      const dx = touch.clientX - this.dragStartX;
      const dy = touch.clientY - this.dragStartY;
      this.state.offsetX = this.startOffsetX + dx;
      this.state.offsetY = this.startOffsetY + dy;
      this.render();
    });

    window.addEventListener('touchend', () => {
      this.isDragging = false;
    });
  }
}
