import { cn } from "@/lib/utils";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/**
 * Avatar circular: muestra la foto si existe, o las iniciales sobre un fondo
 * suave. Se usa en el selector de equipo y en el deck.
 */
export function AvatarCircle({
  name,
  photoUrl,
  className,
}: {
  name: string;
  photoUrl?: string | null;
  className?: string;
}) {
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={name}
        className={cn("rounded-full object-cover", className)}
      />
    );
  }
  return (
    <span
      className={cn(
        "bg-accent text-muted-foreground inline-flex items-center justify-center rounded-full font-medium",
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
