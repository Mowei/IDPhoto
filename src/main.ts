import { PhotoType, EditorState } from './types';
import { PhotoEditor } from './photo-editor';
import { BeautyControls } from './beauty';
import { ExportManager } from './export';

class App {
  private state: EditorState = {
    photoType: PhotoType.TwoInchHead,
    image: null,
    offsetX: 0,
    offsetY: 0,
    scale: 100,
    smooth: 0,
    brighten: 0,
    brightness: 100,
  };

  private editor!: PhotoEditor;
  private beauty!: BeautyControls;
  private exportManager!: ExportManager;

  constructor() {
    this.editor = new PhotoEditor(this.state);
    this.beauty = new BeautyControls(this.state, () => this.editor.render());
    this.exportManager = new ExportManager(this.state);
    this.bindEvents();
  }

  private bindEvents(): void {
    // Photo type radios
    const radios = document.querySelectorAll<HTMLInputElement>('input[name="photoType"]');
    radios.forEach((radio) => {
      radio.addEventListener('change', () => {
        this.state.photoType = radio.value as PhotoType;
        this.editor.onTypeChange();
      });
    });

    // File input
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (!file) return;

      const fileName = document.getElementById('fileName')!;
      fileName.textContent = file.name;

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          this.state.image = img;
          this.editor.onImageLoaded();
        };
        img.src = e.target!.result as string;
      };
      reader.readAsDataURL(file);
    });

    // Zoom controls
    const zoomSlider = document.getElementById('zoomSlider') as HTMLInputElement;
    const zoomValue = document.getElementById('zoomValue')!;
    const zoomIn = document.getElementById('zoomIn')!;
    const zoomOut = document.getElementById('zoomOut')!;

    zoomSlider.addEventListener('input', () => {
      this.state.scale = parseInt(zoomSlider.value);
      zoomValue.textContent = `${this.state.scale}%`;
      this.editor.render();
    });

    zoomIn.addEventListener('click', () => {
      this.state.scale = Math.min(300, this.state.scale + 5);
      zoomSlider.value = String(this.state.scale);
      zoomValue.textContent = `${this.state.scale}%`;
      this.editor.render();
    });

    zoomOut.addEventListener('click', () => {
      this.state.scale = Math.max(10, this.state.scale - 5);
      zoomSlider.value = String(this.state.scale);
      zoomValue.textContent = `${this.state.scale}%`;
      this.editor.render();
    });

    // Export buttons
    document.getElementById('exportPrint')!.addEventListener('click', () => {
      this.exportManager.exportPrintLayout();
    });

    document.getElementById('exportSingle')!.addEventListener('click', () => {
      this.exportManager.exportSingle();
    });
  }
}

new App();
