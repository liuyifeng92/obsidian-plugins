import { DashboardLayout, LayoutRenderer } from "../types";
import { ListRenderer } from "./list-renderer";
import { CardRenderer } from "./card-renderer";
import { TableRenderer } from "./table-renderer";
import { CalendarRenderer } from "./calendar-renderer";
import { DashboardRenderer } from "./dashboard-renderer";

export { ListRenderer } from "./list-renderer";
export { CardRenderer } from "./card-renderer";
export { TableRenderer } from "./table-renderer";
export { CalendarRenderer } from "./calendar-renderer";
export { DashboardRenderer } from "./dashboard-renderer";

export const RENDERERS: Record<DashboardLayout, LayoutRenderer> = {
	list: new ListRenderer(),
	card: new CardRenderer(),
	table: new TableRenderer(),
	calendar: new CalendarRenderer(),
	dashboard: new DashboardRenderer(),
};
