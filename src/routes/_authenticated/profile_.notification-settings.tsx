import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, Bell, Clock, Calendar, Package, PauseCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export const Route = createFileRoute(
  "/_authenticated/profile_/notification-settings",
)({
  ssr: false,
  component: NotificationSettingsPage,
  head: () => ({ meta: [{ title: "Notification Settings — Peace of Mine" }] }),
});

type AlertSettings = {
  recalls_enabled: boolean;
  size_up_enabled: boolean;
  replacement_enabled: boolean;
};

type NotifPrefs = {
  reminder_time: string;
  tip_day: number;
  expiry_advance_days: number;
  paused_until: string | null;
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ADVANCE_OPTIONS = [7, 14, 30] as const;
const PAUSE_OPTIONS = [
  { label: "1 week", days: 7 },
  { label: "2 weeks", days: 14 },
] as const;

function NotificationSettingsPage() {
  const navigate = useNavigate();
  const [alertSettings, setAlertSettings] = useState<AlertSettings>({
    recalls_enabled: true,
    size_up_enabled: true,
    replacement_enabled: true,
  });
  const [prefs, setPrefs] = useState<NotifPrefs>({
    reminder_time: "09:00",
    tip_day: 1,
    expiry_advance_days: 30,
    paused_until: null,
  });
  const [loading, setLoading] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;
      setUserId(user.id);

      const { data: alertData } = await (supabase as any)
        .from("user_notification_settings")
        .select("recalls_enabled, size_up_enabled, replacement_enabled")
        .eq("user_id", user.id)
        .maybeSingle();
      if (alertData) setAlertSettings(alertData as AlertSettings);

      const { data: prefData } = await (supabase as any)
        .from("notification_preferences")
        .select("reminder_time, tip_day, expiry_advance_days, paused_until")
        .eq("user_id", user.id)
        .maybeSingle();
      if (prefData) setPrefs(prefData as NotifPrefs);

      setLoading(false);
    })();
  }, []);

  async function toggleAlert(field: keyof AlertSettings) {
    if (!userId) return;
    const next = { ...alertSettings, [field]: !alertSettings[field] };
    setAlertSettings(next);
    const { error } = await (supabase as any)
      .from("user_notification_settings")
      .upsert({ user_id: userId, ...next, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) {
      toast.error("Could not save setting");
      setAlertSettings(alertSettings);
    }
  }

  async function savePrefs(next: NotifPrefs) {
    if (!userId) return;
    setSavingPrefs(true);
    setPrefs(next);
    const { error } = await (supabase as any)
      .from("notification_preferences")
      .upsert({ user_id: userId, ...next, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    setSavingPrefs(false);
    if (error) {
      toast.error("Could not save preferences");
    } else {
      toast.success("Preferences saved");
    }
  }

  function pauseAlerts(days: number) {
    const until = new Date();
    until.setDate(until.getDate() + days);
    savePrefs({ ...prefs, paused_until: until.toISOString() });
  }

  function resumeAlerts() {
    savePrefs({ ...prefs, paused_until: null });
  }

  const isPaused = prefs.paused_until && new Date(prefs.paused_until) > new Date();
  const pausedUntilLabel = isPaused
    ? new Date(prefs.paused_until!).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur">
        <button
          onClick={() => navigate({ to: "/profile" })}
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <Bell className="h-5 w-5 text-accent" />
        <h1 className="font-display text-base font-semibold">Notification Settings</h1>
      </header>

      <div className="mx-auto w-full max-w-lg px-4 py-6 space-y-6">
        <p className="font-body text-sm text-muted-foreground px-1">
          Gentle, timely nudges — only when something needs your attention.
        </p>

        <div>
          <SectionLabel>Push notifications</SectionLabel>
          <div className="rounded-3xl border border-border/60 bg-card divide-y divide-border/40">
            <SettingRow
              label="Safety recalls"
              description="A push alert if a product you've logged is recalled — so you can act quickly."
              checked={alertSettings.recalls_enabled}
              onToggle={() => toggleAlert("recalls_enabled")}
              disabled={loading}
            />
          </div>
        </div>

        <div>
          <SectionLabel>In-app alerts only</SectionLabel>
          <div className="rounded-3xl border border-border/60 bg-card divide-y divide-border/40">
            <SettingRow
              label="Size-up reminders"
              description="Shown in the app when your baby is approaching a product's size or weight limit."
              checked={alertSettings.size_up_enabled}
              onToggle={() => toggleAlert("size_up_enabled")}
              disabled={loading}
            />
            <SettingRow
              label="Replacement reminders"
              description="Shown in the app when something is approaching the end of its safe use window."
              checked={alertSettings.replacement_enabled}
              onToggle={() => toggleAlert("replacement_enabled")}
              disabled={loading}
            />
          </div>
        </div>

        <div>
          <SectionLabel>Notification preferences</SectionLabel>
          <div className="rounded-3xl border border-border/60 bg-card divide-y divide-border/40">

            <div className="px-5 py-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="font-body text-sm font-medium">Reminder time</p>
              </div>
              <p className="font-body text-xs text-muted-foreground mb-3">
                Preferred time of day for in-app safety reminders.
              </p>
              <input
                type="time"
                value={prefs.reminder_time}
                onChange={(e) => setPrefs((p) => ({ ...p, reminder_time: e.target.value }))}
                onBlur={() => savePrefs(prefs)}
                disabled={loading}
                className="rounded-xl border border-border/60 bg-background px-3 py-2 font-body text-sm outline-none focus:border-primary disabled:opacity-50"
              />
            </div>

            <div className="px-5 py-4">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="font-body text-sm font-medium">Weekly tip day</p>
              </div>
              <p className="font-body text-xs text-muted-foreground mb-3">
                Which day of the week your weekly safety tip appears on the home screen.
              </p>
              <div className="flex flex-wrap gap-2">
                {DAY_NAMES.map((name, i) => (
                  <button
                    key={name}
                    type="button"
                    disabled={loading || savingPrefs}
                    onClick={() => savePrefs({ ...prefs, tip_day: i })}
                    className={`rounded-full border px-3 py-1.5 font-body text-xs font-medium transition-colors ${
                      prefs.tip_day === i
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border/60 bg-background text-muted-foreground hover:border-primary/60"
                    }`}
                  >
                    {name.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-5 py-4">
              <div className="flex items-center gap-2 mb-1">
                <Package className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="font-body text-sm font-medium">Product reminders — how far ahead</p>
              </div>
              <p className="font-body text-xs text-muted-foreground mb-3">
                How many days before a size-up or replacement date to show the reminder.
              </p>
              <div className="flex gap-2">
                {ADVANCE_OPTIONS.map((days) => (
                  <button
                    key={days}
                    type="button"
                    disabled={loading || savingPrefs}
                    onClick={() => savePrefs({ ...prefs, expiry_advance_days: days })}
                    className={`flex-1 rounded-full border py-2 font-body text-xs font-medium transition-colors ${
                      prefs.expiry_advance_days === days
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border/60 bg-background text-muted-foreground hover:border-primary/60"
                    }`}
                  >
                    {days} days
                  </button>
                ))}
              </div>
            </div>

            <div className="px-5 py-4">
              <div className="flex items-center gap-2 mb-1">
                <PauseCircle className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="font-body text-sm font-medium">Pause non-recall alerts</p>
              </div>
              <p className="font-body text-xs text-muted-foreground mb-3">
                Temporarily hide weekly tips and product reminders. Recalls are never paused.
              </p>
              {isPaused ? (
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="rounded-full bg-amber-100 border border-amber-200 px-3 py-1.5 font-body text-xs font-semibold text-amber-700">
                    Paused until {pausedUntilLabel}
                  </span>
                  <button
                    type="button"
                    onClick={resumeAlerts}
                    disabled={savingPrefs}
                    className="rounded-full border border-border/60 px-3 py-1.5 font-body text-xs text-muted-foreground hover:border-primary/60 disabled:opacity-50"
                  >
                    Resume now
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  {PAUSE_OPTIONS.map((opt) => (
                    <button
                      key={opt.days}
                      type="button"
                      disabled={loading || savingPrefs}
                      onClick={() => pauseAlerts(opt.days)}
                      className="rounded-full border border-border/60 bg-background px-4 py-1.5 font-body text-xs text-muted-foreground hover:border-primary/60 disabled:opacity-50"
                    >
                      Pause {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <p className="font-body text-xs text-muted-foreground px-1 pt-2">
          That's it — no promotions, no marketing, no noise. Just the things that matter.
        </p>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-body text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-2">
      {children}
    </p>
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
