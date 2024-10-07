import { createHashRouter } from "react-router-dom";
import Home from "@/pages/Home";
import Setting from "@/pages/Setting";

export const HOME = "/";
export const SETTING = "/setting";

const router = createHashRouter([
  {
    path: HOME,
    element: <Home />,
  },
  {
    path: SETTING,
    element: <Setting />,
  },
]);

export function goToSetting() {
  router.navigate(SETTING);
}

export function goToHome() {
  router.navigate(HOME);
}

export default router;
