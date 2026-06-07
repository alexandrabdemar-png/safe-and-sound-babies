import { Link, useLocation } from "@tanstack/react-router";
import { Home, Package, Bell, User, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/products", label: "Products", icon: Package },
] as const;

const rightTabs = [
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-md items-end justify-between px-6 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2">
        {tabs.map((t) => (
          <TabItem key={t.to} {...t} active={pathname === t.to} />
        ))}

        {/* Center Add button */}
        <Link
          to="/add"
          className="relative -mt-8 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-4 ring-background transition-transform hover:scale-105 active:scale-95"
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
        "flex w-14 flex-col items-center gap-1 py-1 font-body text-[10px] font-medium tracking-wide transition-colors",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className={cn("h-5 w-5", active && "fill-primary/10")} />
      <span>{label}</span>
    </Link>
  );
}
