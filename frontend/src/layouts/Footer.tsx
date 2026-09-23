export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border/60 bg-card/40 py-3.5 px-4 sm:px-6 mt-auto">
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground flex-wrap">
        <p className="font-mono text-[11px]">
          &copy; {currentYear} AgencyOS. Enterprise Edition.
        </p>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>API Online</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
