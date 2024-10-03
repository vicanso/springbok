// import React from "react";
// import ReactDOM from "react-dom/client";
// import "@/index.css";
// import App from "./App";
// import { listen, TauriEvent } from "@tauri-apps/api/event";
// const unlisten = await listen<string>(TauriEvent.DRAG_DROP, (event) => {
//   console.log(`Got error, payload: ${event.payload}`);
//   console.dir(event.payload.paths);
// });
// ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
//   <React.StrictMode>
//     <App />
//   </React.StrictMode>,
// );

import { StrictMode } from "react";

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initListenDragDrop } from "./helpers/utils";

initListenDragDrop()
  .then(() => {
    createRoot(document.getElementById("root")!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  })
  .catch((err) => {
    // todo tauri error
    console.error(err);
  });
