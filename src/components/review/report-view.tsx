import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AiReview } from "@/lib/review.functions";
import type { Finding, StaticResult } from "@/lib/static-analysis";

/** Full report payload persisted to the database and rendered here. */
export interface ReviewReport {
  static: StaticResult;
  ai: AiReview;
  score: number;
}

const CATEGORIES: { key: keyof StaticResult; label: string }[] = [
  { key: "bugs", label: "Bugs" },
  { key: "security", label: "Security" },
  { key: "performance", label: "Performance" },
  { key: "style", label: "PEP 8 style" },
  { key: "bestPractices", label: "Best practices" },
];

function grade(score: number) {
  if (score >= 90) return { letter: "A", tone: "text-success" };
  if (score >= 75) return { letter: "B", tone: "text-success" };
  if (score >= 60) return { letter: "C", tone: "text-warning" };
  if (score >= 40) return { letter: "D", tone: "text-warning" };
  return { letter: "F", tone: "text-destructive" };
}

export function ScoreCard({ score }: { score: number }) {
  const g = grade(score);
  return (
    <Card className="flex flex-col items-center justify-center gap-1 p-6">
      <div className={`font-mono text-5xl font-bold ${g.tone}`}>{score}</div>
      <div className="text-xs uppercase tracking-widest text-muted-foreground">
        quality score · grade {g.letter}
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${score}%` }}
        />
      </div>
    </Card>
  );
}

function riskBadge(risk?: string) {
  if (risk === "high") return <Badge variant="destructive">high</Badge>;
  if (risk === "medium")
    return <Badge className="bg-warning text-warning-foreground">medium</Badge>;
  return <Badge variant="secondary">low</Badge>;
}

function FindingRow({ finding }: { finding: Finding }) {
  return (
    <li className="rounded-md border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-primary">line {finding.line}</span>
        {riskBadge(finding.risk)}
        <span className="font-mono text-[11px] text-muted-foreground">{finding.source}</span>
      </div>
      <p className="mt-2 text-sm font-medium">{finding.problem}</p>
      <p className="mt-1 text-sm text-muted-foreground">{finding.explanation}</p>
      <p className="mt-1 text-sm">
        <span className="text-success">fix → </span>
        {finding.fix}
      </p>
    </li>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="max-h-[520px] overflow-auto rounded-md border border-border bg-code-bg p-4 font-mono text-xs leading-relaxed">
      {code.split("\n").map((line, i) => (
        <div key={i} className="whitespace-pre">
          <span className="mr-4 select-none text-muted-foreground">
            {String(i + 1).padStart(3, " ")}
          </span>
          {line}
        </div>
      ))}
    </pre>
  );
}

export function ReportView({ report, code }: { report: ReviewReport; code: string }) {
  const s = report.static;
  const counts = CATEGORIES.map((c) => ({
    ...c,
    count: (s[c.key] as Finding[]).length,
  }));
  const total = counts.reduce((a, b) => a + b.count, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-[220px_1fr]">
        <ScoreCard score={report.score} />
        <Card className="p-6">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Issue breakdown
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {counts.map((c) => (
              <div key={c.key} className="rounded-md border border-border p-3">
                <div className="font-mono text-2xl font-bold">{c.count}</div>
                <div className="text-xs text-muted-foreground">{c.label}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Metric label="Total issues" value={String(total)} />
            <Metric label="Avg complexity" value={`${s.complexity.averageComplexity} (${s.complexity.complexityLabel})`} />
            <Metric label="Maintainability" value={`${s.complexity.maintainabilityIndex} (${s.complexity.maintainabilityLabel})`} />
            <Metric
              label="Lines / funcs / classes"
              value={`${s.complexity.stats.lines} / ${s.complexity.stats.functions} / ${s.complexity.stats.classes}`}
            />
          </div>
        </Card>
      </div>

      <Tabs defaultValue="issues">
        <TabsList>
          <TabsTrigger value="issues">Issues</TabsTrigger>
          <TabsTrigger value="ai">AI review</TabsTrigger>
          <TabsTrigger value="compare">Original vs improved</TabsTrigger>
        </TabsList>

        <TabsContent value="issues" className="mt-4 space-y-6">
          {total === 0 && (
            <p className="text-sm text-muted-foreground">
              No static issues found. Nice, clean Python.
            </p>
          )}
          {CATEGORIES.map((c) => {
            const items = s[c.key] as Finding[];
            if (items.length === 0) return null;
            return (
              <section key={c.key}>
                <h3 className="mb-2 font-mono text-sm font-semibold text-primary">
                  {c.label} ({items.length})
                </h3>
                <ul className="space-y-2">
                  {items.map((f, i) => (
                    <FindingRow key={`${c.key}-${i}`} finding={f} />
                  ))}
                </ul>
              </section>
            );
          })}
        </TabsContent>

        <TabsContent value="ai" className="mt-4">
          <Card className="space-y-3 p-6">
            {!report.ai.available ? (
              <p className="text-sm text-muted-foreground">
                {report.ai.message ?? "AI review was not available for this run."}
              </p>
            ) : (
              <>
                {report.ai.aiScore !== null && (
                  <p className="font-mono text-sm text-primary">
                    AI score: {report.ai.aiScore}/100
                  </p>
                )}
                <p className="text-sm leading-relaxed">{report.ai.summary}</p>
                {report.ai.notes.length > 0 && (
                  <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {report.ai.notes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="compare" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 font-mono text-sm text-muted-foreground">Original</h3>
              <CodeBlock code={code} />
            </div>
            <div>
              <h3 className="mb-2 font-mono text-sm text-muted-foreground">Improved (AI)</h3>
              {report.ai.improvedCode ? (
                <CodeBlock code={report.ai.improvedCode} />
              ) : (
                <p className="rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
                  No improved version was generated for this review.
                </p>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-secondary p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-mono text-sm font-semibold">{value}</div>
    </div>
  );
}
