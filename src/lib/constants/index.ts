export const APP_NAME = "Life OS";
export const APP_DESCRIPTION = "Your personal productivity operating system";

export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  REGISTER: "/register",
  DASHBOARD: "/dashboard",
  MORNING: "/morning",
  TRAINING: "/training",
  NUTRITION: "/nutrition",
  WORK: "/work",
  HOBBY: "/hobby",
  HABITS: "/habits",
  BOOKS: "/books",
  PROJECTS: "/projects",
} as const;

export const PRIORITIES = ["low", "medium", "high"] as const;
export const STATUSES = ["todo", "in_progress", "done"] as const;
