function Footer() {
  return (
    <footer className="mt-auto w-full border-t border-slate-200/80 bg-white/80 py-8 transition-colors duration-500 dark:border-slate-800/80 dark:bg-slate-950/70">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 lg:px-8 md:flex-row">
        <div className="group flex cursor-default items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-linear-to-br from-indigo-600 to-purple-600 shadow-lg shadow-indigo-500/20 transition-transform duration-300 group-hover:rotate-6">
            <span className="text-sm font-black text-white">M</span>
          </div>
          <span className="bg-linear-to-r from-indigo-600 to-purple-600 bg-clip-text text-base font-black tracking-tighter text-transparent dark:from-indigo-400 dark:to-purple-300">
            MockMate
          </span>
        </div>

        <p className="text-center text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-500 md:text-left">
          © {new Date().getFullYear()} MockMate Platform.{" "}
          <span className="hidden opacity-50 sm:inline">•</span>{" "}
          <span className="mt-1 block sm:mt-0 sm:inline">
            AI-Powered Excellence.
          </span>
        </p>

        <div className="flex items-center gap-6">
          {[
            { label: "About", href: "/about" },
            { label: "Contact", href: "/contact" },
            { label: "Terms", href: "/terms" },
          ].map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-[11px] font-black uppercase tracking-widest text-slate-400 transition-all duration-200 hover:text-indigo-600 dark:text-slate-500 dark:hover:text-indigo-400"
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}

export default Footer;
