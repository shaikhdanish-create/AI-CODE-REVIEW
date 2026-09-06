import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/history/")({
  head: () => ({
    meta: [
      { title: "Review history — PyReview" },
      {
        name: "description",
        content: "Browse past Python code reviews with their quality scores and issue summaries.",
      },
      { property: "og:title", content: "Review history — PyReview" },
      {
        property: "og:description",
        content: "Every Python review you have run, with scores and summaries.",
      },
    ],
  }),
  component: History,
});

function History() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["reviews"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("id, filename, score, review_summary, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Review history</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The 50 most recent reviews, newest first.
      </p>

      <div className="mt-6 space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {error && <p className="text-sm text-destructive">Could not load history.</p>}
        {data?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No reviews yet —{" "}
            <Link to="/" className="text-primary underline">
              run your first one
            </Link>
            .
          </p>
        )}
        {data?.map((r) => (
          <Link key={r.id} to="/history/$id" params={{ id: r.id }}>
            <Card className="flex items-center justify-between gap-4 p-4 transition-colors hover:border-primary">
              <div className="min-w-0">
                <div className="truncate font-mono text-sm font-semibold">{r.filename}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()} · {r.review_summary || "—"}
                </div>
              </div>
              <div className="font-mono text-2xl font-bold text-primary">{r.score}</div>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}
