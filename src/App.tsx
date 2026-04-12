import React from "react";
import { Toaster } from "@/components/ui/sonner"
import { RouterProvider } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import router from "@/routers";
import { clearExpiredBackupFiles } from "@/commands";

export default function () {
  clearExpiredBackupFiles()
    .then(() => {
      console.info("clear expired backup files success");
    })
    .catch(console.error);
  return (
    <React.StrictMode>
      <ThemeProvider storageKey="vite-ui-theme">
        <Toaster />
        <RouterProvider router={router} />
      </ThemeProvider>
    </React.StrictMode>
  );
}
