import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export const Route = createFileRoute(
  "/_authenticated/profile_/notification-settings",
)({
  ssr: false,
  component: NotificationSettingsPage,
  head: () => ({ meta: [{ title: "Notification Settings — Safe & Sound" }] }),
});

type Settings = {
  recalls_enabled: boolean;
  size_up_enabled: boolean;
  replacement_enabled: boolean;
};

function NotificationSettingsPage() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<Settings>({
    recalls_enabled: true,
    size_up_enabled: true,
    replacement_enabled: true,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await (supabase as any)
        .from("user_notification_settings")
        .select("recalls_enabled, size_up_enabled, replacement_enabled")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) setSettings(data as Settings);
      setLoading(false);
    })();
  }, []);

  async function toggle(field: keyof Settings) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const next = { ...settings, [field]: !settings[field] };
    setSettings(next);
    const { error } = await (supabase as any)
      .from("user_notification_settings")
      .upsert({ user_id: user.id, ...next, updated_at: new Date().toISOString() }, {
        onConflict: "user_id",
      });
    if (error) {
      toast.error("Could not save setting");
      setSettings(settings);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur">
        <button
          onClick={() => navigate({ to: "/profile" })}
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <Bell className="h-5 w-5 text-accent" />
        <h1 className="font-display text-base font-semibold">
          Notification Settings
        </h1>
      </header>

      <div className="mx-auto w-full max-w-lg px-4 py-6 space-y-4">
        <p className="font-body text-sm text-muted-foreground px-1">
          Safe and Sound only sends safety-related alerts. Toggle below to choose which ones reach you.
        </p>

        <div className="rounded-3xl border border-border/60 bg-card divide-y divide-border/40">
          <SettingRow
            label="Safety recalls"
            description="Get notified when a product you own is recalled."
            checked={settings.recalls_enabled}
            onToggle={() => toggle("recalls_enabled")}
            disabled={loading}
          />
          <SettingRow
            label="Size-up reminders"
            description="Know when your baby is approaching the size limit for a product."
            checked={settings.size_up_enabled}
            onToggle={() => toggle("size_up_enabled")}
            disabled={loading}
          />
          <SettingRow
            label="Replacement reminders"
            description="Be reminded when it's time to replace a product for safety reasons."
            checked={settings.replacement_enabled}
            onToggle={() => toggle("replacement_enabled")}
            disabled={loading}
          />
        </div>

        <p className="font-body text-xs text-muted-foreground px-1 pt-2">
          You will never receive promotions or marketing messages from Safe and Sound.
        </p>
      </div>
    </div>
  );
}

function SettingRow({
  label,
  description,
  checked,
  onToggle,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <div className="flex-1">
        <p className="font-body text-sm font-medium text-foreground">{label}</p>
        <p className="font-body text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onToggle} disabled={disabled} />
    </div>
  );
}
