"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Dumbbell,
  Salad,
  Briefcase,
  Puzzle,
  Sunrise,
  BookOpen,
  FolderKanban,
  LogOut,
  Menu,
  X,
  Activity,
  Bot,
  RefreshCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { NotificationSetup } from "@/components/notifications/notification-setup";
import { ThemeToggle } from "@/components/theme/theme-toggle";

const navItems: Array<{ href: string; label: string; icon: React.ElementType; indent?: boolean }> = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/morning", label: "Morning", icon: Sunrise },
  { href: "/training", label: "Training", icon: Dumbbell },
  { href: "/nutrition", label: "Nutrition", icon: Salad },
  { href: "/work", label: "Work", icon: Briefcase },
  { href: "/hobby", label: "Hobby", icon: Puzzle },
  { href: "/habits", label: "Habits", icon: Activity },
  { href: "/adapt", label: "Adapt", icon: RefreshCcw },
  { href: "/coach", label: "Coach", icon: Bot },
  { href: "/books", label: "Books", icon: BookOpen },
  { href: "/projects", label: "Projects", icon: FolderKanban },
];

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <>
      {navItems.map(({ href, label, icon: Icon, indent }) => (
        <Link
          key={href}
          href={href}
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            indent && "ml-4 text-xs",
            pathname === href ||
            (indent && pathname.startsWith(href))
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          )}
        >
          <Icon className={cn("shrink-0", indent ? "h-3.5 w-3.5" : "h-4 w-4")} />
          {label}
        </Link>
      ))}
    </>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex h-full w-60 flex-col border-r bg-card px-3 py-4 shrink-0">
        <div className="mb-6 px-3">
          <h2 className="text-xl font-bold">Life OS</h2>
        </div>
        <nav className="flex-1 space-y-1">
          <NavLinks pathname={pathname} />
        </nav>
        <div className="space-y-1">
          <div className="px-2">
            <ThemeToggle />
            <NotificationSetup />
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between border-b bg-card px-4 h-14">
        <h2 className="text-lg font-bold">Life OS</h2>
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "lg:hidden fixed top-0 left-0 z-50 h-full w-72 flex-col border-r bg-card px-3 py-4 transition-transform duration-300",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ display: "flex" }}
      >
        <div className="mb-6 flex items-center justify-between px-3">
          <h2 className="text-xl font-bold">Life OS</h2>
          <button
            onClick={() => setMobileOpen(false)}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-1">
          <NavLinks pathname={pathname} onNavigate={() => setMobileOpen(false)} />
        </nav>
        <div className="space-y-1">
          <div className="px-2">
            <ThemeToggle />
            <NotificationSetup />
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
