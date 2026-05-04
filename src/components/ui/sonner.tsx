import { Toaster as Sonner, toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const isMobile = useIsMobile();

  return (
    <Sonner
      theme="light"
      // Mobile: top-center keeps toasts visible above bottom nav and within thumb-reach.
      // Desktop: top-right keeps the screen readable and out of the FAB area.
      position={isMobile ? "top-center" : "top-right"}
      className="toaster group"
      // Slightly larger duration on mobile so users have time to read while interacting.
      duration={isMobile ? 5000 : 4000}
      // Stack semantics: at most one visible at a time.
      visibleToasts={1}
      expand={false}
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
