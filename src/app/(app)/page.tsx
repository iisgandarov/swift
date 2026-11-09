import { HomeScreen } from "@/components/home/home-screen";
import { CalendarScreen } from "@/components/calendar/calendar-screen";

export default function HomePage() {
  // desktop: the calendar sits in a right-side panel next to the list
  return <HomeScreen aside={<div className="card sticky top-8 p-5"><CalendarScreen compact /></div>} />;
}
