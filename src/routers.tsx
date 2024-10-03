import { createHashRouter } from "react-router-dom";
import Home from "@/pages/Home";

export const HOME = "/";

const router = createHashRouter([
  {
    path: HOME,
    element: <Home />,
  },
]);

export default router;
