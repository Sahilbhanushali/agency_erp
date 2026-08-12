import { Card } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { api, ApiError } from "@/lib/api";
import Breadcrumb from "@/layouts/Breadcrumb";
import { motion } from "framer-motion";
import { Briefcase, Building2, Loader2, Users as UsersIcon, LayoutGrid } from "lucide-react";
import { useEffect, useState } from "react";

interface StatCard {
  label: string;
  icon: typeof Building2;
  endpoint: string;
  accent: string;
}

const STAT_CARDS: StatCard[] = [
  { label: "Companies", icon: Building2, endpoint: "/companies", accent: "bg-[oklch(0.65_0.22_264)]" },
  { label: "Users", icon: UsersIcon, endpoint: "/users", accent: "bg-[oklch(0.7_0.17_162)]" },
  { label: "Clients", icon: Briefcase, endpoint: "/clients", accent: "bg-[oklch(0.75_0.16_75)]" },
  { label: "Projects", icon: LayoutGrid, endpoint: "/projects", accent: "bg-[oklch(0.65_0.24_16)]" },
];

const Dashboard = () => {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Record<string, number | null>>({});
  const [isLoading, setIsLoading] = useState(true);

  const visibleCards = user?.roleName === "SUPER_ADMIN" ? STAT_CARDS : STAT_CARDS.filter((card) => card.label !== "Companies");

  useEffect(() => {
    let cancelled = false;

    Promise.all(
      visibleCards.map(async (card) => {
        try {
          const data = await api.get<unknown[]>(card.endpoint);
          return [card.label, data.length] as const;
        } catch (error) {
          console.error(error instanceof ApiError ? error.message : error);
          return [card.label, null] as const;
        }
      }),
    ).then((results) => {
      if (cancelled) return;
      setCounts(Object.fromEntries(results));
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.roleName]);

  return (
    <>
      <Breadcrumb title="Dashboard" text="Overview" />

      <p className="text-neutral-500 dark:text-neutral-400 -mt-4 mb-6">
        Welcome back, <span className="font-medium text-neutral-800 dark:text-neutral-200">{user?.firstName}</span> — here's what's happening across your workspace.
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {visibleCards.map((card, index) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06, duration: 0.35, ease: "easeOut" }}
            whileHover={{ y: -4 }}
          >
            <Card className="relative overflow-hidden p-6 gap-3">
              <div className={`absolute top-0 left-0 right-0 h-1 ${card.accent}`} />

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">{card.label}</span>
                <span className={`flex items-center justify-center w-11 h-11 rounded-xl text-white ${card.accent} shadow-lg shadow-black/10 dark:shadow-black/30`}>
                  <card.icon className="w-5 h-5" />
                </span>
              </div>

              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-neutral-400 mt-1" />
              ) : (
                <p className="text-4xl font-bold text-neutral-900 dark:text-white tracking-tight">
                  {counts[card.label] ?? "—"}
                </p>
              )}
            </Card>
          </motion.div>
        ))}
      </div>
    </>
  );
};

export default Dashboard;
