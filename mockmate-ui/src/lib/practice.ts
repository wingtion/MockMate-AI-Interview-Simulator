// Practice problem spec (from GET /api/problem/generate) and the shape of test
// reports. Two engines grade a solution:
//  - "browser": JavaScript, TypeScript and Python run for real in this browser.
//  - "ai": Java, C#, C++, Go and Rust. The AI predicts what the code returns for
//    each test (it never sees the expected answers) and the server compares.

export type Engine = 'browser' | 'ai';

export const BROWSER_LANGUAGES = ['javascript', 'typescript', 'python'];

export const engineFor = (language: string): Engine =>
    BROWSER_LANGUAGES.includes(language) ? 'browser' : 'ai';

export interface ProblemTest {
    args: unknown[];
    expected: unknown;
}

export interface ProblemSpec {
    title: string;
    functionName: string;
    params: string[];
    paramTypes: string[];   // int, double, string, bool, int[], ..., int[][], string[][]
    returnType: string;
    orderMatters: boolean;
    tests: ProblemTest[];
    referenceSolution: string;         // JavaScript; run once in the browser to confirm expected answers
    starters: Record<string, string>;  // language id -> starter code with the typed signature
}

export interface TestResult {
    index: number;
    args: unknown[];
    expected: unknown;
    passed: boolean;
    actual?: unknown;
    returnedNothing?: boolean; // undefined in JS, None in Python
    error?: string;
    logs: string[];
}

export interface TestReport {
    language: string;
    engine: Engine;
    passed: number;
    total: number;
    results: TestResult[];
    logs: string[];          // printed by top-level code, before the first test
    error?: string;          // compile error, timeout, network: the whole run failed
}

// Python names follow snake_case (the server's starters do the same).
const snake = (name: string) =>
    name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/([A-Z])([A-Z][a-z])/g, '$1_$2').toLowerCase();

export const functionNameFor = (spec: ProblemSpec, language: string) =>
    language === 'python' ? snake(spec.functionName) : spec.functionName;

// Call as shown in test rows: the same JSON notation for every language.
export const callLabel = (spec: ProblemSpec, args: unknown[]) =>
    `${spec.functionName}(${args.map((a) => JSON.stringify(a)).join(', ')})`;

export const literal = (value: unknown) => JSON.stringify(value);

export function starterFor(spec: ProblemSpec | null, language: string): string {
    if (spec?.starters?.[language]) return spec.starters[language];
    const c = language === 'python' ? '#' : '//';
    return `${c} Pick a topic and difficulty, press Generate, then solve it here…\n`;
}

// Deep equality on JSON values. Mirrors AnswerComparer on the server so both
// engines grade alike: numbers within 1e-6, top-level arrays unordered when
// order doesn't matter, and null accepted for an expected empty array.
function canonical(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.keys(value as object).sort().map((k) => [k, canonical((value as Record<string, unknown>)[k])]));
    }
    if (typeof value === 'number') return Math.round(value * 1e6) / 1e6;
    return value;
}

export function answersMatch(actual: unknown, expected: unknown, orderMatters: boolean): boolean {
    if (actual === null && Array.isArray(expected) && expected.length === 0) return true;
    let a = canonical(actual);
    let e = canonical(expected);
    if (!orderMatters && Array.isArray(a) && Array.isArray(e)) {
        a = a.map((x) => JSON.stringify(x)).sort();
        e = e.map((x) => JSON.stringify(x)).sort();
    }
    return JSON.stringify(a) === JSON.stringify(e);
}

export const newProblemId = () =>
    (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
