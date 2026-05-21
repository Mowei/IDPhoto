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

  // Guide overlay images
  private headGuideImg: HTMLImageElement | null = null;
  private halfBodyGuideImg: HTMLImageElement | null = null;

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

    this.loadGuideImages();
    this.bindDragEvents();
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

  private loadGuideImages(): void {
    this.headGuideImg = new Image();
    this.headGuideImg.src = '/大頭照參考線.png';

    this.halfBodyGuideImg = new Image();
    this.halfBodyGuideImg.src = '/半身照參考線.png';
  }

  onTypeChange(): void {
    if (this.state.image) {
      this.setupCanvas();
      this.render();
    }
  }

  onImageLoaded(): void {
    this.placeholder.classList.add('hidden');
    this.zoomControls.classList.add('visible');
    this.singlePreview.classList.add('visible');

    // Auto-scale to fit crop frame
    this.autoFitScale();
    this.setupCanvas();
    this.render();
  }

  private autoFitScale(): void {
    const img = this.state.image!;
    const photoSize = this.getPhotoSize();
    const ratio = photoSize.widthPx / photoSize.heightPx;

    // Calculate scale so image fills the crop area
    // We work in a normalized coordinate system where crop frame = photoSize pixels
    const scaleToFillW = photoSize.widthPx / img.naturalWidth;
    const scaleToFillH = photoSize.heightPx / img.naturalHeight;
    const fillScale = Math.max(scaleToFillW, scaleToFillH);

    // Convert to percentage (100% = image exactly fills crop frame on the larger dimension)
    this.state.scale = Math.ceil(fillScale * 100);
    this.state.offsetX = 0;
    this.state.offsetY = 0;

    // Update zoom slider
    const zoomSlider = document.getElementById('zoomSlider') as HTMLInputElement;
    const zoomValue = document.getElementById('zoomValue')!;
    zoomSlider.value = String(this.state.scale);
    zoomValue.textContent = `${this.state.scale}%`;
  }

  private setupCanvas(): void {
    const rect = this.container.getBoundingClientRect();
    const containerW = rect.width;
    const containerH = rect.height;

    const photoSize = this.getPhotoSize();
    const aspectRatio = photoSize.widthPx / photoSize.heightPx;

    // Fit the canvas within the container with some padding
    const padding = 40;
    const maxW = containerW - padding * 2;
    const maxH = containerH - padding * 2;

    if (maxW / maxH > aspectRatio) {
      this.displayHeight = maxH;
      this.displayWidth = maxH * aspectRatio;
    } else {
      this.displayWidth = maxW;
      this.displayHeight = maxW / aspectRatio;
    }

    // Make canvases larger for sharp rendering
    const dpr = window.devicePixelRatio || 1;
    const canvasW = Math.round(this.displayWidth * dpr);
    const canvasH = Math.round(this.displayHeight * dpr);

    this.photoCanvas.width = canvasW;
    this.photoCanvas.height = canvasH;
    this.photoCanvas.style.width = `${this.displayWidth}px`;
    this.photoCanvas.style.height = `${this.displayHeight}px`;

    this.overlayCanvas.width = canvasW;
    this.overlayCanvas.height = canvasH;
    this.overlayCanvas.style.width = `${this.displayWidth}px`;
    this.overlayCanvas.style.height = `${this.displayHeight}px`;

    // Crop frame fills the full canvas display area
    this.cropFrameX = 0;
    this.cropFrameY = 0;
    this.cropFrameW = canvasW;
    this.cropFrameH = canvasH;

    // Setup preview canvas
    const previewMaxW = 180;
    const previewH = previewMaxW / aspectRatio;
    this.previewCanvas.width = photoSize.widthPx;
    this.previewCanvas.height = photoSize.heightPx;
    this.previewCanvas.style.width = `${previewMaxW}px`;
    this.previewCanvas.style.height = `${previewH}px`;
  }

  render(): void {
    if (!this.state.image) return;

    const img = this.state.image;
    const dpr = window.devicePixelRatio || 1;
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

    // Center image + apply offset (offset is in canvas pixels)
    const drawX = (canvasW - drawW) / 2 + this.state.offsetX * dpr;
    const drawY = (canvasH - drawH) / 2 + this.state.offsetY * dpr;

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

    ctx.clearRect(0, 0, w, h);

    // Pick the correct guide image: half body guide only for TwoInchHalf
    const guideImg =
      this.state.photoType === PhotoType.TwoInchHalf
        ? this.halfBodyGuideImg
        : this.headGuideImg;

    if (guideImg && guideImg.complete && guideImg.naturalWidth > 0) {
      ctx.drawImage(guideImg, 0, 0, w, h);
    }
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

    // Map offset from display coords to DPI coords
    const dpr = window.devicePixelRatio || 1;
    const scaleFactorX = pw / (this.displayWidth * dpr);
    const scaleFactorY = ph / (this.displayHeight * dpr);
    const offsetX = this.state.offsetX * dpr * scaleFactorX;
    const offsetY = this.state.offsetY * dpr * scaleFactorY;

    const drawX = (pw - drawW) / 2 + offsetX;
    const drawY = (ph - drawH) / 2 + offsetY;

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

    // Map offset from display coords to target coords
    const dpr = window.devicePixelRatio || 1;
    const displayCanvasW = this.displayWidth * dpr;
    const displayCanvasH = this.displayHeight * dpr;
    const scaleFactorX = targetW / displayCanvasW;
    const scaleFactorY = targetH / displayCanvasH;
    const offsetX = this.state.offsetX * dpr * scaleFactorX;
    const offsetY = this.state.offsetY * dpr * scaleFactorY;

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
      ctx.filter = `blur(${Math.round(this.state.smooth * (targetW / displayCanvasW))}px)`;
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
