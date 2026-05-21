export enum PhotoType {
  OneInch = 'oneInch',
  TwoInchHead = 'twoInchHead',
  TwoInchHalf = 'twoInchHalf',
  ThreeByFour = 'threeByFour',
  FiveByFive = 'fiveByFive',
}

export interface PhotoSize {
  widthMm: number;
  heightMm: number;
  widthPx: number;
  heightPx: number;
  label: string;
}

export interface LayoutConfig {
  cols: number;
  rows: number;
  photoSize: PhotoSize;
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

// 照片尺寸常數 @300DPI (px = cm / 2.54 * 300)
export const PHOTO_SIZES: Record<string, PhotoSize> = {
  oneInch: {
    widthMm: 28,
    heightMm: 35,
    widthPx: 331,
    heightPx: 413,
    label: '1吋大頭貼',
  },
  twoInchHead: {
    widthMm: 35,
    heightMm: 45,
    widthPx: 413,
    heightPx: 531,
    label: '2吋大頭照',
  },
  twoInchHalf: {
    widthMm: 42,
    heightMm: 47,
    widthPx: 496,
    heightPx: 555,
    label: '2吋半身照',
  },
  threeByFour: {
    widthMm: 30,
    heightMm: 40,
    widthPx: 354,
    heightPx: 472,
    label: '3×4大頭照',
  },
  fiveByFive: {
    widthMm: 50,
    heightMm: 50,
    widthPx: 591,
    heightPx: 591,
    label: '5×5大頭照',
  },
};

// 照片之間框線寬度
export const GRID_BORDER = 3;

// 4×6 吋 @300DPI (直式)
export const PRINT_WIDTH = 1200;
export const PRINT_HEIGHT = 1800;

// 版面配置 (直式 1200×1800)
export const LAYOUTS: Record<string, LayoutConfig> = {
  oneInch: {
    cols: 3,
    rows: 4,
    photoSize: PHOTO_SIZES.oneInch,
    label: '1吋大頭貼',
  },
  twoInchHead: {
    cols: 2,
    rows: 3,
    photoSize: PHOTO_SIZES.twoInchHead,
    label: '2吋大頭照',
  },
  twoInchHalf: {
    cols: 2,
    rows: 3,
    photoSize: PHOTO_SIZES.twoInchHalf,
    label: '2吋半身照',
  },
  threeByFour: {
    cols: 3,
    rows: 3,
    photoSize: PHOTO_SIZES.threeByFour,
    label: '3×4大頭照',
  },
  fiveByFive: {
    cols: 2,
    rows: 2,
    photoSize: PHOTO_SIZES.fiveByFive,
    label: '5×5大頭照',
  },
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
