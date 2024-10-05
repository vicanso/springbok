import { imageOptimize, restoreFile } from "@/commands";
import { formatError } from "@/helpers/utils";
import { create } from "zustand";

export enum Status {
  Pending = 0,
  Processing,
  NotModified,
  Success,
  Fail,
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
  mock: () => void;
  optim: () => void;
  start: () => void;
  reset: () => void;
  restore: (hash: string, file: string) => Promise<void>;
  add: (...files: string[]) => void;
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
  add: (...files: string[]) => {
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
        arr.push({
          status: Status.Pending,
          path,
          size: -1,
          savings: -1,
          diff: -1,
        });
      });
      state.files.push(...arr);
      return {
        files: state.files,
      };
    });
  },
  start: () => {
    const { processing, optim } = get();
    if (!processing) {
      optim();
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
  optim: () => {
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
    imageOptimize(file.path)
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
        get().optim();
      });
  },
}));

export default filetreeState;
