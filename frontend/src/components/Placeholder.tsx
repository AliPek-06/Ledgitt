import type { ReactNode } from "react";

export default function Placeholder({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <section>
      <h1 className="mb-2 text-2xl font-semibold">{title}</h1>
      <p className="text-slate-500">Placeholder page.</p>
      {children}
    </section>
  );
}
