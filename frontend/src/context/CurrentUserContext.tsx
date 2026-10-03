import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// No real auth: identity is a member id or "teacher", picked in the header.
export type CurrentUser = number | "teacher";

interface CurrentUserValue {
  currentUser: CurrentUser;
  setCurrentUser: (user: CurrentUser) => void;
}

const STORAGE_KEY = "ledger.currentUser";

const CurrentUserContext = createContext<CurrentUserValue | null>(null);

function loadStored(): CurrentUser {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && raw !== "teacher" && Number.isInteger(Number(raw))) return Number(raw);
  } catch {
    // Storage unavailable; fall back to teacher.
  }
  return "teacher";
}

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<CurrentUser>(loadStored);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(currentUser));
    } catch {
      // Ignore; the choice just won't survive a reload.
    }
  }, [currentUser]);

  return (
    <CurrentUserContext.Provider value={{ currentUser, setCurrentUser }}>
      {children}
    </CurrentUserContext.Provider>
  );
}

export function useCurrentUser(): CurrentUserValue {
  const value = useContext(CurrentUserContext);
  if (!value) throw new Error("useCurrentUser must be used inside CurrentUserProvider");
  return value;
}
