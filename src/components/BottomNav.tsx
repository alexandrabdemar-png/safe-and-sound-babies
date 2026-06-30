import { Link, useLocation } from "@tanstack/react-router";
import { Home, Package, User, Plus, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/tracking", label: "Track", icon: BarChart2 },
] as const;

const rightTabs = [
  { to: "/products", label: "Products", icon: Package },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white"
      style={{ boxShadow: "0 -2px 16px rgba(0,0,0,0.06)" }}
    >
      <div className="mx-auto flex max-w-md items-end justify-between px-6 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2">
        {tabs.map((t) => (
          <TabItem
            key={t.to}
            {...t}
            active={
              t.to === "/tracking"
                ? pathname === "/tracking" || pathname === "/growth" || pathname === "/first-foods"
                : pathname === t.to
            }
          />
        ))}

        {/* Center Add FAB */}
        <Link
          to="/add"
          className="relative -mt-8 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white ring-4 ring-white transition-transform duration-150 hover:scale-105 active:scale-95"
          style={{ boxShadow: "0 4px 16px rgba(44,95,90,0.35)" }}
          aria-label="Add"
        >
          <Plus className="h-6 w-6" strokeWidth={2.5} />
        </Link>

        {rightTabs.map((t) => (
          <TabItem key={t.to} {...t} active={pathname === t.to} />
        ))}
      </div>
    </nav>
  );
}

function TabItem({
  to,
  label,
  icon: Icon,
  active,
}: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex w-14 flex-col items-center gap-0.5 py-1 transition-colors duration-150",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground/70",
      )}
    >
      <Icon className="h-5 w-5" />
      <span
        style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
        className={cn(
          "text-[10px] font-medium tracking-[0.04em]",
          active ? "text-primary" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </Link>
  );
}
