import { Link, Outlet } from "react-router-dom";
import { USE_MOCKS } from "../api/client";
import UserSwitcher from "./UserSwitcher";

export default function Layout() {
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
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
      <main className="mx-auto max-w-6xl px-8 py-10">
        <Outlet />
      </main>
    </div>
  );
}
