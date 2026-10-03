import { useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { USE_MOCKS } from "../api/client";
import DemoPanel from "./DemoPanel";
import UserSwitcher from "./UserSwitcher";

export default function Layout() {
  // Bumped after seed/reset: remounts the page so screens that load once (e.g. the
  // charter) reload too. The demo panel sits outside it and keeps its state.
  const [dataVersion, setDataVersion] = useState(0);

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <div key={dataVersion}>
        <header className="flex items-center justify-between border-b border-stone-200 bg-white px-8 py-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-xl font-semibold text-accent">
              Ledger
            </Link>
            {USE_MOCKS && (
              <span className="rounded bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
                mock data
              </span>
            )}
          </div>
          <UserSwitcher />
        </header>
        {/* Bottom padding leaves room to scroll any content clear of the fixed demo
            panel (bottom right), e.g. the "Label it" button on a 720px projector. */}
        <main className="mx-auto max-w-6xl px-8 pt-10 pb-80">
          <Outlet />
        </main>
      </div>
      <DemoPanel onDataReplaced={() => setDataVersion((v) => v + 1)} />
    </div>
  );
}
