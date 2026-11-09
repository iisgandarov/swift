import { HomeScreen } from "@/components/home/home-screen";
import { DesktopCalendarPanel } from "@/components/home/desktop-calendar-panel";

export default function HomePage() {
  // desktop: the calendar sits in a right-side panel next to the list
  return <HomeScreen aside={<DesktopCalendarPanel />} />;
}
