export function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="bg-foreground text-background flex size-8 items-center justify-center rounded-lg">
        <span className="font-heading text-sm font-semibold">N</span>
      </div>
      <div className="leading-tight">
        <p className="font-heading text-sm font-semibold tracking-tight">
          Noma
        </p>
        <p className="text-muted-foreground text-[10px] tracking-wide uppercase">
          Studio Nomade
        </p>
      </div>
    </div>
  );
}
