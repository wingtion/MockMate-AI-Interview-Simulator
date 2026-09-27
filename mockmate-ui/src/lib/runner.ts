/* eslint-disable @typescript-eslint/no-explicit-any */
// The "browser" engine: runs JavaScript, TypeScript and Python for real, in the
// user's own browser.
//  - JavaScript / TypeScript: a throwaway Web Worker per run (TypeScript types are
//    stripped with sucrase, loaded from jsDelivr on first use).
//  - Python: Pyodide (CPython compiled to WebAssembly) in a long-lived worker,
//    downloaded once (~10 MB) the first time Python is run.
// Workers have no access to the page, and a run that doesn't finish in time is
// killed by terminating its worker. Other languages go to the server (engine.ts).
import {
    answersMatch,
    functionNameFor,
    type ProblemSpec,
    type ProblemTest,
    type TestReport,
    type TestResult,
} from './practice';

const SUCRASE_URL = 'https://cdn.jsdelivr.net/npm/sucrase@3.35.0/+esm';
const PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js';
const JS_TIMEOUT_MS = 5000;
const PY_TIMEOUT_MS = 8000;
const PY_LOAD_TIMEOUT_MS = 60000;

export type StatusCallback = (status: string | null) => void;

interface Job {
    mode: 'run' | 'test';
    code: string;
    language: string;
    fnName?: string;
    tests?: { args: unknown[] }[];
}

interface RawResult {
    ok: boolean;
    value?: unknown;
    nothing?: boolean;
    error?: string;
    logs: string[];
}

interface Reply {
    logs: string[];
    error?: string;
    results?: RawResult[];
}

// ---------------------------------------------------------------------------
// Worker bodies. They are serialized with Function.prototype.toString, so they
// must be self-contained (no references to anything outside the function).
// ---------------------------------------------------------------------------

function jsWorkerMain(sucraseUrl: string) {
    const S: any = self;
    const fmt = (v: unknown) => {
        if (typeof v === 'string') return v;
        try {
            const s = JSON.stringify(v);
            return s === undefined ? String(v) : s;
        } catch {
            return String(v);
        }
    };
    let logs: string[] = [];
    const c: any = console;
    ['log', 'info', 'warn', 'error', 'debug'].forEach((k) => {
        c[k] = (...a: unknown[]) => { if (logs.length < 200) logs.push(a.map(fmt).join(' ')); };
    });
    const errText = (e: any) => (e && e.name ? `${e.name}: ${e.message}` : String(e));
    const load = new Function('u', 'return import(u)');

    S.onmessage = async (ev: MessageEvent) => {
        const { mode, code, language, fnName, tests } = ev.data;
        let src: string = code;
        if (language === 'typescript') {
            try {
                const sucrase = await load(sucraseUrl);
                src = sucrase.transform(code, { transforms: ['typescript'] }).code;
            } catch (e) {
                S.postMessage({ logs: [], error: 'TypeScript could not be compiled. ' + errText(e) });
                return;
            }
        }
        src = src.replace(/^\s*export\s+(default\s+)?/gm, '');

        if (mode === 'run') {
            logs = [];
            try {
                const AsyncFunction = Object.getPrototypeOf(async function () { /* empty */ }).constructor;
                await new AsyncFunction(src)();
                S.postMessage({ logs });
            } catch (e) {
                S.postMessage({ logs, error: errText(e) });
            }
            return;
        }

        let fn: any;
        logs = [];
        try {
            fn = new Function(`${src}\n;return typeof ${fnName} === 'function' ? ${fnName} : undefined;`)();
        } catch (e) {
            S.postMessage({ logs, error: errText(e) });
            return;
        }
        if (typeof fn !== 'function') {
            S.postMessage({ logs, error: `No function named ${fnName} was found. Keep the function name from the starter code.` });
            return;
        }
        const topLogs = logs;
        const results: any[] = [];
        for (const t of tests) {
            logs = [];
            try {
                let v = fn(...structuredClone(t.args));
                if (v && typeof v.then === 'function') v = await v;
                results.push(v === undefined
                    ? { ok: true, nothing: true, logs }
                    : { ok: true, value: JSON.parse(JSON.stringify(v)), logs });
            } catch (e) {
                results.push({ ok: false, error: errText(e), logs });
            }
        }
        S.postMessage({ logs: topLogs, results });
    };
}

function pyWorkerMain(pyodideUrl: string) {
    const S: any = self;
    const HARNESS = [
        'import json, sys, io',
        "__ns = {'__name__': '__solution__'}",
        "exec(compile(__code, '<solution>', 'exec'), __ns)",
        '__f = __ns.get(__fn)',
        'if not callable(__f):',
        "    raise NameError('No function named ' + __fn + ' was found. Keep the function name from the starter code.')",
        '__out = []',
        'for __t in json.loads(__tests):',
        '    __buf = io.StringIO()',
        '    __old = sys.stdout',
        '    sys.stdout = __buf',
        '    try:',
        "        __v = __f(*__t['args'])",
        "        __r = {'ok': True, 'logs': __buf.getvalue().splitlines()[:50]}",
        '        if __v is None:',
        "            __r['nothing'] = True",
        '        else:',
        "            __r['value'] = json.loads(json.dumps(__v, default=list))",
        '    except Exception as __e:',
        "        __r = {'ok': False, 'error': type(__e).__name__ + ': ' + str(__e), 'logs': __buf.getvalue().splitlines()[:50]}",
        '    finally:',
        '        sys.stdout = __old',
        '    __out.append(__r)',
        'json.dumps(__out)',
    ].join('\n');

    const pyErr = (e: any) => {
        const text = String((e && e.message) || e).trim();
        const lines = text.split('\n');
        const last = lines[lines.length - 1];
        const lineNo = [...text.matchAll(/File "<solution>", line (\d+)/g)].pop();
        return lineNo ? `${last} (line ${lineNo[1]})` : last;
    };

    let ready: Promise<any>;
    try {
        S.importScripts(pyodideUrl);
        ready = S.loadPyodide().then(
            (py: any) => { S.postMessage({ type: 'ready' }); return py; },
            (e: any) => { S.postMessage({ type: 'load-error', error: String(e) }); return null; },
        );
    } catch (e) {
        S.postMessage({ type: 'load-error', error: String(e) });
        ready = Promise.resolve(null);
    }

    S.onmessage = async (ev: MessageEvent) => {
        const py = await ready;
        if (!py) return;
        const { mode, code, fnName, tests } = ev.data;
        const logs: string[] = [];
        py.setStdout({ batched: (s: string) => { if (logs.length < 200) logs.push(s); } });
        py.setStderr({ batched: (s: string) => { if (logs.length < 200) logs.push(s); } });
        py.globals.set('__code', code);
        try {
            if (mode === 'run') {
                await py.runPythonAsync("exec(compile(__code, '<solution>', 'exec'), {'__name__': '__main__'})");
                S.postMessage({ type: 'done', logs });
            } else {
                py.globals.set('__fn', fnName);
                py.globals.set('__tests', JSON.stringify(tests));
                const out = await py.runPythonAsync(HARNESS);
                S.postMessage({ type: 'done', logs, results: JSON.parse(out) });
            }
        } catch (e) {
            S.postMessage({ type: 'done', logs, error: pyErr(e) });
        }
    };
}

const workerUrl = (main: (arg: string) => void, arg: string) =>
    URL.createObjectURL(new Blob([`(${main.toString()})(${JSON.stringify(arg)});`], { type: 'text/javascript' }));

// ---------------------------------------------------------------------------
// JavaScript / TypeScript: one fresh worker per job.
// ---------------------------------------------------------------------------
function runJs(job: Job): Promise<Reply> {
    return new Promise((resolve) => {
        const url = workerUrl(jsWorkerMain, SUCRASE_URL);
        const worker = new Worker(url);
        const done = (reply: Reply) => {
            clearTimeout(timer);
            worker.terminate();
            URL.revokeObjectURL(url);
            resolve(reply);
        };
        // TypeScript downloads the compiler on first use, so allow it a little longer.
        const limit = job.language === 'typescript' ? JS_TIMEOUT_MS + 5000 : JS_TIMEOUT_MS;
        const timer = setTimeout(
            () => done({ logs: [], error: `Stopped after ${limit / 1000} seconds. Check for an infinite loop or very slow code.` }),
            limit,
        );
        worker.onmessage = (ev) => done(ev.data);
        worker.onerror = (ev) => { ev.preventDefault(); done({ logs: [], error: ev.message || 'The code could not be run.' }); };
        worker.postMessage(job);
    });
}

// ---------------------------------------------------------------------------
// Python: one long-lived Pyodide worker, rebuilt after a timeout.
// ---------------------------------------------------------------------------
let py: { worker: Worker; url: string; ready: Promise<boolean>; isReady: boolean } | null = null;

function resetPython() {
    if (!py) return;
    py.worker.terminate();
    URL.revokeObjectURL(py.url);
    py = null;
}

function getPython() {
    if (py) return py;
    const url = workerUrl(pyWorkerMain, PYODIDE_URL);
    const worker = new Worker(url);
    const state = { worker, url, isReady: false, ready: Promise.resolve(false) };
    state.ready = new Promise<boolean>((resolve) => {
        const onMessage = (ev: MessageEvent) => {
            if (ev.data?.type === 'ready') { state.isReady = true; worker.removeEventListener('message', onMessage); resolve(true); }
            if (ev.data?.type === 'load-error') { worker.removeEventListener('message', onMessage); resolve(false); }
        };
        worker.addEventListener('message', onMessage);
        worker.addEventListener('error', () => resolve(false));
        setTimeout(() => resolve(false), PY_LOAD_TIMEOUT_MS);
    });
    py = state;
    return state;
}

async function runPython(job: Job, onStatus?: StatusCallback): Promise<Reply> {
    const instance = getPython();
    if (!instance.isReady) onStatus?.('Loading Python. The first run downloads about 10 MB…');
    const loaded = await instance.ready;
    onStatus?.(null);
    if (!loaded) {
        resetPython();
        return { logs: [], error: "Python couldn't be loaded. Check your internet connection and try again." };
    }
    return new Promise((resolve) => {
        const worker = instance.worker;
        const onMessage = (ev: MessageEvent) => {
            if (ev.data?.type !== 'done') return;
            clearTimeout(timer);
            worker.removeEventListener('message', onMessage);
            resolve(ev.data);
        };
        const timer = setTimeout(() => {
            worker.removeEventListener('message', onMessage);
            resetPython(); // the stuck interpreter is discarded; the next run reloads it
            resolve({ logs: [], error: `Stopped after ${PY_TIMEOUT_MS / 1000} seconds. Check for an infinite loop or very slow code.` });
        }, PY_TIMEOUT_MS);
        worker.addEventListener('message', onMessage);
        worker.postMessage(job);
    });
}

const execute = (job: Job, onStatus?: StatusCallback) =>
    job.language === 'python' ? runPython(job, onStatus) : runJs(job);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// Interview "Run": execute the file as a program and return what it printed.
export async function runInBrowser(language: string, code: string, onStatus?: StatusCallback) {
    const reply = await execute({ mode: 'run', code, language }, onStatus);
    return { printed: reply.logs.join('\n'), error: reply.error };
}

// Practice "Run" / "Check": call the candidate's function on each test and compare.
// `tests` is a subset of spec.tests (Run passes only the first one).
export async function testInBrowser(
    language: string,
    code: string,
    spec: ProblemSpec,
    tests: ProblemTest[],
    onStatus?: StatusCallback,
): Promise<TestReport> {
    const base = { language, engine: 'browser' as const, passed: 0, total: tests.length, results: [] };
    const reply = await execute(
        { mode: 'test', code, language, fnName: functionNameFor(spec, language), tests: tests.map((t) => ({ args: t.args })) },
        onStatus,
    );
    if (reply.error || !reply.results) {
        return { ...base, logs: reply.logs ?? [], error: reply.error || 'The tests could not be run.' };
    }
    const results: TestResult[] = tests.map((test, index) => {
        const raw = reply.results![index];
        if (!raw) return { index, args: test.args, expected: test.expected, passed: false, error: 'Not run.', logs: [] };
        const actual = raw.nothing ? undefined : raw.value;
        const passed = raw.ok && !raw.nothing && answersMatch(actual, test.expected, spec.orderMatters);
        return {
            index,
            args: test.args,
            expected: test.expected,
            passed,
            actual,
            returnedNothing: raw.ok && raw.nothing,
            error: raw.ok ? undefined : raw.error,
            logs: raw.logs ?? [],
        };
    });
    return { ...base, passed: results.filter((r) => r.passed).length, results, logs: reply.logs ?? [] };
}

export interface VerifiedSpec {
    spec: ProblemSpec;
    verified: boolean; // expected answers were confirmed by running the reference solution
    dropped: number;   // tests removed because the reference disagreed with them
}

// Run the hidden JavaScript reference solution on the AI-written tests and keep
// only the tests whose expected answer it reproduces. If the reference itself
// fails, the tests are kept as they are and marked unverified.
export async function verifySpec(spec: ProblemSpec): Promise<VerifiedSpec> {
    const reply = await runJs({
        mode: 'test',
        code: spec.referenceSolution,
        language: 'javascript',
        fnName: spec.functionName,
        tests: spec.tests.map((t) => ({ args: t.args })),
    });
    if (reply.error || !reply.results) return { spec, verified: false, dropped: 0 };
    const kept = spec.tests.filter((test, i) => {
        const raw = reply.results![i];
        return !!raw && raw.ok && !raw.nothing && answersMatch(raw.value, test.expected, spec.orderMatters);
    });
    if (kept.length < 2) return { spec, verified: false, dropped: 0 };
    return { spec: { ...spec, tests: kept }, verified: true, dropped: spec.tests.length - kept.length };
}
