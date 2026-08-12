import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { api, ApiError } from "@/lib/api";
import Breadcrumb from "@/layouts/Breadcrumb";
import { Briefcase, Building2, Loader2, Users as UsersIcon, LayoutGrid } from "lucide-react";
import { useEffect, useState } from "react";

interface StatCard {
  label: string;
  icon: typeof Building2;
  endpoint: string;
}

const STAT_CARDS: StatCard[] = [
  { label: "Companies", icon: Building2, endpoint: "/companies" },
  { label: "Users", icon: UsersIcon, endpoint: "/users" },
  { label: "Clients", icon: Briefcase, endpoint: "/clients" },
  { label: "Projects", icon: LayoutGrid, endpoint: "/projects" },
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

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {visibleCards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
                {card.label}
              </CardTitle>
              <card.icon className="w-5 h-5 text-primary" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
              ) : (
                <p className="text-3xl font-semibold text-neutral-900 dark:text-white">
                  {counts[card.label] ?? "—"}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
};

export default Dashboard;
