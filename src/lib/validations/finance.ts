import { z } from "zod";

// ---- Constants ----

export const EXPENSE_CATEGORIES = [
  "housing",
  "transportation",
  "food",
  "utilities",
  "insurance",
  "subscriptions",
  "health",
  "entertainment",
  "other",
] as const;

export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  housing: "Housing",
  transportation: "Transportation",
  food: "Food & Dining",
  utilities: "Utilities",
  insurance: "Insurance",
  subscriptions: "Subscriptions",
  health: "Health",
  entertainment: "Entertainment",
  other: "Other",
};

export const PROP_FIRM_OPTIONS = [
  "FundedNext",
  "Apex",
  "Take Profit Trader",
  "DayTraders",
] as const;

// ---- Debt ----

export const debtSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  total_amount: z
    .number({ invalid_type_error: "Required" })
    .positive("Must be positive"),
  current_balance: z
    .number({ invalid_type_error: "Required" })
    .min(0, "Cannot be negative"),
  interest_rate: z.number().min(0).max(100).default(0),
  minimum_payment: z.number().min(0).default(0),
  due_day: z.number().int().min(1).max(31).nullable().optional(),
  notes: z.string().nullable().optional(),
  is_paid_off: z.boolean().default(false),
});

export type DebtFormValues = z.infer<typeof debtSchema>;

// ---- Monthly Expense ----

export const monthlyExpenseSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  amount: z
    .number({ invalid_type_error: "Required" })
    .positive("Must be positive"),
  category: z.enum(EXPENSE_CATEGORIES).default("other"),
  due_day: z.number().int().min(1).max(31).nullable().optional(),
  is_recurring: z.boolean().default(true),
  notes: z.string().nullable().optional(),
});

export type MonthlyExpenseFormValues = z.infer<typeof monthlyExpenseSchema>;

// ---- Prop Payout ----

export const propPayoutSchema = z.object({
  firm_name: z.string().min(1, "Firm is required"),
  amount: z
    .number({ invalid_type_error: "Required" })
    .positive("Must be positive"),
  payout_date: z.string().min(1, "Date is required"),
  notes: z.string().nullable().optional(),
});

export type PropPayoutFormValues = z.infer<typeof propPayoutSchema>;
