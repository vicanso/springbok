const keyPrefix = "springbok";

const themeKey = `${keyPrefix}.theme`;
const windowSizeKey = `${keyPrefix}.windowSize`;
const settingKey = `${keyPrefix}.setting`;

export function cleanSettingFromStorage() {
  [themeKey, windowSizeKey, settingKey].forEach((key) => {
    localStorage.removeItem(key);
  });
}

export function getThemFromStorage() {
  return localStorage.getItem(themeKey);
}
export function setThemeToStorage(value: string) {
  localStorage.setItem(themeKey, value);
}

interface WindowSize {
  width: number;
  height: number;
}
export function getWindowSizeFromStorage() {
  const data = localStorage.getItem(windowSizeKey);
  if (!data) {
    return;
  }
  try {
    const size: WindowSize = JSON.parse(data);
    return size;
  } catch (err) {
    console.dir(err);
  }
}
export function setWindowSizeToStorage(size: WindowSize) {
  localStorage.setItem(windowSizeKey, JSON.stringify(size));
}

export function getSettingFromStorage() {
  const data = localStorage.getItem(settingKey);
  if (!data) {
    return;
  }
  try {
    const setting = JSON.parse(data);
    return setting;
  } catch (err) {
    console.dir(err);
  }
}
export function setSettingToStorage(setting: any) {
  localStorage.setItem(settingKey, JSON.stringify(setting));
}
