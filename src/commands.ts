import { invoke } from "@tauri-apps/api/core";
import { getImageFormat, isWebMode } from "@/helpers/utils";

export async function showSplashscreen() {
  if (isWebMode()) {
    return;
  }
  await invoke("show_splashscreen");
}
export async function closeSplashscreen() {
  if (isWebMode()) {
    return;
  }
  await invoke("close_splashscreen");
}

export async function imamgeConvert(
  file: string,
  target: string,
  qualities: Record<string, number>,
) {
  let format = getImageFormat(target);
  const quality = qualities[format] || 80;
  const result: {
    diff: number;
    hash: string;
    size: number;
    original_size: number;
  } = await invoke("image_convert", {
    file,
    target,
    quality,
  });
  return result;
}

export async function imageOptimize(
  file: string,
  qualities: Record<string, number>,
) {
  let format = getImageFormat(file);
  const quality = qualities[format] || 80;
  const result: {
    diff: number;
    hash: string;
    size: number;
    original_size: number;
  } = await invoke("image_optimize", {
    file,
    quality,
  });
  return result;
}

export async function restoreFile(hash: string, file: string) {
  const size: number = await invoke("restore_file", {
    hash,
    file,
  });
  return size;
}

export async function listFile(folders: string[], exts: string[]) {
  const files: string[] = await invoke("list_file", {
    folders,
    exts,
  });
  return files;
}
