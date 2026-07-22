import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Brand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="Ir al dashboard"
      className={cn(
        "flex items-center",
        collapsed ? "justify-center" : "justify-start",
      )}
    >
      <span className="relative size-10 shrink-0">
        <Image
          src="/assets/brand/nomade-black.png"
          alt=""
          fill
          priority
          className="object-contain dark:hidden"
        />
        <Image
          src="/assets/brand/nomade-white.png"
          alt=""
          fill
          priority
          className="hidden object-contain dark:block"
        />
      </span>
      {!collapsed && (
        <span className="ml-2.5 min-w-0 leading-none">
          <span className="font-heading block text-base font-semibold">
            Noma
          </span>
          <span className="text-muted-foreground mt-1 block text-[10px] font-medium">
            by Studio Nomade
          </span>
        </span>
      )}
    </Link>
  );
}
