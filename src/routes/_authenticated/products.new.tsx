import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/products/new")({
  component: NewProductPage,
  head: () => ({ meta: [{ title: "Add product — Safe & Sound" }] }),
});

const CATEGORIES = [
  "Car seat",
  "Crib / sleep",
  "Pacifier",
  "Swaddle",
  "Stroller",
  "High chair",
  "Bottle",
  "Formula",
  "Toothbrush",
  "Baby gate",
  "Other",
];

function NewProductPage() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    brand: "",
    category: "",
    size: "",
    replace_at: "",
    next_size_at: "",
    notes: "",
  });

  function update<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Give your product a name");
      return;
    }
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase.from("products").insert({
        user_id: u.user.id,
        name: form.name.trim(),
        brand: form.brand.trim() || null,
        category: form.category || null,
        size: form.size.trim() || null,
        replace_at: form.replace_at || null,
        next_size_at: form.next_size_at || null,
        notes: form.notes.trim() || null,
      });
      if (error) throw error;
      toast.success("Saved — we'll keep an eye on it 🌙");
      navigate({ to: "/products" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background pb-16">
      <header className="px-5 pt-8 pb-4 sm:px-6">
        <div className="mx-auto max-w-md">
          <Button asChild variant="ghost" size="sm" className="-ml-2 rounded-full font-body text-xs">
            <Link to="/products">
              <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Products
            </Link>
          </Button>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">Add a product</h1>
          <p className="mt-1.5 font-body text-sm text-muted-foreground">
            We'll watch for recalls, and remind you when it's time to replace or size up — only if you set a date.
          </p>
        </div>
      </header>

      <main className="flex-1 px-5 sm:px-6">
        <form onSubmit={handleSubmit} className="mx-auto max-w-md space-y-5">
          <Field label="Name" required>
            <Input
              autoFocus
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="e.g. Nuna Pipa Lite car seat"
              maxLength={120}
              className="h-12 rounded-2xl bg-card px-4 font-body text-base"
            />
          </Field>

          <Field label="Brand">
            <Input
              value={form.brand}
              onChange={(e) => update("brand", e.target.value)}
              placeholder="e.g. Nuna"
              maxLength={80}
              className="h-12 rounded-2xl bg-card px-4 font-body text-base"
            />
          </Field>

          <Field label="Category">
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => update("category", c === form.category ? "" : c)}
                  className={
                    form.category === c
                      ? "rounded-full border border-primary bg-primary px-3.5 py-1.5 font-body text-xs font-semibold text-primary-foreground"
                      : "rounded-full border border-border bg-card px-3.5 py-1.5 font-body text-xs text-foreground/80"
                  }
                >
                  {c}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Current size">
            <Input
              value={form.size}
              onChange={(e) => update("size", e.target.value)}
              placeholder="e.g. 3-6 months, Size 2"
              maxLength={40}
              className="h-12 rounded-2xl bg-card px-4 font-body text-base"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Replace by">
              <Input
                type="date"
                value={form.replace_at}
                onChange={(e) => update("replace_at", e.target.value)}
                className="h-12 rounded-2xl bg-card px-4 font-body text-base"
              />
            </Field>
            <Field label="Size up by">
              <Input
                type="date"
                value={form.next_size_at}
                onChange={(e) => update("next_size_at", e.target.value)}
                className="h-12 rounded-2xl bg-card px-4 font-body text-base"
              />
            </Field>
          </div>

          <Button
            type="submit"
            disabled={saving}
            className="mt-4 h-12 w-full rounded-full bg-primary font-body text-sm font-semibold"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save product"}
          </Button>
        </form>
      </main>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="font-body text-sm">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}
