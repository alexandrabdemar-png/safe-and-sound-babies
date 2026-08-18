/**
 * Dev-only profile role switcher.
 *
 * Lets you flip the signed-in account between every profile type (parent,
 * pediatrician, daycare, …) without creating a second email address, so all
 * role-specific flows can be exercised from one test account.
 *
 * Rendered ONLY on Lovable preview / localhost hosts (see src/lib/previewHost.ts)
 * — it never appears on the published site or in a native TestFlight build.
 */
import { useEffect, useState } from "react";
import { FlaskConical, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PROFILE_TYPES, usesAgeRangeFlow, validateAgeRange, type ProfileType } from "@/lib/profileType";
import { isPreviewHost } from "@/lib/previewHost";

export function DevRoleSwitcher() {
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState<ProfileType | null>(null);
  const [saving, setSaving] = useState<ProfileType | null>(null);
  const [minMonths, setMinMonths] = useState("0");
  const [maxMonths, setMaxMonths] = useState("60");

  useEffect(() => {
    setVisible(isPreviewHost(window.location.hostname));
  }, []);

  useEffect(() => {
    if (!visible) return;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return;
      const { data } = await supabase
        .from("profiles")
        .select("profile_type, care_age_min_months, care_age_max_months")
        .eq("user_id", userId)
        .maybeSingle();
      const row = data as
        | { profile_type: ProfileType | null; care_age_min_months: number | null; care_age_max_months: number | null }
        | null;
      if (row?.profile_type) setCurrent(row.profile_type);
      if (row?.care_age_min_months != null) setMinMonths(String(row.care_age_min_months));
      if (row?.care_age_max_months != null) setMaxMonths(String(row.care_age_max_months));
    })();
  }, [visible]);

  async function switchTo(type: ProfileType) {
    const ageRange = usesAgeRangeFlow(type);
    const min = ageRange ? Number(minMonths) : null;
    const max = ageRange ? Number(maxMonths) : null;
    if (ageRange) {
      const check = validateAgeRange(min, max);
      if (!check.valid) {
        toast.error(check.error ?? "Invalid age range");
        return;
      }
    }

    setSaving(type);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase
        .from("profiles")
        .update({
          profile_type: type,
          care_age_min_months: min,
          care_age_max_months: max,
        } as never)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      setCurrent(type);
      toast.success(`Now testing as ${PROFILE_TYPES.find((p) => p.value === type)?.label}`, {
        description: "Reload the app to see role-specific screens.",
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't switch role");
    } finally {
      setSaving(null);
    }
  }

  if (!visible) return null;

  return (
    <section className="rounded-3xl border border-dashed border-primary/40 bg-primary/5 p-5">
      <div className="flex items-center gap-2">
        <FlaskConical className="h-4 w-4 text-primary" />
        <p className="font-display text-base font-semibold">Dev: switch profile type</p>
      </div>
      <p className="mt-1 font-body text-xs text-muted-foreground">
        Preview only — test every role from this one account. Currently:{" "}
        <span className="font-medium text-foreground">
          {current ? (PROFILE_TYPES.find((p) => p.value === current)?.label ?? current) : "not set"}
        </span>
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {PROFILE_TYPES.map((p) => (
          <Button
            key={p.value}
            size="sm"
            variant={current === p.value ? "default" : "outline"}
            className="rounded-full font-body text-xs"
            disabled={saving !== null}
            onClick={() => switchTo(p.value)}
          >
            {saving === p.value ? <Loader2 className="h-3 w-3 animate-spin" /> : p.label}
          </Button>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Input
          value={minMonths}
          onChange={(e) => setMinMonths(e.target.value)}
          inputMode="numeric"
          className="h-9 rounded-xl font-body text-xs"
          placeholder="Youngest (months)"
          aria-label="Care age minimum in months"
        />
        <Input
          value={maxMonths}
          onChange={(e) => setMaxMonths(e.target.value)}
          inputMode="numeric"
          className="h-9 rounded-xl font-body text-xs"
          placeholder="Oldest (months)"
          aria-label="Care age maximum in months"
        />
      </div>
      <p className="mt-2 font-body text-[11px] text-muted-foreground">
        Age range applies to pediatrician / daycare / babysitter / caregiver roles.
      </p>
    </section>
  );
}
