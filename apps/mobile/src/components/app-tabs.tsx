import FloatingTabBar from "@/components/floating-tab-bar";
import { AppTabRoutes } from "@/constants/tabs";

export default function AppTabs() {
  return <FloatingTabBar tabs={AppTabRoutes} />;
}
