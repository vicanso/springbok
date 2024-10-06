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
import useSettingSate from "@/states/setting";

export default function Setting() {
  const { setTheme, theme } = useTheme();
  const lang = i18n.language;
  const zhLang = "zh";
  const enLang = "en";
  const t = useI18n();
  const settingI18n = useI18n("setting");
  const { isSupportedFormat, toggleSupportedFormat, updateQuality, setting } =
    useSettingSate();

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
            className="cursor-pointe"
            onClick={() => {
              i18n.changeLanguage(enLang);
            }}
          >
            {lang == enLang && <Check className={iconClassName} />}
            {lang != enLang && <Languages className={iconClassName} />}
            English
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const pngFormat = "png";
  const jpegFormat = "jpeg";
  const avifFormat = "avif";

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
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end mr-5">
          {dropdowns}
        </div>
      </div>
      <Separator />
      <Card className="m-4">
        <CardHeader>
          <CardTitle>{settingI18n("supportImages")}</CardTitle>
          <CardDescription>{settingI18n("supportImageTips")}</CardDescription>
        </CardHeader>
        <CardContent className="items-top flex space-x-2">
          <Checkbox
            id="supportPng"
            defaultChecked={isSupportedFormat(pngFormat)}
            onCheckedChange={() => {
              toggleSupportedFormat(pngFormat);
            }}
          />
          <div className="grid gap-1.5 leading-none">
            <label
              htmlFor="supportPng"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              PNG
            </label>
          </div>
          <Checkbox
            id="supportJpeg"
            defaultChecked={isSupportedFormat(jpegFormat)}
            onCheckedChange={() => {
              toggleSupportedFormat(jpegFormat);
            }}
          />
          <div className="grid gap-1.5 leading-none">
            <label
              htmlFor="supportJpeg"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              JPEG
            </label>
          </div>
        </CardContent>
      </Card>

      <Card className="m-4">
        <CardHeader>
          <CardTitle>{settingI18n("imageQuality")}</CardTitle>
          <CardDescription>{settingI18n("imageQualityTips")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pngQuality">PNG</Label>
            <Input
              type="number"
              id="pngQuality"
              defaultValue={setting.pngQuality}
              onChange={(e) => {
                updateQuality(pngFormat, e.target.valueAsNumber);
              }}
              // onChange={}
              placeholder={settingI18n("pngQualityPlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="jpegQuality">JPEG</Label>
            <Input
              type="number"
              id="jpegQuality"
              defaultValue={setting.jpegQuality}
              onChange={(e) => {
                updateQuality(jpegFormat, e.target.valueAsNumber);
              }}
              placeholder={settingI18n("jpegQualityPlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="avifQuality">AVIF</Label>
            <Input
              type="number"
              id="avifQuality"
              defaultValue={setting.avifQuality}
              onChange={(e) => {
                updateQuality(avifFormat, e.target.valueAsNumber);
              }}
              placeholder={settingI18n("avifQualityPlaceholder")}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
