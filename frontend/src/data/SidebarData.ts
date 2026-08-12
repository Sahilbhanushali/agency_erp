import {
  House,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

export const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: House,
    },
    {
      label: "Application",
    },
    {
      title: "Users",
      url: "/users-list",
      icon: UsersRound,
    },
    {
      title: "Roles & Permissions",
      url: "/roles-list",
      icon: ShieldCheck,
    },
  ],
};
