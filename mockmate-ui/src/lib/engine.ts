// One entry point for running and checking code. Picks the engine by language:
//  - JavaScript, TypeScript, Python: run for real in the browser (runner.ts).
//  - Everything else: the AI predicts the result on the server (api.ts).
import { aiCheck, estimateProgram } from './api';
import { engineFor, type ProblemSpec, type TestReport } from './practice';
import { runInBrowser, testInBrowser, type StatusCallback } from './runner';

export type { StatusCallback };

export interface ProgramResult {
    output: string;
    isError: boolean;
    source: 'executed' | 'estimated';
}

const NO_OUTPUT = 'The program finished without printing anything.';

// Interview "Run": run the file as a program and show what it prints.
export async function runProgram(language: string, code: string, onStatus?: StatusCallback): Promise<ProgramResult> {
    if (engineFor(language) === 'ai') {
        const r = await estimateProgram(language, code);
        return { output: r.output || NO_OUTPUT, isError: r.isError, source: 'estimated' };
    }
    const { printed, error } = await runInBrowser(language, code, onStatus);
    if (error) return { output: (printed ? `${printed}\n\n` : '') + error, isError: true, source: 'executed' };
    return { output: printed || NO_OUTPUT, isError: false, source: 'executed' };
}

// Practice "Run" (mode "example": the first test only) and "Check" (every test).
export function checkSolution(
    spec: ProblemSpec,
    code: string,
    language: string,
    mode: 'check' | 'example',
    onStatus?: StatusCallback,
): Promise<TestReport> {
    if (engineFor(language) === 'ai') return aiCheck(spec, code, language, mode);
    const tests = mode === 'example' ? spec.tests.slice(0, 1) : spec.tests;
    return testInBrowser(language, code, spec, tests, onStatus);
}
