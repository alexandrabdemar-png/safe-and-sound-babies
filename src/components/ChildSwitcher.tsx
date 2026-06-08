import { Link } from '@tanstack/react-router';
import { ChevronDown, Plus } from 'lucide-react';
import { useActiveChild, setActiveChildId } from '@/hooks/useActiveChild';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

export function ChildSwitcher() {
  const { children, activeChild } = useActiveChild();

  if (children.length <= 1) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="rounded-full font-body text-xs h-8">
          {activeChild?.name ?? 'Pick a child'} <ChevronDown className="ml-1 h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        {children.map((c) => (
          <DropdownMenuItem key={c.id} onSelect={() => setActiveChildId(c.id)}>
            {c.name}
            {c.id === activeChild?.id && <span className="ml-auto text-primary">•</span>}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/profile" className="flex items-center gap-2">
            <Plus className="h-3 w-3" /> Manage children
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
