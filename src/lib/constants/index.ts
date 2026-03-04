export const APP_NAME = "Life OS";
export const APP_DESCRIPTION = "Your personal productivity operating system";

export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  DASHBOARD: "/dashboard",
  TASKS: "/tasks",
  HABITS: "/habits",
  NOTES: "/notes",
  CALENDAR: "/calendar",
  GOALS: "/goals",
} as const;

export const PRIORITIES = ["low", "medium", "high"] as const;
export const STATUSES = ["todo", "in_progress", "done"] as const;
