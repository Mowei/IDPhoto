import { EditorState } from './types';

export class BeautyControls {
  private smoothSlider: HTMLInputElement;
  private brightenSlider: HTMLInputElement;
  private brightnessSlider: HTMLInputElement;
  private smoothValue: HTMLElement;
  private brightenValue: HTMLElement;
  private brightnessValue: HTMLElement;

  constructor(
    private state: EditorState,
    private onUpdate: () => void
  ) {
    this.smoothSlider = document.getElementById('smoothSlider') as HTMLInputElement;
    this.brightenSlider = document.getElementById('brightenSlider') as HTMLInputElement;
    this.brightnessSlider = document.getElementById('brightnessSlider') as HTMLInputElement;
    this.smoothValue = document.getElementById('smoothValue')!;
    this.brightenValue = document.getElementById('brightenValue')!;
    this.brightnessValue = document.getElementById('brightnessValue')!;

    this.bindEvents();
  }

  private bindEvents(): void {
    this.smoothSlider.addEventListener('input', () => {
      this.state.smooth = parseInt(this.smoothSlider.value);
      this.smoothValue.textContent = this.smoothSlider.value;
      this.onUpdate();
    });

    this.brightenSlider.addEventListener('input', () => {
      this.state.brighten = parseInt(this.brightenSlider.value);
      this.brightenValue.textContent = this.brightenSlider.value;
      this.onUpdate();
    });

    this.brightnessSlider.addEventListener('input', () => {
      this.state.brightness = parseInt(this.brightnessSlider.value);
      this.brightnessValue.textContent = `${this.brightnessSlider.value}%`;
      this.onUpdate();
    });

    document.getElementById('resetBeauty')!.addEventListener('click', () => {
      this.reset();
    });
  }

  private reset(): void {
    this.state.smooth = 0;
    this.state.brighten = 0;
    this.state.brightness = 100;

    this.smoothSlider.value = '0';
    this.brightenSlider.value = '0';
    this.brightnessSlider.value = '100';

    this.smoothValue.textContent = '0';
    this.brightenValue.textContent = '0';
    this.brightnessValue.textContent = '100%';

    this.onUpdate();
  }
}
