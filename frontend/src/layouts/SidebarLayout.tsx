import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <div className="grow min-w-0 flex flex-col min-h-screen">
        {children}
      </div>
    </SidebarProvider>
  );
}