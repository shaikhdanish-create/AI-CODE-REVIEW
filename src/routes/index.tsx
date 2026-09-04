import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { ReportView, type ReviewReport } from "@/components/review/report-view";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { aiReviewCode } from "@/lib/review.functions";
import { computeScore, runStaticAnalysis } from "@/lib/static-analysis";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PyReview — Analyze Python code for bugs, security & style" },
      {
        name: "description",
        content:
          "Paste or upload a Python file and get static analysis, an AI review, an improved version and a 0-100 quality score.",
      },
      { property: "og:title", content: "PyReview — AI Python Code Review" },
      {
        property: "og:description",
        content:
          "Paste or upload Python code for bug, security, performance and PEP 8 analysis with an AI-powered review.",
      },
    ],
  }),
  component: Analyzer,
});

const SAMPLE = `import os

PASSWORD = "hunter2"

def process(items):
    result = []
    for i in range(len(items)):
        try:
            if items[i] != None:
                if items[i] > 0:
                    if items[i] % 2 == 0:
                        result.append(eval(str(items[i])))
        except:
            pass
    return result
`;

function Analyzer() {
  const [code, setCode] = useState("");
  const [filename, setFilename] = useState("pasted_code.py");
  const [report, setReport] = useState<ReviewReport | null>(null);
  const [analyzedCode, setAnalyzedCode] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const runAiReview = useServerFn(aiReviewCode);

  async function handleFile(file: File) {
    const text = await file.text();
    setCode(text);
    setFilename(file.name);
    toast.success(`Loaded ${file.name}`);
  }

  async function analyze() {
    if (!code.trim()) {
      toast.error("Paste some Python code first.");
      return;
    }
    setBusy(true);
    setReport(null);
    try {
      // 1. Static analysis (bugs, security, performance, style, complexity).
      const staticResult = runStaticAnalysis(code);

      // 2. AI review runs on the server so the API key never reaches the browser.
      const ai = await runAiReview({ data: { code, filename } });
      if (!ai.available && ai.message) toast.warning(ai.message);

      const score = computeScore(staticResult, ai.aiScore);
      const full: ReviewReport = { static: staticResult, ai, score };
      setReport(full);
      setAnalyzedCode(code);

      // 3. Persist to review history (only for signed-in owners of the review).
      if (!user) {
        toast.info("Sign in to save this review to your private history.");
      } else {
        const { error } = await supabase.from("reviews").insert({
          user_id: user.id,
          filename,
          code,
          score,
          review_summary: ai.summary || "Static analysis only.",
          report: full as unknown as Json,
        });
        if (error) toast.error("Review ran, but saving to history failed.");
      }
    } catch (error) {
      toast.error((error as Error).message || "Analysis failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <section className="mb-8">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary">
          static analysis + ai review
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Review Python code for bugs, security and style
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Paste a snippet or upload a <code className="font-mono text-primary">.py</code> file. Your
          code is scanned for bugs, security risks, performance traps, PEP 8 violations and
          complexity, then reviewed by AI and scored out of 100.
        </p>
      </section>

      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-secondary/50 px-4 py-2">
          <span className="font-mono text-xs text-muted-foreground">{filename}</span>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".py,.txt"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
            <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
              Upload .py
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setCode(SAMPLE);
                setFilename("sample_bad.py");
              }}
            >
              Load sample
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setCode("");
                setReport(null);
              }}
            >
              Clear
            </Button>
          </div>
        </div>
        <Textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck={false}
          placeholder="# paste your Python code here"
          className="min-h-[320px] resize-y rounded-none border-0 bg-code-bg font-mono text-sm focus-visible:ring-0"
        />
      </Card>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={() => void analyze()} disabled={busy}>
          {busy ? "Analyzing…" : "Run review"}
        </Button>
        <Button variant="outline" onClick={() => void navigate({ to: "/history" })}>
          View history
        </Button>
      </div>

      {report && (
        <div className="mt-10">
          <ReportView report={report} code={analyzedCode} />
        </div>
      )}
    </main>
  );
}
