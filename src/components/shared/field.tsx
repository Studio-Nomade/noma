import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Envoltura mínima de campo de formulario: label arriba, control, y mensaje de
 * error inline. Agnóstico de librería (se usa con react-hook-form).
 */
export function Field({
  label,
  htmlFor,
  error,
  required,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="text-muted-foreground"> *</span>}
      </Label>
      {children}
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
