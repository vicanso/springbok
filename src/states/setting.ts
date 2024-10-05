import { create } from "zustand";

interface Setting {
  supportFormats: string[];
  pngQuality: number;
  jpegQuality: number;
  avifQuality: number;
}

const key = "springbok.settings";

function saveSetting(setting: Setting) {
  localStorage.setItem(key, JSON.stringify(setting));
}

function getSetting() {
  const defaultSetting: Setting = {
    supportFormats: ["png", "jpeg"],
    pngQuality: 80,
    jpegQuality: 90,
    avifQuality: 70,
  };
  const data = localStorage.getItem(key);
  try {
    if (data) {
      Object.assign(defaultSetting, JSON.parse(data));
    }
  } catch (err) {
    console.error(err);
  }
  return defaultSetting;
}

interface SettingState {
  setting: Setting;
  getQualities: () => Record<string, number>;
  updateSupportFormats: (supportFormats: string[]) => void;
  updateQuality: (format: string, quality: number) => void;
}

const settingState = create<SettingState>()((set, get) => ({
  setting: getSetting(),
  getQualities: () => {
    const { setting } = get();
    const qualities: Record<string, number> = {
      png: setting.pngQuality,
      jpeg: setting.avifQuality,
      avif: setting.avifQuality,
    };

    return qualities;
  },
  updateSupportFormats: (supportFormats: string[]) => {
    const { setting } = get();
    setting.supportFormats = supportFormats || [];
    saveSetting(setting);
    set({
      setting,
    });
  },
  updateQuality: (format: string, quality: number) => {
    const { setting } = get();
    switch (format) {
      case "png": {
        setting.pngQuality = quality || 80;
        break;
      }
      default: {
        setting.jpegQuality = quality || 90;
        break;
      }
    }
    saveSetting(setting);
    set({
      setting,
    });
  },
}));

export default settingState;
