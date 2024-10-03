import { listen, TauriEvent, UnlistenFn } from "@tauri-apps/api/event";

type DropFilesEventCallback = (files: string[]) => void;

export function isWebMode() {
  return !window.__TAURI__;
}

const dropFilesEventCallbacks: DropFilesEventCallback[] = [];

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
