import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import type { ReviewReport } from "@/components/review/report-view";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Quality dashboard — PyReview" },
      {
        name: "description",
        content:
          "Track Python code quality over time: score trend, issue types by category and a table of every saved review.",
      },
      { property: "og:title", content: "Quality dashboard — PyReview" },
      {
        property: "og:description",
        content: "Score trend and issue-type breakdown across all your saved Python reviews.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const CATEGORIES = [
  { key: "bugs", label: "Bugs", color: "var(--destructive)" },
  { key: "security", label: "Security", color: "var(--warning)" },
  { key: "performance", label: "Performance", color: "var(--primary)" },
  { key: "style", label: "Style", color: "var(--success)" },
  { key: "bestPractices", label: "Best practices", color: "var(--muted-foreground)" },
] as const;

type Row = {
  id: string;
  filename: string;
  score: number;
  created_at: string;
  report: unknown;
};

type CatKey = (typeof CATEGORIES)[number]["key"];
type ChartRow = { label: string; date: string; filename: string; score: number } & Record<
  CatKey,
  number
>;

function counts(report: unknown): Record<CatKey, number> {
  const s = (report as ReviewReport | null)?.static as
    | Record<string, unknown>
    | undefined;
  const out = {} as Record<CatKey, number>;
  for (const c of CATEGORIES) {
    const v = s?.[c.key];
    out[c.key] = Array.isArray(v) ? v.length : 0;
  }
  return out;
}

function Dashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard-reviews"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("id, filename, score, created_at, report")
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return data as Row[];
    },
  });

  const rows = data ?? [];
  const chartData: ChartRow[] = rows.map((r, i) => ({
    label: `#${i + 1}`,
    date: new Date(r.created_at).toLocaleDateString(),
    filename: r.filename,
    score: r.score,
    ...counts(r.report),
  }));

  const totals = CATEGORIES.map((c) => ({
    ...c,
    count: chartData.reduce((a, d) => a + (d[c.key] ?? 0), 0),
  }));
  const avg =
    rows.length > 0 ? Math.round(rows.reduce((a, r) => a + r.score, 0) / rows.length) : 0;
  const totalIssues = totals.reduce((a, t) => a + t.count, 0);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Quality dashboard</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Every saved review, its score over time and how issues break down by type.
      </p>

      {isLoading && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="mt-6 text-sm text-destructive">Could not load reviews.</p>}

      {!isLoading && !error && rows.length === 0 && (
        <p className="mt-6 text-sm text-muted-foreground">
          No reviews yet —{" "}
          <Link to="/" className="text-primary underline">
            run your first one
          </Link>
          .
        </p>
      )}

      {rows.length > 0 && (
        <div className="mt-6 space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Reviews saved" value={String(rows.length)} />
            <Stat label="Average score" value={String(avg)} />
            <Stat label="Issues found" value={String(totalIssues)} />
          </div>

          <Card className="p-6">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Score over time
            </h2>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ left: -20, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelFormatter={(_, p) => p?.[0]?.payload?.filename ?? ""}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Issues by type over time
            </h2>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ left: -20, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {CATEGORIES.map((c) => (
                    <Area
                      key={c.key}
                      type="monotone"
                      stackId="issues"
                      dataKey={c.key}
                      name={c.label}
                      stroke={c.color}
                      fill={c.color}
                      fillOpacity={0.25}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {totals.map((t) => (
                <div key={t.key} className="rounded-md border border-border p-3">
                  <div className="font-mono text-2xl font-bold">{t.count}</div>
                  <div className="text-xs text-muted-foreground">{t.label}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              All saved reviews
            </h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="py-2 pr-4">File</th>
                    <th className="py-2 pr-4">Date</th>
                    {CATEGORIES.map((c) => (
                      <th key={c.key} className="py-2 pr-4">
                        {c.label}
                      </th>
                    ))}
                    <th className="py-2">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {[...rows].reverse().map((r) => {
                    const c = counts(r.report);
                    return (
                      <tr key={r.id} className="border-t border-border">
                        <td className="py-2 pr-4">
                          <Link
                            to="/history/$id"
                            params={{ id: r.id }}
                            className="font-mono text-primary hover:underline"
                          >
                            {r.filename}
                          </Link>
                        </td>
                        <td className="py-2 pr-4 text-xs text-muted-foreground">
                          {new Date(r.created_at).toLocaleString()}
                        </td>
                        {CATEGORIES.map((cat) => (
                          <td key={cat.key} className="py-2 pr-4 font-mono">
                            {c[cat.key]}
                          </td>
                        ))}
                        <td className="py-2 font-mono font-bold text-primary">{r.score}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-3xl font-bold">{value}</div>
    </Card>
  );
}
