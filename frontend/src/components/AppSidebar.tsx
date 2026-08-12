import LogoWhite from "@/assets/images/logo-light.png"
import {
    Sidebar,
    SidebarContent,
    SidebarHeader
} from "@/components/ui/sidebar"
import { useAuth } from "@/context/AuthContext"
import { getSidebarNav } from "@/data/SidebarData"
import { cn } from "@/lib/utils"
import { Link } from "react-router-dom"
import { NavMain } from "./NavMain"


export function AppSidebar() {
    const { user } = useAuth();

    return (
        <Sidebar>
            <SidebarHeader className="p-0">
                {/* Sidebar background is a fixed dark tint regardless of app theme, so the logo stays fixed to its light variant too. */}
                <Link to="/dashboard" className="sidebar-logo h-[72px] py-3.5 flex items-center justify-center border-b border-white/8 px-4">
                    <img src={LogoWhite} alt="Logo" width={168} height={40} />
                </Link>
            </SidebarHeader>

            <SidebarContent className={cn(`scrollbar-thin`)}>
                <NavMain items={getSidebarNav(user)} />
            </SidebarContent>
        </Sidebar>
    )
}