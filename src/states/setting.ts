import {
  cleanSettingFromStorage,
  getSettingFromStorage,
  setSettingToStorage,
} from "@/storages";
import { create } from "zustand";

interface Setting {
  supportFormats: string[];
  supportConverts: string[];
  pngQuality: number;
  jpegQuality: number;
  avifQuality: number;
  optimizeDisabled: boolean;
}

export enum ImageFormat {
  Png = "png",
  Jpeg = "jpeg",
  Avif = "avif",
  Webp = "webp",
}

function getSetting() {
  const defaultSetting: Setting = {
    supportFormats: [ImageFormat.Png, ImageFormat.Jpeg],
    supportConverts: [],
    pngQuality: 90,
    jpegQuality: 90,
    avifQuality: 70,
    optimizeDisabled: false,
  };

  Object.assign(defaultSetting, getSettingFromStorage());
  return defaultSetting;
}

interface SettingState {
  setting: Setting;
  reset: () => void;
  isSupportedFormat: (format: string) => boolean;
  isSupportedConvert: (original: string, format: string) => boolean;
  toggleSupportedFormat: (format: string) => void;
  toggleSupportedConvert: (original: string, format: string) => void;
  getQualities: () => Record<string, number>;
  getConvertFormats: () => Record<string, string[]>;
  updateSupportFormats: (supportFormats: string[]) => void;
  updateQuality: (format: string, quality: number) => void;
  updateOptimizeDisabled: (disabled: boolean) => void;
}

const settingState = create<SettingState>()((set, get) => ({
  setting: getSetting(),
  reset: () => {
    cleanSettingFromStorage();
    set({
      setting: getSetting(),
    });
  },
  isSupportedConvert: (original: string, format: string) => {
    return get().setting.supportConverts.includes(`${original}-${format}`);
  },
  toggleSupportedConvert: (original: string, format: string) => {
    const { setting } = get();
    const value = `${original}-${format}`;
    const index = setting.supportConverts.indexOf(value);
    if (index >= 0) {
      setting.supportConverts.splice(index, 1);
    } else {
      setting.supportConverts.push(value);
    }
    setSettingToStorage(setting);
    set({
      setting,
    });
  },
  isSupportedFormat: (format: string) => {
    return get().setting.supportFormats.includes(format);
  },
  toggleSupportedFormat: (format: string) => {
    const { setting } = get();
    const index = setting.supportFormats.indexOf(format);
    if (index >= 0) {
      setting.supportFormats.splice(index, 1);
    } else {
      setting.supportFormats.push(format);
    }
    setSettingToStorage(setting);
    set({
      setting,
    });
  },
  getQualities: () => {
    const { setting } = get();
    const qualities: Record<string, number> = {
      png: setting.pngQuality,
      jpeg: setting.avifQuality,
      avif: setting.avifQuality,
    };
    return qualities;
  },
  getConvertFormats: () => {
    const formats: Record<string, string[]> = {};
    get().setting.supportConverts.forEach((item) => {
      const arr = item.split("-");
      if (arr.length !== 2) {
        return;
      }
      const name = arr[0];
      if (!formats[name]) {
        formats[name] = [];
      }
      formats[name].push(arr[1]);
    });
    return formats;
  },
  updateSupportFormats: (supportFormats: string[]) => {
    const { setting } = get();
    setting.supportFormats = supportFormats || [];
    setSettingToStorage(setting);
    set({
      setting,
    });
  },
  updateOptimizeDisabled: (disabled: boolean) => {
    const { setting } = get();
    setting.optimizeDisabled = disabled;
    setSettingToStorage(setting);
    set({
      setting,
    });
  },
  updateQuality: (format: string, quality: number) => {
    const { setting } = get();
    switch (format) {
      case ImageFormat.Png: {
        setting.pngQuality = quality || 80;
        break;
      }
      case ImageFormat.Avif: {
        setting.avifQuality = quality || 70;
        break;
      }
      default: {
        setting.jpegQuality = quality || 90;
        break;
      }
    }
    setSettingToStorage(setting);
    set({
      setting,
    });
  },
}));

export default settingState;
