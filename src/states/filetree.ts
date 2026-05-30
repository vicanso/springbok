import {
  imageOptimize,
  imamgeConvert,
  listFile,
  restoreFile,
  stripExifFile,
  hasBackupFile,
} from "@/commands";
import { formatError, getFileExt, getImageFormat } from "@/helpers/utils";
import { getOptimizedFileHash, setOptimizedFileHash } from "@/storages";
import { create } from "zustand";

export enum Status {
  Pending = 0,
  Processing,
  NotModified,
  Success,
  Fail,
  NotSupported,
  Ignored,
}
export interface File {
  status: Status;
  path: string;
  original?: string;
  size: number;
  savings: number;
  diff: number;
  message?: string;
  hash?: string;
  width?: number;
  height?: number;
}

interface FiletreeState {
  files: File[];
  processing: boolean;
  clean: () => void;
  mock: () => void;
  stats: () => {
    totalSize: number;
    savingsSize: number;
    top: number;
    average: number;
  };
  start: (qualities: Record<string, number>, optimizeDisabled: boolean, outputDir: string, convertFormats: Record<string, string[]>, concurrency: number) => void;
  stripAllExif: (outputDir: string) => Promise<void>;
  restore: (hash: string, file: string) => Promise<void>;
  add: (...files: string[]) => Promise<void>;
}

function resetFile(file: File, resetPath = true) {
  file.status = Status.Pending;
  if (resetPath) {
    file.path = "";
  }
  file.size = -1;
  file.savings = Number.NEGATIVE_INFINITY;
  file.diff = -1;
  return file;
}

const filetreeState = create<FiletreeState>()((set, get) => ({
  processing: false,
  files: [],
  mock: () => {
    set({
      files: [
        {
          status: Status.Pending,
          path: "~/Downloads/pending.png",
          size: -1,
          savings: -1,
          diff: -1,
        },
        {
          status: Status.Processing,
          path: "~/Downloads/processing.png",
          size: -1,
          savings: -1,
          diff: -1,
        },
        {
          status: Status.NotModified,
          path: "~/Downloads/favicon.png",
          size: 5181,
          savings: 0,
          diff: 0,
        },
        {
          status: Status.Success,
          path: "~/Downloads/icon.png",
          size: 5181,
          savings: 0.123,
          diff: 0.001,
          hash: "blake3",
        },
        {
          status: Status.Fail,
          message: "Fail",
          path: "~/Downloads/pingap.png",
          size: 1023,
          savings: -1,
          diff: 0.012,
        },
      ],
    });
  },
  clean: () => {
    if (get().processing) {
      return false;
    }
    set({
      files: [],
    });
    return true;
  },
  add: async (...items: string[]) => {
    const formats = ["png", "jpg", "jpeg"];
    const files: string[] = [];
    const folders: string[] = [];
    const others: string[] = [];
    items.forEach((item) => {
      const ext = getFileExt(item);
      if (!ext) {
        folders.push(item);
        return;
      }
      if (!formats.includes(ext)) {
        others.push(item);
      }
      files.push(item);
    });
    if (folders.length !== 0) {
      const data = await listFile(folders, formats);
      files.push(...data);
    }

    set((state) => {
      const exists: Record<string, boolean> = {};
      // Only deduplicate against source files
      state.files.forEach((item) => {
        if (!item.original) exists[item.path] = true;
      });
      const arr: File[] = [];
      files.forEach((path) => {
        if (!path || exists[path]) return;
        const file = resetFile({} as File);
        file.path = path;
        if (others.includes(path)) file.status = Status.NotSupported;
        arr.push(file);
      });
      state.files.push(...arr);
      return { files: state.files };
    });
  },
  start: (
    qualities: Record<string, number>,
    optimizeDisabled: boolean,
    outputDir: string,
    convertFormats: Record<string, string[]>,
    concurrency: number,
  ) => {
    if (get().processing) return;

    // Rebuild file list with current settings
    set((state) => {
      const sourceFiles = state.files.filter((f) => !f.original);
      sourceFiles.forEach((f) => {
        if (f.status !== Status.NotSupported) resetFile(f, false);
      });
      const conversionEntries: File[] = [];
      sourceFiles.forEach((sourceFile) => {
        if (sourceFile.status === Status.NotSupported) return;
        const path = sourceFile.path;
        const ext = getFileExt(path);
        const format = getImageFormat(path);
        const basename = path.replace(/\\/g, "/").split("/").pop()!;
        const targetBase = outputDir
          ? `${outputDir}/${basename.substring(0, basename.length - ext.length)}`
          : path.substring(0, path.length - ext.length);
        (convertFormats[format] || []).forEach((convExt) => {
          const target = targetBase + convExt;
          if (!target) return;
          const f = resetFile({} as File);
          f.original = path;
          f.path = target;
          conversionEntries.push(f);
        });
      });
      return { files: [...sourceFiles, ...conversionEntries] };
    });

    // Group by source file: optimization first, then conversions (same source must be serial)
    const groupMap = new Map<string, File[]>();
    get().files.forEach((file) => {
      if (file.status === Status.NotSupported) return;
      const key = file.original ?? file.path;
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(file);
    });
    const groups = Array.from(groupMap.values()).map((g) =>
      g.sort((a, b) => (a.original ? 1 : 0) - (b.original ? 1 : 0)),
    );

    if (groups.length === 0) return;
    set({ processing: true });

    const flush = () => set({ files: [...get().files] });

    const processFile = async (file: File): Promise<void> => {
      file.status = Status.Processing;
      flush();
      try {
        let data;
        if (file.original) {
          data = await imamgeConvert(file.original, file.path, qualities);
        } else if (optimizeDisabled) {
          file.status = Status.Ignored;
          flush();
          return;
        } else {
          // Skip if already optimized in a previous session
          const storedHash = getOptimizedFileHash(file.path);
          if (storedHash && await hasBackupFile(storedHash)) {
            file.status = Status.Ignored;
            flush();
            return;
          }
          let outputFile: string | undefined;
          if (outputDir) {
            const basename = file.path.replace(/\\/g, "/").split("/").pop()!;
            outputFile = `${outputDir}/${basename}`;
          }
          data = await imageOptimize(file.path, qualities, outputFile);
        }
        file.width = data.width;
        file.height = data.height;
        file.size = data.size;
        file.savings = 1 - data.size / data.original_size;
        file.status = file.savings > 0 ? Status.Success : Status.NotModified;
        file.diff = data.diff;
        file.hash = data.hash;
        // Record hash so the file can be skipped on future runs
        if (file.hash && !outputDir) {
          setOptimizedFileHash(file.path, file.hash);
        }
      } catch (err) {
        const error = formatError(err);
        file.status = Status.Fail;
        file.message = `${error.message}[${error.category}]`;
      }
      flush();
    };

    const processGroup = async (group: File[]): Promise<void> => {
      for (const file of group) {
        await processFile(file);
      }
    };

    // Dispatch groups with limited concurrency
    const limit = Math.max(1, concurrency);
    const queue = [...groups];
    let active = 0;
    new Promise<void>((resolve) => {
      const dispatch = () => {
        if (queue.length === 0 && active === 0) { resolve(); return; }
        while (active < limit && queue.length > 0) {
          active++;
          processGroup(queue.shift()!).then(() => { active--; dispatch(); });
        }
      };
      dispatch();
    }).then(() => set({ processing: false }));
  },
  stripAllExif: async (outputDir: string) => {
    const { files } = get();
    set({ processing: true });
    for (const file of files) {
      if (file.status === Status.NotSupported || file.status === Status.Ignored) {
        continue;
      }
      try {
        let outputFile: string | undefined;
        if (outputDir) {
          const basename = file.path.replace(/\\/g, "/").split("/").pop()!;
          outputFile = `${outputDir}/${basename}`;
        }
        const size = await stripExifFile(file.path, outputFile);
        file.size = size;
      } catch (e) {
        console.error(e);
      }
    }
    set({ files, processing: false });
  },
  restore: async (hash: string, file: string) => {
    const { files } = get();
    const size = await restoreFile(hash, file);
    const found = files.find((item) => item.path == file);
    if (found) {
      resetFile(found, false);
      found.status = Status.NotModified;
      found.size = size;
      set({
        files,
      });
    }
  },
  stats: () => {
    const { files } = get();
    let totalSize = 0;
    let savingsSize = 0;
    let top = 0;
    let average = 0;
    let count = 0;
    files.forEach((file) => {
      if (
        file.status !== Status.Success ||
        file.savings <= 0 ||
        file.original
      ) {
        return;
      }
      count++;
      average += file.savings;
      if (file.savings > top) {
        top = file.savings;
      }
      let original_size = file.size / (1 - file.savings);
      totalSize += original_size;
      savingsSize += original_size - file.size;
    });
    if (count) {
      average = average / count;
    }
    return {
      totalSize,
      savingsSize,
      average,
      top,
    };
  },
}));

export default filetreeState;
