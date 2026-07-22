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
      <Image
        src="/assets/brand/nomade-black.png"
        alt="Studio Nomade"
        width={728}
        height={541}
        priority
        className={cn(
          "object-contain dark:hidden",
          collapsed ? "size-9" : "h-11 w-auto",
        )}
      />
      <Image
        src="/assets/brand/nomade-white.png"
        alt="Studio Nomade"
        width={728}
        height={556}
        priority
        className={cn(
          "hidden object-contain dark:block",
          collapsed ? "size-9" : "h-11 w-auto",
        )}
      />
    </Link>
  );
}
