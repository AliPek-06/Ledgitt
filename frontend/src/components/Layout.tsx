import { Link, Outlet } from "react-router-dom";
import { USE_MOCKS } from "../api/client";
import UserSwitcher from "./UserSwitcher";

export default function Layout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-lg font-semibold">
            Ledger
          </Link>
          {USE_MOCKS && (
            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              mock data
            </span>
          )}
        </div>
        <UserSwitcher />
      </header>
      <main className="mx-auto max-w-5xl p-6">
        <Outlet />
      </main>
    </div>
  );
}
