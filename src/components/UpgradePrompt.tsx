import { useNavigate } from '@tanstack/react-router';
import { Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useProGateRequest } from '@/hooks/useProGate';

export function UpgradePrompt() {
  const [req, dismiss] = useProGateRequest();
  const navigate = useNavigate();
  const open = req !== null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) dismiss(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <DialogTitle className="text-center">{req?.feature} is a Pro feature</DialogTitle>
          <DialogDescription className="text-center">
            {req?.description ?? 'Everything in free, plus expert features, tips and tricks, safety insights, and pediatrician-reviewed guidance. Try free for 7 days.'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            className="w-full"
            onClick={() => { dismiss(); navigate({ to: '/pricing' }); }}
          >
            Start free trial
          </Button>
          <Button variant="ghost" className="w-full" onClick={dismiss}>
            Not now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
