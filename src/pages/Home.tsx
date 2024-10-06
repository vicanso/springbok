import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Plus,
  RotateCw,
  Check,
  LoaderCircle,
  Info,
  Undo2,
  X,
  ShieldAlert,
  Ellipsis,
  Download,
} from "lucide-react";
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
import useSettingSate from "@/states/setting";
import { useEffect } from "react";
import { useI18n } from "@/i18n";
import { goToSetting } from "@/routers";

const formatStatus = (
  i18n: (key: string) => string,
  status: Status,
  message?: string,
) => {
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
    case Status.NotSupported: {
      return (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <ShieldAlert className={cn("cursor-pointer", iconClass)} />
            </TooltipTrigger>
            <TooltipContent>
              <p>{i18n("notSupported")}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
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
  const homeI18n = useI18n("home");
  const { getQualities } = useSettingSate();
  const { files, processing, mock, add, start, restore, reset, clean } =
    useFiletreeState();

  const handleSelectFiles = async (files: string[]) => {
    try {
      await add(...files);
      start(getQualities());
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const unlisten = listenDragDrop(handleSelectFiles);
    return unlisten;
  }, []);

  const tab = (
    <div className="flex h-8 leading-8">
      <div className={cn("flex-none", statusClass)}>--</div>
      <Separator orientation="vertical" className="my-2 h-4" />
      <div className={cn("grow", fileClass)}>{homeI18n("file")}</div>
      <Separator orientation="vertical" className="my-2 h-4" />
      <div className={cn("flex-none", sizeClass)}>{homeI18n("size")}</div>
      <Separator orientation="vertical" className="my-2 h-4" />
      <div className={cn("flex-none", savingsClass)}>{homeI18n("savings")}</div>
      <Separator orientation="vertical" className="my-2 h-4" />
      <div className={cn("flex-none", diffClass)}>{homeI18n("diff")}</div>
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
            {formatStatus(homeI18n, item.status, item.message)}
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
          {items.length !== 0 && (
            <ScrollArea className="h-full">{items}</ScrollArea>
          )}
          {items.length === 0 && (
            <div className="absolute top-[50%] mt-[-40px] left-[50%] ml-[-40px]">
              <div className="border-2 p-[20px] rounded-md">
                <Download className="text-muted-foreground w-[60px] h-[60px]" />
              </div>
            </div>
          )}
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
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 ml-1"
              title={homeI18n("clean")}
              disabled={processing}
              onClick={() => {
                clean();
              }}
            >
              <X className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 ml-1"
              size="icon"
              disabled={processing}
              onClick={() => {
                goToSetting();
              }}
            >
              <Ellipsis className="h-4 w-4" />
            </Button>
          </div>
          <div className="grow h-8 text-muted-foreground text-xs leading-8">
            {homeI18n("dragDropTips")}
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
                reset();
                start(getQualities());
              }}
            >
              <RotateCw className="mr-2 h-4 w-4" /> {homeI18n("again")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
