import { Outlet } from "react-router-dom";
import Footer from "./Footer";
import Header from "./Header";
import SidebarLayout from "./SidebarLayout";

export default function MainLayout() {
  return (
    <SidebarLayout>
      <div className="flex flex-col min-h-screen bg-background text-foreground transition-colors">
        <Header />
        <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
        <Footer />
      </div>
    </SidebarLayout>
  );
}
