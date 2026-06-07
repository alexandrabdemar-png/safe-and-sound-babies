import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { LogOut, User as UserIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
  head: () => ({ meta: [{ title: "Profile — Safe & Sound" }] }),
});

function ProfilePage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) toast.error(error.message);
    else {
      toast.success("Signed out");
      navigate({ to: "/auth" });
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background pb-28">
      <header className="px-5 pt-10 pb-6 sm:px-6">
        <div className="mx-auto max-w-md">
          <h1 className="font-display text-3xl font-semibold tracking-tight">Profile</h1>
          <p className="mt-1 font-body text-sm text-muted-foreground">{email ?? ""}</p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-md flex-1 px-5 sm:px-6">
        <div className="rounded-3xl border border-border/60 bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sand/50 text-accent">
              <UserIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="font-display text-base font-semibold">Account</p>
              <p className="font-body text-xs text-muted-foreground">Manage your account</p>
            </div>
          </div>
          <Button
            onClick={signOut}
            variant="outline"
            className="mt-5 w-full rounded-full font-body"
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
