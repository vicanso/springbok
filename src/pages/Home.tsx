import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Plus, RotateCw, Check, LoaderCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { listenDragDrop } from "@/helpers/utils";

interface File {
  status: number;
  path: string;
  size: number;
  savings: number;
}

const formatSize = (size: number) => {
  if (size < 0) {
    return "";
  }
  const mb = 1000 * 1000;
  if (size > mb) {
    return `${(size / mb).toFixed(2)} MB`;
  }
  return size.toLocaleString();
};

const formatSavings = (savings: number) => {
  if (savings < 0) {
    return "";
  }
  return (savings * 100).toFixed(2) + "%";
};

const formatFile = (path: string) => {
  const arr = path.split("/");
  return arr[arr.length - 1];
};

export default function Home() {
  const statusClass = "text-right w-[40px] pr-3";
  const fileClass = "text-left pl-3";
  const sizeClass = "text-right w-[90px] pr-3";
  const savingsClass = "text-right w-[80px] pr-3";
  const [files, setFiles] = useState([] as File[]);
  useEffect(() => {
    const unlisten = listenDragDrop((files: string[]) => {
      const arr: File[] = files.map((path) => {
        return {
          status: 0,
          path,
          size: -1,
          savings: -1,
        };
      });
      setFiles(arr);
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
    </div>
  );
  const items = files.map((item, index) => {
    let status: JSX.Element = <></>;
    const iconClass = "h-4 w-4 mt-3";
    switch (item.status) {
      case 0: {
        status = <LoaderCircle className={cn("animate-spin", iconClass)} />;
        break;
      }
      case 1: {
        status = <Check className={cn("", iconClass)} />;
        break;
      }
    }

    let itemClass = "";
    if (index % 2 === 1) {
      itemClass = "bg-muted/50";
    }

    return (
      <div className={cn("flex h-10 leading-10", itemClass)} key={item.path}>
        <div className={cn("flex-none", statusClass)}>
          <div className="float-end">{status}</div>
        </div>
        <div className={cn("grow", fileClass)}>{formatFile(item.path)}</div>
        <div className={cn("flex-none", sizeClass)}>
          {formatSize(item.size)}
        </div>
        <div className={cn("flex-none", savingsClass)}>
          {formatSavings(item.savings)}
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
            <Button variant="outline" size="icon" className="h-8 w-8">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="grow h-8 text-muted-foreground text-xs leading-8">
            Drag and drop image files onto the area above
          </div>
          <div className="flex-none h-8 mx-2">
            <Button variant="outline" size="sm">
              <RotateCw className="mr-2 h-4 w-4" /> Again
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
