import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

interface SidebarItem {
  title?: string;
  url?: string;
  icon?: LucideIcon;
  items?: {
    title: string;
    url?: string;
    circleColor: string;
  }[];
  label?: string;
}

export function NavMain({ items }: { items: SidebarItem[] }) {
  const location = useLocation();
  const pathname = location.pathname;

  // State: which dropdown is open
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  // Toggle a dropdown
  const handleToggleGroup = (title?: string) => {
    if (!title) return;
    setOpenGroup((prev) => (prev === title ? null : title));
  };

  // Check if dropdown contains active page
  const isDropdownActive = (item: SidebarItem) => {
    if (!item.items) return false;
    return item.items.some(
      (sub) => sub.url && (pathname === sub.url || pathname.startsWith(sub.url))
    );
  };

  return (
    <SidebarGroup className="flex flex-col w-full px-4 py-3">
      <SidebarMenu>
        {items.map((item) => {
          // Dropdown with subitems
          if (item.items && item.items.length > 0 && item.title) {
            const isActiveDropdown = isDropdownActive(item);
            const isOpen = isActiveDropdown || openGroup === item.title;

            return (
              <SidebarMenuItem key={item.title}>
                <Collapsible open={isOpen}>
                  <div>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        tooltip={item.title}
                        onClick={() => handleToggleGroup(item.title)}
                        className={cn(
                          "flex items-center py-3 px-3 text-base text-sidebar-foreground/70 rounded-lg transition-colors duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                          isOpen ? "bg-primary text-white hover:bg-primary" : ""
                        )}
                      >
                        {item.icon && (
                          <item.icon className="!w-4.5 !h-4.5" />
                        )}
                        <span>{item.title}</span>
                        <ChevronRight
                          className={cn(
                            "ms-auto transition-transform duration-200",
                            isOpen ? "rotate-90" : ""
                          )}
                        />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <SidebarMenuSub className="mt-2 ms-6 space-y-1">
                        {item.items.map((subItem) => {
                          if (!subItem.url) return null;
                          const isSubActive =
                            pathname === subItem.url ||
                            pathname.startsWith(subItem.url);

                          return (
                            <SidebarMenuSubItem key={subItem.title}>
                              <SidebarMenuSubButton
                                asChild
                                className={cn(
                                  "py-3 px-3 text-base text-sidebar-foreground/70 rounded-lg transition-colors duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground active:bg-sidebar-accent",
                                  isSubActive ? "bg-sidebar-accent font-semibold text-sidebar-foreground" : ""
                                )}
                              >
                                <NavLink
                                  to={subItem.url}
                                  className="flex items-center gap-3.5"
                                  onClick={() =>
                                    item.title && setOpenGroup(item.title)
                                  }
                                >
                                  <span
                                    className={`w-2 h-2 rounded-full ${subItem.circleColor}`}
                                  />
                                  <span>{subItem.title}</span>
                                </NavLink>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          );
                        })}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              </SidebarMenuItem>
            );
          }

          // Label
          if (item.label) {
            return (
              <SidebarGroupLabel
                key={`label-${item.label}`}
                className="text-[11px] font-semibold tracking-wider uppercase text-sidebar-foreground/40 mt-3 mb-1 px-3"
              >
                {item.label}
              </SidebarGroupLabel>
            );
          }

          // Top-level single page
          if (item.url && item.title) {
            const isMenuActive =
              pathname === item.url || pathname.startsWith(item.url);

            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  tooltip={item.title}
                  className={cn(
                    "relative flex items-center py-3 px-3 rounded-lg text-base text-sidebar-foreground/70 transition-colors duration-150",
                    isMenuActive ? "text-white" : "hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  )}
                  onClick={() => setOpenGroup(null)} // Close all dropdowns
                >
                  <Link to={item.url} className="flex items-center gap-2">
                    {isMenuActive && (
                      <motion.span
                        layoutId="sidebar-active-pill"
                        className="absolute inset-0 rounded-lg bg-primary -z-10"
                        transition={{ type: "spring", stiffness: 500, damping: 36 }}
                      />
                    )}
                    {item.icon && (
                      <item.icon className="!w-4.5 !h-4.5 shrink-0" />
                    )}
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          }

          return null;
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
