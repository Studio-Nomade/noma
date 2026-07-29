import Link from "next/link";

export function PeopleTabs({
  current,
}: {
  current: "employees" | "honoraria";
}) {
  return (
    <nav className="border-border mb-6 flex gap-1 border-b">
      <Link
        href="/personas/empleados"
        className={
          current === "employees"
            ? "border-foreground -mb-px border-b-2 px-3 py-2 text-sm font-medium"
            : "text-muted-foreground px-3 py-2 text-sm"
        }
      >
        Empleados
      </Link>
      <Link
        href="/personas/honorarios"
        className={
          current === "honoraria"
            ? "border-foreground -mb-px border-b-2 px-3 py-2 text-sm font-medium"
            : "text-muted-foreground px-3 py-2 text-sm"
        }
      >
        Honorarios
      </Link>
    </nav>
  );
}
