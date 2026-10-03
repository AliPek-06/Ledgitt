import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { type DisplayContribution, PLANNED_COLOR, STATUS, formatPoints } from "../../lib/progress";

interface Props {
  members: DisplayContribution[];
  viewerId?: number;
}

interface Row extends DisplayContribution {
  label: string;
}

const INK = "#44403c"; // stone-700, text token
const MUTED = "#78716c"; // stone-500
const GRID = "#e7e5e4"; // stone-200, hairline

// Expected vs actual points per member. Two series -> legend; the actual bar is
// coloured by status (status palette) and its value is the only direct label.
export default function ContributionChart({ members, viewerId }: Props) {
  const rows: Row[] = members.map((m) => ({ ...m, label: m.member_id === viewerId ? `${m.name} (you)` : m.name }));

  return (
    <div>
      <Legend />
      <div className="mt-4 h-[22rem]" role="img" aria-label="Planned and confirmed points per member. The same numbers are in the table below.">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 32, right: 8, bottom: 8, left: 0 }} barGap={2} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: "#d6d3d1" }}
              tick={{ fontSize: 18, fill: INK, fontWeight: 500 }}
              tickMargin={10}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 15, fill: MUTED }}
              width={44}
              label={{ value: "Points", angle: -90, position: "insideLeft", fill: MUTED, fontSize: 15, dy: 24 }}
            />
            <Tooltip cursor={{ fill: "#f5f5f4" }} content={({ active, payload }) => (active && payload?.[0] ? <TooltipCard row={payload[0].payload as Row} /> : null)} />
            <Bar dataKey="expected_points" name="Planned by now" fill={PLANNED_COLOR} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            {/* minPointSize: a 0 still shows as a thin stub in its status colour, so a
                member with nothing confirmed doesn't look like an empty slot. */}
            <Bar
              dataKey="actual_points"
              name="Confirmed"
              maxBarSize={24}
              minPointSize={3}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            >
              {rows.map((r) => (
                <Cell key={r.member_id} fill={STATUS[r.status].color} />
              ))}
              <LabelList
                dataKey="actual_points"
                position="top"
                offset={8}
                formatter={(v) => formatPoints(Number(v))}
                style={{ fontSize: 17, fontWeight: 600, fill: INK }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-stone-700">
      <span className="flex items-center gap-2">
        <span className="h-3.5 w-3.5 rounded-sm" style={{ background: PLANNED_COLOR }} aria-hidden />
        Planned by now
      </span>
      <span className="flex items-center gap-2">
        <span className="flex gap-0.5" aria-hidden>
          {Object.values(STATUS).map((s) => (
            <span key={s.label} className="h-3.5 w-1.5 rounded-sm" style={{ background: s.color }} />
          ))}
        </span>
        Confirmed so far, coloured by status
      </span>
    </div>
  );
}

function TooltipCard({ row }: { row: Row }) {
  const s = STATUS[row.status];
  return (
    <div className="rounded-lg border border-stone-200 bg-white px-4 py-3 text-base shadow-lg">
      <p className="font-semibold text-stone-900">{row.label}</p>
      <p className="mt-1 text-stone-700">
        Planned by now: <span className="font-medium">{formatPoints(row.expected_points)} pts</span>
      </p>
      <p className="text-stone-700">
        Confirmed: <span className="font-medium">{formatPoints(row.actual_points)} pts</span>
      </p>
      <p className="mt-1 flex items-center gap-2 text-stone-700">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} aria-hidden />
        {s.icon} {s.label}
      </p>
    </div>
  );
}
