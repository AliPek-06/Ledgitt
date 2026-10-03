import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ApiError, createAssignment } from "../api/client";
import type { AssignmentDetail } from "../api/types";
import { formatDateRange } from "../lib/format";

// <input type="date"> gives "YYYY-MM-DD"; send it as local midnight in ISO 8601.
function toIso(date: string): string {
  return new Date(`${date}T00:00:00`).toISOString();
}

export default function TeacherNew() {
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<AssignmentDetail | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Give the assignment a title.");
      return;
    }
    if (dueDate <= startDate) {
      setError("The due date needs to be after the start date.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      setCreated(await createAssignment({ title: title.trim(), start_date: toIso(startDate), due_date: toIso(dueDate) }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "We couldn't create the assignment just now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (created) return <JoinLink assignment={created} />;

  return (
    <section className="mx-auto max-w-xl">
      <h1 className="text-3xl font-semibold">New assignment</h1>
      <p className="mt-2 text-stone-600">Set the dates, then share the join link with your class.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-6 rounded-xl border border-stone-200 bg-white p-8">
        <label className="block">
          <span className="font-medium">Title</span>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Engineering Design Report"
            className="mt-2 w-full rounded-lg border border-stone-300 px-4 py-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="font-medium">Start date</span>
            <input
              required
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-2 w-full rounded-lg border border-stone-300 px-4 py-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </label>
          <label className="block">
            <span className="font-medium">Due date</span>
            <input
              required
              type="date"
              value={dueDate}
              min={startDate || undefined}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-2 w-full rounded-lg border border-stone-300 px-4 py-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </label>
        </div>

        {error && <p className="rounded-lg bg-amber-50 px-4 py-3 text-amber-900">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-accent px-4 py-3 font-medium text-white hover:bg-accent-strong disabled:opacity-60"
        >
          {submitting ? "Creating…" : "Create assignment"}
        </button>
      </form>
    </section>
  );
}

function JoinLink({ assignment }: { assignment: AssignmentDetail }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(assignment.join_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (e.g. not a secure context); the link is still selectable.
    }
  }

  return (
    <section className="mx-auto max-w-3xl text-center">
      <p className="font-medium text-accent">Assignment created</p>
      <h1 className="mt-2 text-3xl font-semibold">{assignment.title}</h1>
      <p className="mt-2 text-stone-600">{formatDateRange(assignment.start_date, assignment.due_date)}</p>

      <div className="mt-10 rounded-xl border border-stone-200 bg-white p-10">
        <p className="text-stone-600">Share this link with your students</p>
        <p className="mt-4 select-all break-all font-mono text-3xl font-semibold text-accent-strong">
          {assignment.join_url}
        </p>
        <p className="mt-3 text-stone-500">
          Join code <span className="font-mono font-semibold text-stone-800">{assignment.join_code}</span>
        </p>
        <button
          onClick={copy}
          className="mt-8 rounded-lg bg-accent px-6 py-3 font-medium text-white hover:bg-accent-strong"
        >
          {copied ? "Copied!" : "Copy link"}
        </button>
      </div>

      <Link to={`/teacher/${assignment.id}`} className="mt-8 inline-block font-medium text-accent hover:underline">
        Go to the class dashboard →
      </Link>
    </section>
  );
}
