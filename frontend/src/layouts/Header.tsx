import { ModeToggle } from "@/components/ModeToggle";
import NotificationDropdown from "@/components/shared/NotificationDropdown";
import ProfileDropdown from "@/components/shared/ProfileDropdown";
import SearchBox from "@/components/shared/SearchBox";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const Header = () => {
    return (
        <div className="bg-background/80 backdrop-blur-md border-b border-black/5 dark:border-white/5 shadow-[0_1px_12px_rgba(0,0,0,0.04)] dark:shadow-[0_1px_12px_rgba(0,0,0,0.2)] flex items-center justify-between sm:h-18 h-13 shrink-0 gap-2 md:px-6 px-4 py-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-18 sticky top-0 z-[2]">
            <div className="col-auto">
                <div className="flex flex-wrap items-center gap-[16px]">

                    {/* <SidebarToggle /> */}
                    <SidebarTrigger className={cn(`!p-0 h-auto w-auto !bg-transparent cursor-pointer text-neutral-700 hover:text-neutral-900 dark:text-neutral-200`)} />

                    <SearchBox /> 
                </div>
            </div>

            <div className="col-auto">
                <div className="flex flex-wrap items-center gap-3">

                    {/* Light & Dark Mode */}
                    <ModeToggle />

                    {/* Notification Start   */}
                    <NotificationDropdown />
                    {/* Notification End   */}

                    {/* Profile dropdown start */}
                    <ProfileDropdown />
                    {/* Profile dropdown end */}

                </div>
            </div>
        </div>
    );
};

export default Header;