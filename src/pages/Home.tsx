import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Plus, RotateCw, Check, LoaderCircle, Info } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import {
  listenDragDrop,
  formatDiff,
  formatFile,
  formatSize,
  formatSavings,
  formatError,
  isWebMode,
} from "@/helpers/utils";
import { imageOptimize } from "@/commands";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

enum Status {
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

const formatStatus = (status: Status, message?: string) => {
  const iconClass = "h-4 w-4 mt-3";
  switch (status) {
    case Status.Processing: {
      return <LoaderCircle className={cn("animate-spin", iconClass)} />;
    }
    case Status.Fail: {
      return (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className={cn("cursor-pointer text-rose-500", iconClass)} />
            </TooltipTrigger>
            <TooltipContent>
              <p>{message}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    case Status.Success: {
      return <Check className={cn("text-green-500", iconClass)} />;
    }
    case Status.NotModified: {
      return <Check className={cn("", iconClass)} />;
    }
    default: {
      return <span>...</span>;
    }
  }
};

export default function Home() {
  const statusClass = "text-right w-[40px] pr-3";
  const fileClass = "text-left pl-3";
  const sizeClass = "text-right w-[90px] pr-3";
  const savingsClass = "text-right w-[80px] pr-3";
  const diffClass = "text-right w-[60px] pr-3";
  const [files, setFiles] = useState([] as File[]);
  const [processing, setProcessing] = useState(false);
  if (isWebMode()) {
    setTimeout(() => {
      setFiles([
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
      ]);
    });
  }

  const doOptimize = (optimizeFiles: File[]) => {
    const index = optimizeFiles.findIndex((item) => item.status === 0);
    if (index === -1) {
      setProcessing(false);
      return;
    }
    const file = optimizeFiles[index];
    file.status = Status.Processing;
    setFiles(optimizeFiles);
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
        setFiles(optimizeFiles);
        doOptimize(optimizeFiles);
      });
  };

  useEffect(() => {
    const unlisten = listenDragDrop((files: string[]) => {
      if (processing) {
        return;
      }
      const arr: File[] = files.map((path) => {
        return {
          status: Status.Pending,
          path,
          size: -1,
          savings: -1,
          diff: -1,
        };
      });
      setFiles(arr);
      setProcessing(true);
      doOptimize(arr);
    });
    return unlisten;
  }, []);

  const tab = (
    <div className="flex h-8 leading-8">
      <div className={cn("flex-none", statusClass)}>--</div>
      <Separator orientation="vertical" className="my-2 h-4" />
      <div className={cn("grow", fileClass)}>File</div>
      <Separator orientation="vertical" className="my-2 h-4" />
      <div className={cn("flex-none", sizeClass)}>Size</div>
      <Separator orientation="vertical" className="my-2 h-4" />
      <div className={cn("flex-none", savingsClass)}>Savings</div>
      <Separator orientation="vertical" className="my-2 h-4" />
      <div className={cn("flex-none", diffClass)}>Diff</div>
    </div>
  );
  const items = files.map((item, index) => {
    let itemClass = "";
    if (index % 2 === 1) {
      itemClass = "bg-muted/50";
    }

    return (
      <div className={cn("flex h-10 leading-10", itemClass)} key={item.path}>
        <div className={cn("flex-none", statusClass)}>
          <div className="float-end">
            {formatStatus(item.status, item.message)}
          </div>
        </div>
        <div className={cn("grow relative", fileClass)}>
          {formatFile(item.path)}
        </div>
        <div className={cn("flex-none", sizeClass)}>
          {formatSize(item.size)}
        </div>
        <div className={cn("flex-none", savingsClass)}>
          {formatSavings(item.savings)}
        </div>
        <div className={cn("flex-none", diffClass)}>
          {formatDiff(item.diff)}
        </div>
      </div>
    );
  });
  return (
    <div>
      <div className="mb-[51px] text-xs">
        {tab}
        <Separator />
        <div className="fixed bottom-[52px] top-[32px] left-0 right-0 leading-loose overflow-hidden">
          <ScrollArea className="h-full">{items}</ScrollArea>
        </div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 leading-loose">
        <Separator />
        <div className="flex py-2">
          <div className="flex-none h-8 mx-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={processing}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="grow h-8 text-muted-foreground text-xs leading-8">
            Drag and drop image files onto the area above
          </div>
          <div className="flex-none h-8 mx-2">
            <Button variant="outline" size="sm" disabled={processing}>
              <RotateCw className="mr-2 h-4 w-4" /> Again
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
