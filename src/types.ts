export enum PhotoType {
  TwoInchHead = 'twoInchHead',
  TwoInchHalf = 'twoInchHalf',
  OneInchHalf = 'oneInchHalf',
  Combo = 'combo',
}

export interface PhotoSize {
  widthMm: number;
  heightMm: number;
  widthPx: number;
  heightPx: number;
  label: string;
}

export interface LayoutConfig {
  canvasWidth: number;
  canvasHeight: number;
  cols: number;
  rows: number;
  photoSize: PhotoSize;
  label: string;
}

export interface ComboLayoutConfig {
  canvasWidth: number;
  canvasHeight: number;
  left: { cols: number; rows: number; photoSize: PhotoSize };
  right: { cols: number; rows: number; photoSize: PhotoSize };
  label: string;
}

export interface EditorState {
  photoType: PhotoType;
  image: HTMLImageElement | null;
  offsetX: number;
  offsetY: number;
  scale: number;
  smooth: number;
  brighten: number;
  brightness: number;
}

// 照片尺寸常數 @300DPI
export const PHOTO_SIZES: Record<string, PhotoSize> = {
  twoInch: {
    widthMm: 35,
    heightMm: 45,
    widthPx: 435,
    heightPx: 555,
    label: '兩吋',
  },
  oneInch: {
    widthMm: 25,
    heightMm: 30,
    widthPx: 354,
    heightPx: 437,
    label: '一吋',
  },
};

// 照片之間框線寬度
export const GRID_BORDER = 3;

// 4x6 吋 @300DPI
export const PRINT_WIDTH = 1200;
export const PRINT_HEIGHT = 1800;

// 版面配置
export const LAYOUTS: Record<string, LayoutConfig> = {
  twoInch: {
    canvasWidth: PRINT_WIDTH,
    canvasHeight: PRINT_HEIGHT,
    cols: 3,
    rows: 2,
    photoSize: PHOTO_SIZES.twoInch,
    label: '兩吋',
  },
  oneInch: {
    canvasWidth: PRINT_HEIGHT, // 橫式 1800×1200
    canvasHeight: PRINT_WIDTH,
    cols: 4,
    rows: 2,
    photoSize: PHOTO_SIZES.oneInch,
    label: '一吋',
  },
};

export const COMBO_LAYOUT: ComboLayoutConfig = {
  canvasWidth: PRINT_WIDTH,
  canvasHeight: PRINT_HEIGHT,
  left: { cols: 2, rows: 2, photoSize: PHOTO_SIZES.twoInch },
  right: { cols: 2, rows: 2, photoSize: PHOTO_SIZES.oneInch },
  label: '兩吋+一吋',
};

// 品牌標注
export const BRAND_TEXT = '證件照';
export const BRAND_SUB = '輸出';

// 裁切框比例（頭頂/下巴/肩膀參考線比例）
export const HEAD_GUIDE = {
  topRatio: 0.08,
  chinRatio: 0.65,
};

export const HALF_BODY_GUIDE = {
  topRatio: 0.05,
  shoulderRatio: 0.55,
};
