import Link from "next/link";
import { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
          <Link href="/datasets" className="text-lg font-semibold tracking-normal text-ink">
            Nom Annotator
          </Link>
          <nav className="flex items-center gap-4 text-sm text-moss">
            <Link href="/datasets">Datasets</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-6">{children}</main>
    </div>
  );
}

