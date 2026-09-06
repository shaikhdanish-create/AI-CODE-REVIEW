import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { ReportView, type ReviewReport } from "@/components/review/report-view";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/history/$id")({
  head: () => ({
    meta: [
      { title: "Review detail — PyReview" },
      {
        name: "description",
        content: "Full static analysis and AI review report for a saved Python code review.",
      },
      { property: "og:title", content: "Review detail — PyReview" },
      {
        property: "og:description",
        content: "Issue breakdown, AI notes and improved code for a saved Python review.",
      },
    ],
  }),
  component: ReviewDetail,
});

function ReviewDetail() {
  const { id } = Route.useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["review", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("id, filename, code, score, report, created_at")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <Link to="/history" className="font-mono text-xs text-primary hover:underline">
        ← back to history
      </Link>
      {isLoading && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}
      {(error || (!isLoading && !data)) && (
        <p className="mt-6 text-sm text-destructive">This review could not be found.</p>
      )}
      {data && (
        <>
          <h1 className="mt-3 font-mono text-2xl font-bold">{data.filename}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {new Date(data.created_at).toLocaleString()}
          </p>
          <div className="mt-6">
            <ReportView
              report={data.report as unknown as ReviewReport}
              code={data.code}
            />
          </div>
        </>
      )}
    </main>
  );
}
