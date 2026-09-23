import { ModeToggle } from "@/components/ModeToggle";
import NotificationDropdown from "@/components/shared/NotificationDropdown";
import ProfileDropdown from "@/components/shared/ProfileDropdown";
import SearchBox from "@/components/shared/SearchBox";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export default function Header() {
  return (
    <header className="sticky top-0 z-20 flex h-14 w-full shrink-0 items-center justify-between border-b border-border/70 bg-background/85 px-4 sm:px-6 backdrop-blur-md transition-colors">
      <div className="flex items-center gap-3">
        <SidebarTrigger
          className={cn(
            "h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
          )}
        />
        <div className="hidden h-4 w-px bg-border/60 sm:block" />
        <div className="hidden sm:block">
          <SearchBox />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="sm:hidden">
          <SearchBox />
        </div>
        <ModeToggle />
        <NotificationDropdown />
        <div className="h-4 w-px bg-border/60 mx-1" />
        <ProfileDropdown />
      </div>
    </header>
  );
}