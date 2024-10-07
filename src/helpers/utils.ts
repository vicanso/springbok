import { listen, TauriEvent, UnlistenFn } from "@tauri-apps/api/event";
import { eol } from "@tauri-apps/plugin-os";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";

type DropFilesEventCallback = (files: string[]) => void;

export function isWebMode() {
  return !window.hasOwnProperty("__TAURI__");
}

const dropFilesEventCallbacks: DropFilesEventCallback[] = [];
interface WindowSize {
  width: number;
  height: number;
}

const windowSizeKey = "springbok.windowSize";

function getWindowSize() {
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

export async function initWindow() {
  if (isWebMode()) {
    return;
  }
  const win = getCurrentWindow();
  const scale = await win.scaleFactor();
  const size = getWindowSize();
  if (size) {
    await win.setSize(new LogicalSize(size.width, size.height));
    await win.center();
  }
  win.onResized((event) => {
    const size = event.payload.toLogical(scale);
    localStorage.setItem(
      windowSizeKey,
      JSON.stringify({
        width: size.width,
        height: size.height,
      }),
    );
  });
}

export function formatError(err: unknown) {
  let category = "unkown";
  let message = new String(err);
  if (typeof err === "string") {
    try {
      const data = JSON.parse(err);
      if (data.category) {
        category = data.category as string;
      }
      if (data.message) {
        message = data.message as string;
      }
    } catch (_e) {}
  }

  return {
    category,
    message,
  };
}

export function listenDragDrop(fn: DropFilesEventCallback) {
  dropFilesEventCallbacks.push(fn);
  return () => {
    unlistenDragDrop(fn);
  };
}
function unlistenDragDrop(fn: DropFilesEventCallback) {
  const index = dropFilesEventCallbacks.indexOf(fn);
  if (index >= 0) {
    dropFilesEventCallbacks.splice(index, 1);
  }
}

export async function initListenDragDrop(): Promise<UnlistenFn> {
  if (isWebMode()) {
    // TODO mock
    return () => {};
  }

  const unlisten = await listen<{
    paths: string[];
  }>(TauriEvent.DRAG_DROP, (event) => {
    const paths = event.payload.paths || [];
    dropFilesEventCallbacks.forEach((fn) => {
      fn(paths);
    });
  });
  return unlisten;
}

export const formatSize = (size: number) => {
  if (size < 0) {
    return "";
  }
  const mb = 1000 * 1000;
  if (size > mb) {
    return `${(size / mb).toFixed(2)} MB`;
  }
  return size.toLocaleString();
};

export const formatBytes = (size: number) => {
  if (size <= 0) {
    return "0 B";
  }
  const kb = 1000;
  const mb = 1000 * kb;
  if (size > mb) {
    return `${(size / mb).toFixed(2)} MB`;
  }
  if (size > kb) {
    return `${(size / kb).toFixed(2)} KB`;
  }
  return `${size.toLocaleString()} B`;
};

export const formatSavings = (savings: number) => {
  if (savings < 0) {
    return "";
  }
  return (savings * 100).toFixed(1) + "%";
};

export const formatFile = (path: string) => {
  let separator = "/";
  if (!isWebMode()) {
    separator = eol();
  }
  const arr = path.replace(separator, "/").split("/");
  return arr[arr.length - 1];
};

export const formatDiff = (diff: number) => {
  if (diff < 0) {
    return "";
  }
  if (diff < 10) {
    return diff.toFixed(2);
  }
  if (diff > 100) {
    return "NaN";
  }
  return Number.parseInt(diff.toString()).toString();
};

export const getFileExt = (file: string) => {
  const arr = file.split(".");
  if (arr.length < 2) {
    return "";
  }
  return arr[arr.length - 1].toLowerCase();
};
