import { imageOptimize, listFile, restoreFile } from "@/commands";
import { formatError, getFileExt } from "@/helpers/utils";
import { create } from "zustand";

export enum Status {
  Pending = 0,
  Processing,
  NotModified,
  Success,
  Fail,
  NotSupported,
}
interface File {
  status: Status;
  path: string;
  size: number;
  savings: number;
  diff: number;
  message?: string;
  hash?: string;
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
  optim: (qualities: Record<string, number>) => void;
  start: (qualities: Record<string, number>) => void;
  reset: () => void;
  restore: (hash: string, file: string) => Promise<void>;
  add: (...files: string[]) => Promise<void>;
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
    // filter folder and file
    // only support decode jpeg png
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
      state.files.forEach((item) => {
        exists[item.path] = true;
      });
      const arr: File[] = [];
      files.forEach((path) => {
        if (exists[path]) {
          return;
        }
        const file = {
          status: Status.Pending,
          path,
          size: -1,
          savings: -1,
          diff: -1,
        };
        if (others.includes(path)) {
          file.status = Status.NotSupported;
        }
        arr.push(file);
      });
      state.files.push(...arr);
      return {
        files: state.files,
      };
    });
  },
  start: (qualities: Record<string, number>) => {
    const { processing, optim } = get();
    if (!processing) {
      optim(qualities);
    }
  },
  restore: async (hash: string, file: string) => {
    const { files } = get();
    const size = await restoreFile(hash, file);
    const found = files.find((item) => item.path == file);
    if (found) {
      found.status = Status.NotModified;
      found.diff = -1;
      found.hash = "";
      found.savings = -1;
      found.size = size;
      set({
        files,
      });
    }
  },
  reset: () => {
    const { files } = get();
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      file.status = Status.Pending;
      file.size = -1;
      file.savings = -1;
      file.diff = -1;
      file.message = "";
      file.hash = "";
    }
    set({
      files,
    });
  },
  optim: (qualities: Record<string, number>) => {
    const { files } = get();
    const index = files.findIndex((item) => item.status === Status.Pending);
    if (index === -1) {
      set({
        processing: false,
      });
      return;
    }
    const file = files[index];
    file.status = Status.Processing;
    set({
      processing: true,
      files,
    });
    imageOptimize(file.path, qualities)
      .then((data) => {
        file.size = data.size;
        file.savings = 1 - data.size / data.original_size;
        if (file.savings > 0) {
          file.status = Status.Success;
        } else {
          file.status = Status.NotModified;
        }
        file.diff = data.diff;
        file.hash = data.hash;
      })
      .catch((err) => {
        const data = formatError(err);
        file.status = Status.Fail;
        file.message = `${data.message}[${data.category}]`;
      })
      .finally(() => {
        // the files may push new file
        const { files } = get();
        files[index] = file;
        set({
          files,
        });
        get().optim(qualities);
      });
  },
  stats: () => {
    const { files } = get();
    let totalSize = 0;
    let savingsSize = 0;
    let top = 0;
    let average = 0;
    let count = 0;
    files.forEach((file) => {
      if (file.status !== Status.Success || file.savings <= 0) {
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
