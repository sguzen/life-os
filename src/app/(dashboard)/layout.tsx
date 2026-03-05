import { Sidebar } from "@/components/layout/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      {/* Main content — offset on mobile to account for fixed top bar */}
      <main className="flex-1 overflow-y-auto p-4 pt-18 sm:p-6 lg:pt-6">
        {children}
      </main>
    </div>
  );
}
