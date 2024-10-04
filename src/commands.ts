import { invoke } from "@tauri-apps/api/core";
import { getFileExt } from "@/helpers/utils";

export async function imageOptimize(file: string) {
  let format = getFileExt(file);
  if (format === "jpg") {
    format = "jpeg";
  }
  const result: {
    diff: number;
    hash: string;
    size: number;
    original_size: number;
  } = await invoke("image_optimize", {
    file,
    // TODO get from local storage
    quality: 90,
    format,
  });
  return result;
}
