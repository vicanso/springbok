import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Plus, RotateCw, Check, LoaderCircle, Info, Undo2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  listenDragDrop,
  formatDiff,
  formatFile,
  formatSize,
  formatSavings,
  isWebMode,
} from "@/helpers/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import useFiletreeState, { Status } from "@/states/filetree";
import { useEffect } from "react";

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
  const { files, processing, mock, add, start, restore } = useFiletreeState();
  useEffect(() => {
    const unlisten = listenDragDrop((files: string[]) => {
      add(...files);
      start();
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
    let undo = <></>;
    if (item.hash) {
      undo = (
        <Button
          key="restoreImage"
          size="icon"
          variant="ghost"
          className="h-10 w-10"
          title="Restore the original image"
          onClick={async () => {
            try {
              await restore(item.hash || "", item.path);
            } catch (err) {
              console.error(err);
            }
          }}
        >
          <Undo2 className="h-4 w-4" />
        </Button>
      );
    }

    return (
      <div className={cn("flex h-10 leading-10", itemClass)} key={item.path}>
        <div className={cn("flex-none", statusClass)}>
          <div className="float-end">
            {formatStatus(item.status, item.message)}
          </div>
        </div>
        <div className={cn("grow relative", fileClass)}>
          <div className="absolute right-0">{undo}</div>
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
            <Button
              variant="outline"
              size="sm"
              disabled={processing}
              onClick={() => {
                if (isWebMode()) {
                  mock();
                  return;
                }
              }}
            >
              <RotateCw className="mr-2 h-4 w-4" /> Again
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
