import { Sidebar } from "@/components/layout/sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/40 md:flex">
      <Sidebar />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
