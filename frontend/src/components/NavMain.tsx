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
import { ChevronRight, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

interface SidebarItem {
  title?: string;
  url?: string;
  icon?: LucideIcon;
  badge?: string | number;
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

  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const handleToggleGroup = (title?: string) => {
    if (!title) return;
    setOpenGroup((prev) => (prev === title ? null : title));
  };

  const isDropdownActive = (item: SidebarItem) => {
    if (!item.items) return false;
    return item.items.some(
      (sub) => sub.url && (pathname === sub.url || pathname.startsWith(sub.url))
    );
  };

  return (
    <SidebarGroup className="flex flex-col w-full px-2 py-1.5">
      <SidebarMenu className="gap-1">
        {items.map((item, idx) => {
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
                          "relative flex items-center h-8.5 py-1.5 px-2.5 text-xs font-medium rounded-lg transition-colors duration-150",
                          isOpen
                            ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                            : "text-sidebar-foreground/75 hover:bg-sidebar-accent/80 hover:text-sidebar-foreground"
                        )}
                      >
                        {item.icon && (
                          <item.icon className="!w-4 !h-4 shrink-0 transition-colors opacity-80" />
                        )}
                        <span className="truncate group-data-[collapsible=icon]:hidden">{item.title}</span>
                        <ChevronRight
                          className={cn(
                            "ms-auto w-3.5 h-3.5 transition-transform duration-200 text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden",
                            isOpen ? "rotate-90" : ""
                          )}
                        />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>

                    <CollapsibleContent className="group-data-[collapsible=icon]:hidden">
                      <SidebarMenuSub className="mt-1 ms-4 space-y-0.5 border-l border-sidebar-border/70 ps-2.5">
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
                                  "h-7.5 py-1 px-2 text-xs text-sidebar-foreground/70 rounded-md transition-colors duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                                  isSubActive
                                    ? "bg-primary/10 text-primary font-medium dark:bg-primary/20"
                                    : ""
                                )}
                              >
                                <NavLink
                                  to={subItem.url}
                                  className="flex items-center gap-2"
                                  onClick={() =>
                                    item.title && setOpenGroup(item.title)
                                  }
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${subItem.circleColor}`}
                                  />
                                  <span className="truncate">{subItem.title}</span>
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

          // Section Label
          if (item.label) {
            return (
              <SidebarGroupLabel
                key={`label-${item.label}-${idx}`}
                className="text-[10px] font-semibold tracking-wider uppercase text-sidebar-foreground/45 mt-3 mb-1 px-2.5 select-none group-data-[collapsible=icon]:hidden"
              >
                {item.label}
              </SidebarGroupLabel>
            );
          }

          // Top-level single item
          if (item.url && item.title) {
            const isMenuActive =
              pathname === item.url ||
              (item.url !== "/dashboard" && pathname.startsWith(item.url));

            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  tooltip={item.title}
                  className={cn(
                    "relative flex items-center h-8.5 py-1.5 px-2.5 rounded-lg text-xs font-medium transition-colors duration-150",
                    isMenuActive
                      ? "bg-primary/10 text-primary font-medium dark:bg-primary/20 dark:text-primary-foreground shadow-2xs"
                      : "text-sidebar-foreground/75 hover:bg-sidebar-accent/80 hover:text-sidebar-foreground"
                  )}
                  onClick={() => setOpenGroup(null)}
                >
                  <Link to={item.url} className="flex items-center gap-2.5">
                    {/* Active Left Indicator Bar */}
                    {isMenuActive && (
                      <span className="absolute start-0 top-1.5 bottom-1.5 w-0.75 rounded-r-full bg-primary group-data-[collapsible=icon]:hidden" />
                    )}
                    {item.icon && (
                      <item.icon
                        className={cn(
                          "!w-4 !h-4 shrink-0 transition-colors",
                          isMenuActive
                            ? "text-primary"
                            : "text-sidebar-foreground/70"
                        )}
                      />
                    )}
                    <span className="truncate group-data-[collapsible=icon]:hidden">{item.title}</span>
                    {item.badge && (
                      <span className="ms-auto text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-sidebar-accent text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden">
                        {item.badge}
                      </span>
                    )}
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
