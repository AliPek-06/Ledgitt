import { Link } from "react-router-dom";
import Placeholder from "../components/Placeholder";

// Dev index: links to every route, using the mock Group 7 ids.
const LINKS = [
  ["/teacher/new", "New assignment (teacher)"],
  ["/teacher/1", "Assignment 1 dashboard (teacher)"],
  ["/join/GRP7K4", "Join with code GRP7K4"],
  ["/team/1/charter", "Group 7 charter"],
  ["/team/1", "Group 7 workspace"],
];

export default function Home() {
  return (
    <Placeholder title="Ledgitt">
      <ul className="mt-4 list-disc pl-6">
        {LINKS.map(([to, label]) => (
          <li key={to}>
            <Link className="text-blue-700 underline" to={to}>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </Placeholder>
  );
}
