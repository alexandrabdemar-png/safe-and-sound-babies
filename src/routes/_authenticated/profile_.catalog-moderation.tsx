/**
 * Admin-only light moderation view for the shared product catalog.
 *
 * Parents who scan a product we can't resolve type the details themselves;
 * those rows land in the catalog as community submissions. This screen lets an
 * admin correct a typo/brand/category, promote a good entry to the verified
 * tier, or delete junk. Everything goes through admin-gated server functions —
 * the browser has no write access to the catalog.
 */
import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Check, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORIES } from "@/lib/productCategories";
import {
  amICatalogAdmin,
  deleteCatalogEntry,
  listCatalogEntries,
  updateCatalogEntry,
  type ModerationEntry,
} from "@/lib/catalogModeration.functions";

export const Route = createFileRoute("/_authenticated/profile_/catalog-moderation")({
  ssr: false,
  component: CatalogModerationPage,
  head: () => ({
    meta: [
      { title: "Catalog Moderation — Peace of Mine" },
      {
        name: "description",
        content:
          "Review, correct, promote, or remove community-submitted product entries in the Peace of Mine shared product catalog.",
      },
      { property: "og:title", content: "Catalog Moderation — Peace of Mine" },
      {
        property: "og:description",
        content: "Admin tools for keeping the shared baby-product catalog accurate.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const SOURCE_LABELS: Record<string, string> = {
  seed: "Verified catalog",
  manual: "Community submission",
};

function sourceLabel(source: string) {
  return SOURCE_LABELS[source] ?? `Sourced UPC catalog (${source})`;
}

function CatalogModerationPage() {
  const [filter, setFilter] = useState<"community" | "all">("community");
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const checkAdmin = useServerFn(amICatalogAdmin);
  const fetchEntries = useServerFn(listCatalogEntries);
  const saveEntry = useServerFn(updateCatalogEntry);
  const removeEntry = useServerFn(deleteCatalogEntry);

  const adminQuery = useQuery({
    queryKey: ["catalog-admin"],
    queryFn: () => checkAdmin(),
  });
  const isAdmin = adminQuery.data?.isAdmin === true;

  const entriesQuery = useQuery({
    queryKey: ["catalog-moderation", filter, search],
    queryFn: () => fetchEntries({ data: { filter, search } }),
    enabled: isAdmin,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["catalog-moderation"] });

  const save = useMutation({
    mutationFn: (input: Parameters<typeof saveEntry>[0]["data"]) => saveEntry({ data: input }),
    onSuccess: (row) => {
      toast.success(row.source === "seed" ? "Promoted to verified catalog" : "Entry updated");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't save that entry"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeEntry({ data: { id } }),
    onSuccess: () => {
      toast.success("Entry deleted");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't delete that entry"),
  });

  const entries = useMemo(() => entriesQuery.data ?? [], [entriesQuery.data]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur">
        <Button variant="ghost" size="icon" className="rounded-full" asChild aria-label="Back to profile">
          <Link to="/profile">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="font-display text-lg">Catalog moderation</h1>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 px-4 py-5">
        {adminQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking access…
          </div>
        ) : !isAdmin ? (
          <p className="rounded-2xl border border-border/60 bg-card p-5 font-body text-sm text-muted-foreground">
            This screen is for catalog admins only.
          </p>
        ) : (
          <>
            <p className="font-body text-sm leading-relaxed text-muted-foreground">
              Community submissions are what parents typed in when we couldn't resolve a barcode.
              Correct anything that looks off, promote good entries to the verified tier, or delete
              junk.
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-full border border-border/60 p-0.5">
                {(["community", "all"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    className={`rounded-full px-3 py-1.5 font-body text-xs ${
                      filter === f ? "bg-accent/15 text-accent" : "text-muted-foreground"
                    }`}
                  >
                    {f === "community" ? "Community" : "All entries"}
                  </button>
                ))}
              </div>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, brand, or barcode"
                className="h-9 flex-1 min-w-[12rem] rounded-full"
              />
            </div>

            {entriesQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading entries…
              </div>
            ) : entries.length === 0 ? (
              <p className="rounded-2xl border border-border/60 bg-card p-5 font-body text-sm text-muted-foreground">
                Nothing to review here.
              </p>
            ) : (
              <ul className="space-y-3">
                {entries.map((entry) => (
                  <EntryCard
                    key={entry.id}
                    entry={entry}
                    saving={save.isPending}
                    deleting={remove.isPending}
                    onSave={(input) => save.mutate(input)}
                    onDelete={() => remove.mutate(entry.id)}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </main>
    </div>
  );
}

type SaveInput = {
  id: string;
  name: string | null;
  brand: string | null;
  category: string | null;
  isBabyProduct: boolean;
  promote?: boolean;
};

function EntryCard({
  entry,
  saving,
  deleting,
  onSave,
  onDelete,
}: {
  entry: ModerationEntry;
  saving: boolean;
  deleting: boolean;
  onSave: (input: SaveInput) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(entry.name ?? "");
  const [brand, setBrand] = useState(entry.brand ?? "");
  const [category, setCategory] = useState(entry.category ?? "");
  const [isBaby, setIsBaby] = useState(entry.is_baby_product);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const base = (promote?: boolean): SaveInput => ({
    id: entry.id,
    name: name.trim() || null,
    brand: brand.trim() || null,
    category: category.trim() || null,
    isBabyProduct: isBaby,
    promote,
  });

  return (
    <li className="space-y-3 rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex items-start gap-3">
        {entry.image_url ? (
          <img
            src={entry.image_url}
            alt={entry.name ? `${entry.name} product photo` : "Product photo"}
            className="h-12 w-12 rounded-xl object-cover"
            loading="lazy"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="font-body text-xs text-muted-foreground">UPC {entry.barcode}</p>
          <p className="font-body text-xs text-muted-foreground">{sourceLabel(entry.source)}</p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Product name" />
        <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Brand" />
        <Select value={category || "unset"} onValueChange={(v) => setCategory(v === "unset" ? "" : v)}>
          <SelectTrigger>
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unset">No category</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.key} value={c.key}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 font-body text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={isBaby}
            onChange={(e) => setIsBaby(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          Baby product
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="rounded-full" disabled={saving} onClick={() => onSave(base())}>
          <Check className="mr-1.5 h-4 w-4" /> Save correction
        </Button>
        {entry.source !== "seed" && (
          <Button size="sm" className="rounded-full" disabled={saving} onClick={() => onSave(base(true))}>
            <ShieldCheck className="mr-1.5 h-4 w-4" /> Promote to verified
          </Button>
        )}
        {confirmDelete ? (
          <>
            <Button
              size="sm"
              variant="destructive"
              className="rounded-full"
              disabled={deleting}
              onClick={onDelete}
            >
              Confirm delete
            </Button>
            <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full text-destructive"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="mr-1.5 h-4 w-4" /> Delete
          </Button>
        )}
      </div>
    </li>
  );
}
