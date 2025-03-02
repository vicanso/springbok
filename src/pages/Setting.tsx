import { Button } from "@/components/ui/button";
import { goToHome } from "@/routers";
import {
  ChevronLeft,
  Check,
  Sun,
  Moon,
  SunMoon,
  Cog,
  Languages,
  RotateCw,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useTheme } from "@/components/theme-provider";
import i18n, { useI18n } from "@/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import useSettingSate, { ImageFormat } from "@/states/setting";
import { JSX } from "react";


export default function Setting() {
  const { setTheme, theme } = useTheme();
  const lang = i18n.language;
  const zhLang = "zh";
  const enLang = "en";
  const t = useI18n();
  const settingI18n = useI18n("setting");
  const {
    isSupportedFormat,
    isSupportedConvert,
    toggleSupportedFormat,
    toggleSupportedConvert,
    updateQuality,
    updateOptimizeDisabled,
    setting,
    reset,
  } = useSettingSate();

  const iconClassName = "mr-2 h-4 w-4";

  const dropdowns = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Cog />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => {
              setTheme("system");
            }}
          >
            {theme == "system" && <Check className={iconClassName} />}
            {theme != "system" && <SunMoon className={iconClassName} />}
            <span>{t("themeSystem")}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => {
              setTheme("dark");
            }}
          >
            {theme == "dark" && <Check className={iconClassName} />}
            {theme != "dark" && <Moon className={iconClassName} />}
            <span>{t("themeDark")}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => {
              setTheme("light");
            }}
          >
            {theme == "light" && <Check className={iconClassName} />}
            {theme != "light" && <Sun className={iconClassName} />}
            <span>{t("themeLight")}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => {
              i18n.changeLanguage(zhLang);
            }}
          >
            {lang == zhLang && <Check className={iconClassName} />}
            {lang != zhLang && <Languages className={iconClassName} />}
            中文
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => {
              i18n.changeLanguage(enLang);
            }}
          >
            {lang == enLang && <Check className={iconClassName} />}
            {lang != enLang && <Languages className={iconClassName} />}
            English
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => {
              reset();
            }}
          >
            <RotateCw className={iconClassName} />
            {settingI18n("reset")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const optimImageFormats: JSX.Element[] = [];
  [ImageFormat.Png, ImageFormat.Jpeg].forEach((item) => {
    const id = `support-${item}`;
    optimImageFormats.push(
      <Checkbox
        key={`${id}-checkbox`}
        id={id}
        defaultChecked={isSupportedFormat(item)}
        onCheckedChange={() => {
          toggleSupportedFormat(item);
        }}
      />,
      <div className="grid gap-1.5 leading-none" key={`${id}-label`}>
        <label
          htmlFor={id}
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          {item.toUpperCase()}
        </label>
      </div>,
      <span key={`${id}-padding`} className="px-2"></span>,
    );
  });

  const convertImageFormats: JSX.Element[] = [];
  [
    [ImageFormat.Png, ImageFormat.Webp],
    [ImageFormat.Png, ImageFormat.Avif],
    [ImageFormat.Jpeg, ImageFormat.Webp],
    [ImageFormat.Jpeg, ImageFormat.Avif],
  ].forEach((items) => {
    const id = `convert-${items[0]}-${items[1]}`;

    convertImageFormats.push(
      <Checkbox
        key={`${id}-checkbox`}
        id={id}
        defaultChecked={isSupportedConvert(items[0], items[1])}
        onCheckedChange={() => {
          toggleSupportedConvert(items[0], items[1]);
        }}
      />,
      <div className="grid gap-1.5 leading-none" key={`${id}-label`}>
        <label
          htmlFor={id}
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          {items[0].toUpperCase() + " -> " + items[1].toUpperCase()}
        </label>
      </div>,
      <span key={`${id}-padding`} className="pl-1"></span>,
    );
  });

  const imageQualities = [
    ImageFormat.Png,
    ImageFormat.Jpeg,
    ImageFormat.Avif,
  ].map((item) => {
    const id = `quality-${item}`;
    let defaultQuality = 0;
    switch (item) {
      case ImageFormat.Png: {
        defaultQuality = setting.pngQuality;
        break;
      }
      case ImageFormat.Jpeg: {
        defaultQuality = setting.jpegQuality;
        break;
      }
      case ImageFormat.Avif: {
        defaultQuality = setting.avifQuality;
        break;
      }
    }
    return (
      <div key={id} className="space-y-2">
        <Label htmlFor={id}>{item.toUpperCase()}</Label>
        <Input
          type="number"
          id={id}
          disabled={setting.optimizeDisabled}
          defaultValue={defaultQuality}
          onChange={(e) => {
            updateQuality(item, e.target.valueAsNumber);
          }}
          placeholder={settingI18n(`${item}QualityPlaceholder`)}
        />
      </div>
    );
  });

  return (
    <div>
      <div className="ml-2 flex h-10 items-center">
        <Button
          variant="outline"
          className="h-8 w-8 ml-1"
          size="icon"
          onClick={() => {
            goToHome();
          }}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex flex-1 items-center justify-end space-x-2 mr-5">
          {dropdowns}
        </div>
      </div>
      <Separator />

      {/* support image formats */}
      <Card className="m-4">
        <CardHeader>
          <CardTitle>{settingI18n("supportImages")}</CardTitle>
          <CardDescription>{settingI18n("supportImageTips")}</CardDescription>
        </CardHeader>
        <CardContent className="items-top flex space-x-2">
          {optimImageFormats}
        </CardContent>
      </Card>

      {/* image convert */}
      <Card className="m-4">
        <CardHeader>
          <CardTitle>{settingI18n("supportConverts")}</CardTitle>
          <CardDescription>{settingI18n("supportConvertTips")}</CardDescription>
        </CardHeader>
        <CardContent className="items-top flex space-x-2">
          {convertImageFormats}
        </CardContent>
      </Card>

      {/* image quality */}
      <Card className="m-4">
        <CardHeader>
          <CardTitle>
            <div className="flex items-center space-x-2 float-right">
              <Checkbox id="quality-disabled" defaultChecked={setting.optimizeDisabled} onCheckedChange={(value) => {
                updateOptimizeDisabled(value.valueOf() as boolean);
              }} />
              <label
                htmlFor="quality-disabled"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {settingI18n("disabled")}
              </label>
            </div>
            {settingI18n("imageQuality")}
          </CardTitle>
          <CardDescription>{settingI18n("imageQualityTips")}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          {imageQualities}
        </CardContent>
      </Card>
    </div>
  );
}
