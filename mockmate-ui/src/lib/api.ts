import { API_URL } from '../config';
import type { ProblemSpec, TestReport } from './practice';

// The API runs on a Fly machine that suspends when idle, so the first request
// after a quiet period can be slow or fail once. Messages say so plainly.
export const SERVER_UNREACHABLE =
    "Couldn't reach the MockMate server. It may be waking up; try again in a few seconds.";

const RATE_LIMITED = "You've run code a lot in the last few minutes. Wait a little and try again.";

async function postJson<T>(path: string, body: unknown): Promise<{ data?: T; error?: string }> {
    let res: Response;
    try {
        res = await fetch(`${API_URL}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
    } catch (e) {
        console.error(`POST ${path} failed`, e);
        return { error: SERVER_UNREACHABLE };
    }
    if (res.status === 429) return { error: RATE_LIMITED };
    if (!res.ok) return { error: 'The server had a problem with your code. Try again in a moment.' };
    try {
        return { data: (await res.json()) as T };
    } catch {
        return { error: 'The server sent an unreadable response. Try again.' };
    }
}

// ---- Interview "Run" for languages the browser can't run --------------------------
// The AI predicts what the program prints.

export async function estimateProgram(language: string, code: string): Promise<{ output: string; isError: boolean }> {
    const { data, error } = await postJson<{ output?: string; error?: string }>('/api/code/run', { language, code });
    if (error) return { output: error, isError: true };
    const output = (data?.output ?? '').trimEnd();
    if (data?.error) return { output: (output ? `${output}\n\n` : '') + data.error, isError: true };
    return { output, isError: false };
}

// ---- Practice "Run" / "Check" for Java, C#, C++, Go, Rust --------------------------
// The AI predicts each test's return value; the server compares it with the answer.

interface ServerOutcome {
    index: number;
    passed: boolean;
    actual?: string | null;       // JSON text
    returnedNothing?: boolean;
    error?: string | null;
    logs?: string[];
}

interface ServerCheckResult {
    results?: ServerOutcome[];
    logs?: string[];
    error?: string;
    compileError?: boolean;
}

export async function aiCheck(
    spec: ProblemSpec,
    code: string,
    language: string,
    mode: 'check' | 'example',
): Promise<TestReport> {
    const total = mode === 'example' ? 1 : spec.tests.length;
    const empty: TestReport = { language, engine: 'ai', passed: 0, total, results: [], logs: [] };

    const { data, error } = await postJson<ServerCheckResult>('/api/problem/check', { spec, code, language, mode });
    if (error) return { ...empty, error };
    if (!data || data.error) return { ...empty, error: data?.error || 'The AI could not check your code.' };

    const results = (data.results ?? []).map((o) => {
        let actual: unknown = undefined;
        if (o.actual != null) {
            try { actual = JSON.parse(o.actual); } catch { actual = o.actual; }
        }
        const test = spec.tests[o.index];
        return {
            index: o.index,
            args: test?.args ?? [],
            expected: test?.expected,
            passed: o.passed,
            actual,
            returnedNothing: !!o.returnedNothing,
            error: o.error ?? undefined,
            logs: o.logs ?? [],
        };
    });
    return { ...empty, passed: results.filter((r) => r.passed).length, results, logs: data.logs ?? [] };
}
