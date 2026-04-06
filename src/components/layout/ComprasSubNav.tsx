import { NavLink } from '@/components/NavLink';
import { useProjectNavigation } from '@/hooks/useProjectNavigation';
import { Package, Wrench } from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export function ComprasSubNav({ className }: { className?: string }) {
  const { paths } = useProjectNavigation();

  const items = [
    { label: 'Produtos', path: paths.comprasProdutos, icon: Package },
    { label: 'Prestadores', path: paths.comprasPrestadores, icon: Wrench },
  ];

  return (
    <div className={cn(
      'sticky top-[57px] z-40 bg-background/95 backdrop-blur-sm border-b border-border',
      className,
    )}>
      <div className="max-w-7xl mx-auto">
        <ScrollArea className="w-full">
          <nav className="flex items-center gap-1 px-4 sm:px-6 md:px-8 py-1.5" aria-label="Navegação de compras">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm whitespace-nowrap transition-colors text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  activeClassName="text-primary font-medium bg-primary/10 hover:bg-primary/10 hover:text-primary"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
          <ScrollBar orientation="horizontal" className="h-1" />
        </ScrollArea>
      </div>
    </div>
  );
}
