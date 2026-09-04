/**
 * Static analysis for Python source code.
 *
 * This is the browser/server-safe equivalent of the Flask project's
 * ast / pylint / flake8 / bandit / radon modules: each `check*` function plays
 * the role of one tool, and `runStaticAnalysis` merges their findings.
 * Code is only ever *read* — it is never executed.
 */

export type Severity = "low" | "medium" | "high";

export interface Finding {
  line: number;
  problem: string;
  explanation: string;
  fix: string;
  source: string;
  risk?: Severity;
}

export interface Complexity {
  averageComplexity: number;
  complexityLabel: "Low" | "Medium" | "High";
  maintainabilityIndex: number;
  maintainabilityLabel: "Excellent" | "Good" | "Fair" | "Poor";
  functions: { name: string; line: number; complexity: number }[];
  stats: { lines: number; functions: number; classes: number; comments: number };
}

export interface StaticResult {
  validSyntax: boolean;
  bugs: Finding[];
  security: Finding[];
  style: Finding[];
  performance: Finding[];
  bestPractices: Finding[];
  complexity: Complexity;
}

const MAX_LINE_LENGTH = 100;
const MAX_FUNCTION_LINES = 50;
const MAX_INDENT_LEVELS = 4;

interface Line {
  n: number;
  raw: string;
  text: string; // code with strings/comments blanked out
  indent: number;
  blank: boolean;
}

/** Blank out string literals and comments so patterns don't match inside them. */
function stripLiterals(raw: string): string {
  let out = "";
  let quote: string | null = null;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (quote) {
      out += ch === quote ? ch : " ";
      if (ch === quote && raw[i - 1] !== "\\") quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      out += ch;
      continue;
    }
    if (ch === "#") return out + " ".repeat(raw.length - i);
    out += ch;
  }
  return out;
}

function toLines(code: string): Line[] {
  return code.split("\n").map((raw, i) => ({
    n: i + 1,
    raw,
    text: stripLiterals(raw),
    indent: raw.length - raw.trimStart().length,
    blank: raw.trim() === "",
  }));
}

function finding(
  line: number,
  problem: string,
  explanation: string,
  fix: string,
  source: string,
  risk?: Severity,
): Finding {
  return { line, problem, explanation, fix, source, ...(risk ? { risk } : {}) };
}

/** Cheap syntax sanity check (unbalanced brackets, missing colons). */
function checkSyntax(lines: Line[]): Finding[] {
  const out: Finding[] = [];
  const stack: { ch: string; line: number }[] = [];
  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };

  for (const l of lines) {
    for (const ch of l.text) {
      if ("([{".includes(ch)) stack.push({ ch, line: l.n });
      else if (")]}".includes(ch)) {
        const top = stack.pop();
        if (!top || top.ch !== pairs[ch]) {
          out.push(
            finding(
              l.n,
              `Unbalanced bracket '${ch}'`,
              "A closing bracket does not match any opening bracket.",
              "Check the brackets on this line and the lines above it.",
              "syntax",
            ),
          );
        }
      }
    }
    const t = l.text.trim();
    if (/^(def |class |if |elif |else|for |while |try|except|finally|with )/.test(t) && !t.endsWith(":") && !t.endsWith("\\") && !t.includes("#")) {
      if (!/[([{]\s*$/.test(t)) {
        out.push(
          finding(l.n, "Missing ':' at end of block statement", "Python block statements must end with a colon.", "Add ':' at the end of the line.", "syntax"),
        );
      }
    }
  }
  if (stack.length) {
    const top = stack[stack.length - 1]!;
    out.push(finding(top.line, `Unclosed '${top.ch}'`, "This bracket is never closed.", "Close the bracket.", "syntax"));
  }
  return out;
}

/** AST-style structural checks: dangerous calls, bare except, long functions, nesting. */
function checkStructure(lines: Line[]): { bugs: Finding[]; best: Finding[] } {
  const bugs: Finding[] = [];
  const best: Finding[] = [];
  const functions: { name: string; line: number; indent: number }[] = [];

  lines.forEach((l) => {
    const t = l.text.trim();

    const def = t.match(/^def\s+([A-Za-z_]\w*)\s*\(/);
    if (def) functions.push({ name: def[1]!, line: l.n, indent: l.indent });

    if (/^except\s*:/.test(t)) {
      bugs.push(
        finding(l.n, "Bare 'except:' clause", "It swallows every error, including KeyboardInterrupt, and hides real bugs.", "Catch a specific exception, e.g. 'except ValueError:'.", "ast"),
      );
    }
    if (/\bassert\s/.test(t)) {
      best.push(finding(l.n, "assert used for validation", "Assertions are removed when Python runs with -O.", "Raise a real exception instead.", "ast"));
    }
    if (/==\s*(None|True|False)\b/.test(t)) {
      bugs.push(finding(l.n, "Comparison with '==' to None/True/False", "Identity comparison is the correct form.", "Use 'is None' / 'is True' / 'if value:'.", "ast"));
    }
    if (/def\s+\w+\s*\([^)]*=\s*(\[\]|\{\}|set\(\))/.test(t)) {
      bugs.push(finding(l.n, "Mutable default argument", "The default list/dict is shared between every call.", "Use None as the default and create the value inside the function.", "ast"));
    }
    if (l.indent >= MAX_INDENT_LEVELS * 4 && t !== "") {
      best.push(finding(l.n, "Excessively nested block", `Nesting deeper than ${MAX_INDENT_LEVELS} levels is hard to follow.`, "Use early returns or extract a helper function.", "ast"));
    }
  });

  // Long functions: measure until the indentation returns to the def level.
  functions.forEach((fn, idx) => {
    const next = functions[idx + 1];
    const end = next ? next.line - 1 : lines.length;
    if (end - fn.line > MAX_FUNCTION_LINES) {
      best.push(
        finding(fn.line, `Function '${fn.name}' is ${end - fn.line} lines long`, "Long functions are hard to read and test.", "Split it into smaller helper functions.", "ast"),
      );
    }
  });

  // Missing docstrings for public functions.
  functions.forEach((fn) => {
    const next = lines[fn.line]; // line right after the def
    if (next && !/^\s*("""|''')/.test(next.raw) && !fn.name.startsWith("_")) {
      best.push(finding(fn.line, `Function '${fn.name}' has no docstring`, "Docstrings explain what a function does.", "Add a short \"\"\"one-line docstring\"\"\".", "ast"));
    }
  });

  return { bugs, best };
}

/** Bandit-style security checks. */
function checkSecurity(lines: Line[]): Finding[] {
  const rules: { re: RegExp; problem: string; explanation: string; fix: string; risk: Severity }[] = [
    { re: /\beval\s*\(/, problem: "Use of eval()", explanation: "eval executes arbitrary code, so any untrusted input becomes remote code execution.", fix: "Use ast.literal_eval() or explicit parsing.", risk: "high" },
    { re: /\bexec\s*\(/, problem: "Use of exec()", explanation: "exec runs arbitrary Python from a string.", fix: "Restructure the code so dynamic execution is not needed.", risk: "high" },
    { re: /\bos\.system\s*\(/, problem: "os.system() shell call", explanation: "Shell commands built from variables allow command injection.", fix: "Use subprocess.run([...]) with a list of arguments.", risk: "high" },
    { re: /subprocess\.[a-z]+\([^)]*shell\s*=\s*True/, problem: "subprocess with shell=True", explanation: "shell=True lets injected characters run extra commands.", fix: "Pass an argument list and drop shell=True.", risk: "high" },
    { re: /\bpickle\.loads?\s*\(/, problem: "Unsafe pickle deserialization", explanation: "Unpickling untrusted data can execute arbitrary code.", fix: "Use json for untrusted data.", risk: "high" },
    { re: /\byaml\.load\s*\(/, problem: "yaml.load() without SafeLoader", explanation: "The default loader can instantiate arbitrary Python objects.", fix: "Use yaml.safe_load().", risk: "medium" },
    { re: /(password|secret|api_key|token)\s*=\s*["'][^"']{4,}["']/i, problem: "Hardcoded credential", explanation: "Secrets in source code leak through version control.", fix: "Read it from an environment variable via os.getenv().", risk: "high" },
    { re: /verify\s*=\s*False/, problem: "TLS verification disabled", explanation: "Disabling certificate checks enables man-in-the-middle attacks.", fix: "Leave verify at its default of True.", risk: "medium" },
    { re: /(execute|cursor\.execute)\s*\(\s*[f"']*.*(%s*|\+|\.format\(|f")/, problem: "Possible SQL injection", explanation: "Building SQL by string concatenation lets input change the query.", fix: "Use parameterised queries: cursor.execute(sql, (value,)).", risk: "high" },
    { re: /\bhashlib\.(md5|sha1)\s*\(/, problem: "Weak hash algorithm", explanation: "MD5 and SHA1 are broken for security purposes.", fix: "Use sha256, or bcrypt/argon2 for passwords.", risk: "medium" },
    { re: /\brandom\.(random|randint|choice)\s*\(/, problem: "Insecure random for possible secret", explanation: "random is predictable and unsuitable for tokens.", fix: "Use the secrets module when generating tokens.", risk: "low" },
    { re: /debug\s*=\s*True/i, problem: "Debug mode enabled", explanation: "Debug mode exposes stack traces and an interactive console.", fix: "Turn debug off in production.", risk: "medium" },
    { re: /input\s*\(\s*\)\s*$/, problem: "Unvalidated input()", explanation: "Raw user input used without validation.", fix: "Validate and convert the value before using it.", risk: "low" },
  ];

  const out: Finding[] = [];
  for (const l of lines) {
    for (const r of rules) {
      if (r.re.test(l.text)) out.push(finding(l.n, r.problem, r.explanation, r.fix, "security", r.risk));
    }
  }
  return out;
}

/** Flake8-style PEP 8 checks. */
function checkStyle(lines: Line[], code: string): Finding[] {
  const out: Finding[] = [];
  let blankRun = 0;

  lines.forEach((l) => {
    if (l.raw.length > MAX_LINE_LENGTH) {
      out.push(finding(l.n, `E501 line too long (${l.raw.length} > ${MAX_LINE_LENGTH})`, "Long lines are hard to read.", "Wrap the line or extract a variable.", "flake8"));
    }
    if (/\s+$/.test(l.raw) && !l.blank) {
      out.push(finding(l.n, "W291 trailing whitespace", "Trailing spaces create noisy diffs.", "Remove the spaces at the end of the line.", "flake8"));
    }
    if (l.raw.includes("\t")) {
      out.push(finding(l.n, "W191 indentation contains tabs", "PEP 8 requires spaces.", "Use 4 spaces per indent level.", "flake8"));
    }
    if (/,[^\s)\]}]/.test(l.text)) {
      out.push(finding(l.n, "E231 missing whitespace after ','", "PEP 8 asks for a space after a comma.", "Add a space after the comma.", "flake8"));
    }
    if (/[^\s=!<>+\-*/%]=[^\s=]/.test(l.text) && !/[=!<>+\-*/%]=/.test(l.text) && /^\s*\w+\s*=/.test(l.text) === false) {
      // keep noise low: only flag obvious operator spacing in assignments
    }
    if (/^\s*(def|class)\s/.test(l.text)) {
      const name = l.text.trim().split(/\s+/)[1]?.split(/[(:]/)[0] ?? "";
      const isClass = l.text.trim().startsWith("class");
      if (isClass && name && !/^[A-Z][A-Za-z0-9]*$/.test(name)) {
        out.push(finding(l.n, `N801 class '${name}' should use CapWords`, "PEP 8 naming convention for classes.", `Rename it to ${name.charAt(0).toUpperCase() + name.slice(1)}.`, "flake8"));
      }
      if (!isClass && name && !/^[a-z_][a-z0-9_]*$/.test(name)) {
        out.push(finding(l.n, `N802 function '${name}' should be lowercase_with_underscores`, "PEP 8 naming convention for functions.", "Rename the function using snake_case.", "flake8"));
      }
    }
    if (/^\s*(from|import)\s/.test(l.text) && l.n > 1 && lines.slice(0, l.n - 1).some((p) => !p.blank && !/^\s*(from|import|#|"""|''')/.test(p.raw))) {
      out.push(finding(l.n, "E402 module level import not at top of file", "Imports belong at the top of the module.", "Move this import to the top.", "flake8"));
    }
    if (/;\s*\S/.test(l.text)) {
      out.push(finding(l.n, "E702 multiple statements on one line", "One statement per line is easier to read.", "Split the statements onto separate lines.", "flake8"));
    }
    blankRun = l.blank ? blankRun + 1 : 0;
    if (blankRun === 3) {
      out.push(finding(l.n, "E303 too many blank lines", "More than two blank lines in a row.", "Keep at most two blank lines.", "flake8"));
    }
  });

  // Unused imports (pylint-style but reported as style noise).
  const imported: { name: string; line: number }[] = [];
  lines.forEach((l) => {
    const m1 = l.text.match(/^\s*import\s+([A-Za-z_][\w.]*)/);
    const m2 = l.text.match(/^\s*from\s+[\w.]+\s+import\s+(.+)$/);
    if (m1) imported.push({ name: m1[1]!.split(".")[0]!, line: l.n });
    if (m2) {
      m2[1]!
        .split(",")
        .map((s) => s.trim().split(/\s+as\s+/).pop()!.trim())
        .filter((s) => s && s !== "*")
        .forEach((name) => imported.push({ name, line: l.n }));
    }
  });
  imported.forEach((imp) => {
    const uses = code.split(new RegExp(`\\b${imp.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`)).length - 1;
    if (uses <= 1) {
      out.push(finding(imp.line, `F401 '${imp.name}' imported but unused`, "Unused imports slow startup and confuse readers.", `Remove the import of '${imp.name}'.`, "flake8"));
    }
  });

  if (code.length && !code.endsWith("\n")) {
    out.push(finding(lines.length, "W292 no newline at end of file", "Files should end with a newline.", "Add a final newline.", "flake8"));
  }
  return out;
}

/** Simple performance heuristics. */
function checkPerformance(lines: Line[]): Finding[] {
  const out: Finding[] = [];
  lines.forEach((l) => {
    const t = l.text;
    if (/for\s+\w+\s+in\s+range\s*\(\s*len\s*\(/.test(t)) {
      out.push(finding(l.n, "Looping with range(len(...))", "It creates index bookkeeping Python does not need.", "Iterate directly, or use enumerate() when you need the index.", "performance"));
    }
    if (/\+=\s*["']/.test(t)) {
      out.push(finding(l.n, "String concatenation in a loop", "Each += builds a whole new string, which is O(n^2).", "Collect the parts in a list and use ''.join(parts).", "performance"));
    }
    if (/\bin\s+\[.*,.*\]/.test(t)) {
      out.push(finding(l.n, "Membership test against a list literal", "List lookup is O(n); a set is O(1).", "Use a set literal: 'x in {a, b, c}'.", "performance"));
    }
    if (/\.append\(/.test(t) && /for\s/.test(t) === false && l.indent >= 8) {
      // low-signal, skipped intentionally
    }
    if (/\bglobal\s+\w+/.test(t)) {
      out.push(finding(l.n, "Use of a global variable", "Globals make code hard to reason about and to optimise.", "Pass the value as an argument or return it.", "performance"));
    }
    if (/time\.sleep\s*\(/.test(t)) {
      out.push(finding(l.n, "Blocking time.sleep()", "It blocks the whole thread while waiting.", "Use async/await or a scheduler if this runs in a server.", "performance"));
    }
  });
  return out;
}

/** Radon-style complexity and maintainability metrics. */
function measureComplexity(lines: Line[]): Complexity {
  const branchRe = /\b(if|elif|for|while|and|or|except|with|assert)\b|\bcomprehension\b/g;
  const functions: { name: string; line: number; complexity: number }[] = [];
  let current: { name: string; line: number; complexity: number } | null = null;
  let indentOfDef = 0;
  let classes = 0;
  let comments = 0;

  lines.forEach((l) => {
    if (/^\s*#/.test(l.raw)) comments++;
    if (/^\s*class\s/.test(l.text)) classes++;
    const def = l.text.trim().match(/^def\s+([A-Za-z_]\w*)/);
    if (def) {
      if (current) functions.push(current);
      current = { name: def[1]!, line: l.n, complexity: 1 };
      indentOfDef = l.indent;
      return;
    }
    if (current) {
      if (!l.blank && l.indent <= indentOfDef && !/^\s*(\)|@)/.test(l.raw)) {
        functions.push(current);
        current = null;
      } else {
        current.complexity += (l.text.match(branchRe) ?? []).length;
      }
    }
  });
  if (current) functions.push(current);

  const codeLines = lines.filter((l) => !l.blank && !/^\s*#/.test(l.raw)).length;
  const average = functions.length
    ? Math.round((functions.reduce((s, f) => s + f.complexity, 0) / functions.length) * 100) / 100
    : 1;

  const complexityLabel = average <= 5 ? "Low" : average <= 10 ? "Medium" : "High";

  // A simplified maintainability index in the 0-100 range.
  const commentRatio = codeLines ? comments / codeLines : 0;
  let mi = 100 - Math.min(40, average * 3) - Math.min(30, codeLines / 12) + Math.min(10, commentRatio * 40);
  mi = Math.max(0, Math.min(100, Math.round(mi * 10) / 10));
  const maintainabilityLabel = mi >= 85 ? "Excellent" : mi >= 65 ? "Good" : mi >= 40 ? "Fair" : "Poor";

  return {
    averageComplexity: average,
    complexityLabel,
    maintainabilityIndex: mi,
    maintainabilityLabel,
    functions,
    stats: { lines: lines.length, functions: functions.length, classes, comments },
  };
}

export function runStaticAnalysis(code: string): StaticResult {
  const lines = toLines(code);
  const syntax = checkSyntax(lines);
  const structure = checkStructure(lines);

  return {
    validSyntax: syntax.length === 0,
    bugs: [...syntax, ...structure.bugs],
    security: checkSecurity(lines),
    style: checkStyle(lines, code),
    performance: checkPerformance(lines),
    bestPractices: structure.best,
    complexity: measureComplexity(lines),
  };
}

/** Turn all findings into a single 0-100 score (see scoring.py in the Flask build). */
export function computeScore(
  result: { bugs: unknown[]; security: unknown[]; style: unknown[]; bestPractices: unknown[]; complexity: Complexity },
  aiScore?: number | null,
): number {
  let score = 100;
  score -= 6 * result.bugs.length;
  score -= 10 * result.security.length;
  score -= 1 * result.style.length;
  score -= 2 * result.bestPractices.length;
  if (result.complexity.complexityLabel === "High") score -= 10;
  else if (result.complexity.complexityLabel === "Medium") score -= 4;

  score = Math.max(0, Math.min(100, score));
  if (typeof aiScore === "number" && aiScore >= 0 && aiScore <= 100) {
    score = Math.round((score + aiScore) / 2);
  }
  return score;
}
