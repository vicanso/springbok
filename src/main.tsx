import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "@/index.css";
import { initListenDragDrop, initWindow } from "@/helpers/utils";
import { closeSplashscreen, showSplashscreen } from "@/commands";

let showSplashTime: number;
showSplashscreen()
  .then(() => {
    showSplashTime = Date.now();
    return initListenDragDrop();
  })
  .then(initWindow)
  .then((titleBarHeight) => {
    createRoot(document.getElementById("root")!).render(
      <StrictMode>
        {titleBarHeight !== 0 && (
          <div
            className="bg-titlebar"
            style={{
              height: `${titleBarHeight}px`,
            }}
          />
        )}
        <App />
      </StrictMode>,
    );
  })
  .catch((err) => {
    // todo tauri error
    console.error(err);
  })
  .finally(() => {
    let ms = 300 - (Date.now() - showSplashTime);
    if (ms < 0) {
      ms = 0;
    }
    setTimeout(closeSplashscreen, ms);
  });
