import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Loader2, Receipt, ScanLine, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useActiveChild } from "@/hooks/useActiveChild";
import { useProGate } from "@/hooks/useProGate";
import { CATEGORIES } from "@/lib/productCategories";
import { extractReceiptItems } from "@/lib/receiptImport.functions";
import { isRecallReady, RECEIPT_ACCURACY_WARNING, type ReceiptItem } from "@/lib/receiptItems";
import { logError } from "@/lib/sanitize-error";

export const Route = createFileRoute("/_authenticated/receipt-import")({
  head: () => ({
    meta: [
      { title: "Import from a receipt · Peace of Mine" },
      { name: "description", content: "Add products and foods from a receipt photo to watch them for recalls." },
      { property: "og:title", content: "Import from a receipt · Peace of Mine" },
      { property: "og:description", content: "Add products and foods from a receipt photo to watch them for recalls." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReceiptImportPage,
});

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      // Downscale large photos so uploads stay fast.
      const max = 2000;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Couldn't open that image.")); };
    img.src = url;
  });
}

function ReceiptImportPage() {
  const navigate = useNavigate();
  const extract = useServerFn(extractReceiptItems);
  const { requirePro } = useProGate();
  const { activeChildId } = useActiveChild();
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<ReceiptItem[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [acknowledged, setAcknowledged] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!requirePro("Receipt import", "Upload a receipt and pick which products and foods to watch for recalls.")) return;
    setReading(true);
    try {
      const image = await fileToDataUrl(file);
      const res = await extract({ data: { image } });
      const list: ReceiptItem[] = res.items.map((it, i) => ({
        id: String(i),
        receiptText: it.receipt_text,
        name: it.name,
        brand: it.brand,
        kind: it.kind,
        categoryKey: it.category_key,
        confident: it.confident,
      }));
      setItems(list);
      setSelected(new Set());
      if (list.length === 0) toast.info("We didn't find any baby products or foods on that receipt.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "We couldn't read that receipt.");
    } finally {
      setReading(false);
    }
  }

  function update(id: string, patch: Partial<ReceiptItem>) {
    setItems((prev) => prev?.map((it) => (it.id === id ? { ...it, ...patch } : it)) ?? null);
  }

  function toggle(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  }

  const chosen = (items ?? []).filter((it) => selected.has(it.id));
  const incomplete = chosen.filter((it) => !isRecallReady(it));

  async function save() {
    if (!chosen.length) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { toast.error("Please sign in again."); return; }
    const foods = chosen.filter((c) => c.kind === "food");
    if (foods.length && !activeChildId) {
      toast.error("Add a child first so we know whose food log to use.");
      return;
    }
    setSaving(true);
    try {
      const products = chosen.filter((c) => c.kind === "product");
      if (products.length) {
        const { error } = await supabase.from("products").insert(
          products.map((p) => ({
            user_id: session.user.id,
            child_id: activeChildId,
            name: p.name.trim().slice(0, 200),
            brand: p.brand.trim().slice(0, 120) || null,
            category: CATEGORIES.find((c) => c.key === p.categoryKey)?.label ?? null,
            added_at: new Date().toISOString(),
            product_type: p.categoryKey === "car_seat" ? "car_seat" : "other",
            notes: isRecallReady(p) ? "Added from receipt" : "Added from receipt — needs full brand and product name for accurate recall checks",
          })) as never,
        );
        if (error) throw error;
      }
      if (foods.length && activeChildId) {
        const today = new Date().toISOString().slice(0, 10);
        const { error } = await supabase.from("first_foods").insert(
          foods.map((f) => ({
            child_id: activeChildId,
            food_name: f.name.trim().slice(0, 200),
            brand: f.brand.trim().slice(0, 120) || null,
            date_introduced: today,
            is_allergen: false,
            is_packaged: true,
          })),
        );
        if (error) throw error;
      }
      toast.success(`Added ${chosen.length} item${chosen.length === 1 ? "" : "s"} to watch for recalls.`);
      navigate({ to: products(chosen) ? "/products" : "/first-foods" });
    } catch (e) {
      logError("[receipt-import] save failed:", e);
      toast.error("We couldn't save those items. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col pb-32">
      <header className="px-5 pt-10 pb-4 sm:px-6">
        <div className="mx-auto max-w-md">
          <Link to="/products" className="inline-flex items-center gap-1 font-body text-sm text-muted-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">Import from a receipt</h1>
          <p className="mt-2 font-body text-sm text-muted-foreground">
            Upload a photo or screenshot of a grocery, Amazon or store receipt, then pick what to watch for recalls.
          </p>
        </div>
      </header>

      <main className="flex-1 px-5 sm:px-6">
        <div className="mx-auto max-w-md space-y-4">
          <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div className="font-body text-sm">
                <p className="font-semibold">Use at your own risk</p>
                <p className="mt-1 text-muted-foreground">{RECEIPT_ACCURACY_WARNING}</p>
                <Button asChild variant="link" className="h-auto px-0 pt-2 font-semibold">
                  <Link to="/products/scan"><ScanLine className="mr-1 h-4 w-4" /> Scan a barcode instead</Link>
                </Button>
              </div>
            </div>
          </div>

          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border bg-card p-6 text-center">
            {reading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <Receipt className="h-6 w-6 text-primary" />}
            <span className="font-body text-sm font-semibold">
              {reading ? "Reading your receipt…" : items ? "Upload a different receipt" : "Upload receipt photo or screenshot"}
            </span>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={reading}
              onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }}
            />
          </label>

          {items && items.length > 0 && (
            <>
              <p className="font-body text-sm text-muted-foreground">
                Select the items to add. Check each brand and full product name — fix anything the receipt shortened.
              </p>
              <ul className="space-y-3">
                {items.map((it) => {
                  const ready = isRecallReady(it);
                  const on = selected.has(it.id);
                  return (
                    <li key={it.id} className="rounded-2xl border border-border bg-card p-4">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id={`item-${it.id}`}
                          checked={on}
                          onCheckedChange={(v) => toggle(it.id, v === true)}
                          aria-label={`Select ${it.name || it.receiptText}`}
                          className="mt-1"
                        />
                        <div className="min-w-0 flex-1 space-y-2">
                          <p className="font-mono text-xs text-muted-foreground">Receipt: {it.receiptText}</p>
                          <div>
                            <Label htmlFor={`brand-${it.id}`} className="text-xs">Brand</Label>
                            <Input id={`brand-${it.id}`} value={it.brand} placeholder="e.g. Gerber"
                              onChange={(e) => update(it.id, { brand: e.target.value })} />
                          </div>
                          <div>
                            <Label htmlFor={`name-${it.id}`} className="text-xs">Full product name</Label>
                            <Input id={`name-${it.id}`} value={it.name} placeholder="e.g. Organic Apple Mango Pouch"
                              onChange={(e) => update(it.id, { name: e.target.value })} />
                          </div>
                          <div className="flex gap-2">
                            {(["product", "food"] as const).map((k) => (
                              <Button key={k} type="button" size="sm"
                                variant={it.kind === k ? "default" : "outline"}
                                className="rounded-full text-xs"
                                onClick={() => update(it.id, { kind: k })}>
                                {k === "product" ? "Product" : "Food"}
                              </Button>
                            ))}
                          </div>
                          {ready ? (
                            <p className="flex items-center gap-1 font-body text-xs text-primary">
                              <ShieldCheck className="h-3.5 w-3.5" /> Ready for recall checks
                            </p>
                          ) : (
                            <p className="flex items-center gap-1 font-body text-xs text-destructive">
                              <AlertTriangle className="h-3.5 w-3.5" /> Needs the full brand and product name — we can't accurately check recalls without them
                            </p>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {incomplete.length > 0 && (
                <div className="space-y-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 font-body text-sm">
                  <p>
                    {incomplete.length} selected item{incomplete.length === 1 ? " is" : "s are"} missing a full brand or product name.
                    Without them we cannot accurately pull recalls for {incomplete.length === 1 ? "it" : "them"}.
                  </p>
                  <label className="flex items-start gap-2">
                    <Checkbox checked={acknowledged} onCheckedChange={(v) => setAcknowledged(v === true)} className="mt-0.5" />
                    <span>I understand and want to add {incomplete.length === 1 ? "it" : "them"} anyway.</span>
                  </label>
                </div>
              )}

              <Button
                className="w-full rounded-full"
                disabled={saving || chosen.length === 0 || (incomplete.length > 0 && !acknowledged)}
                onClick={save}
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add {chosen.length || ""} selected item{chosen.length === 1 ? "" : "s"}
              </Button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function products(list: ReceiptItem[]) {
  return list.some((i) => i.kind === "product");
}
