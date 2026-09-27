import { useId } from 'react';
import { CaretDown, CaretRight, CheckCircle, Terminal, XCircle } from '@phosphor-icons/react';
import { callLabel, literal, type Engine, type ProblemSpec, type TestReport } from '../lib/practice';

export type ConsoleView = 'output' | 'tests';

export interface TestsPanel {
    spec: ProblemSpec | null;
    report: TestReport | null;
    running: boolean;
    engine: Engine;  // engine for the selected language
}

const scoreClass = (passed: number, total: number) =>
    passed === total ? 'good' : passed / Math.max(total, 1) >= 0.5 ? 'mid' : 'bad';

function TestsBody({ panel, status }: { panel: TestsPanel; status?: string | null }) {
    const { spec, report, running, engine } = panel;
    if (running) {
        const n = spec?.tests.length ?? '';
        return (
            <p className="console-message">
                {status ?? (engine === 'browser' ? `Running ${n} tests in your browser…` : `The AI is checking your code against ${n} tests…`)}
            </p>
        );
    }
    if (!spec) {
        return <p className="console-message">Generate a problem, then press Check to run your solution against its tests.</p>;
    }
    if (!report) {
        return <p className="console-message">Press Check to run your solution against {spec.tests.length} tests.</p>;
    }
    if (report.error) {
        return (
            <div className="console-message">
                <pre className="console-error console-pre">{report.error}</pre>
                <p>Fix the problem above and press Check again. The tests call your function directly, so keep the name and signature from the starter code.</p>
            </div>
        );
    }
    return (
        <div className="tests">
            <p className={`tests-summary ${scoreClass(report.passed, report.total)}`}>
                {report.passed === report.total
                    ? `All ${report.total} tests passed`
                    : `${report.passed} of ${report.total} tests passed`}
            </p>
            {report.logs.length > 0 && <pre className="test-logs">{report.logs.slice(0, 10).join('\n')}</pre>}
            <ol className="test-list">
                {report.results.map((r) => (
                    <li key={r.index} className={`test-row ${r.passed ? 'pass' : 'fail'}`}>
                        {r.passed
                            ? <CheckCircle className="test-icon" size={18} weight="fill" aria-label="Passed" />
                            : <XCircle className="test-icon" size={18} weight="fill" aria-label="Failed" />}
                        <div className="test-body">
                            <code className="test-call">{callLabel(spec, r.args)}</code>
                            {!r.passed && (
                                <dl className="test-detail">
                                    <dt>Expected</dt>
                                    <dd><code>{literal(r.expected)}</code></dd>
                                    <dt>Got</dt>
                                    <dd>
                                        {r.error
                                            ? <span className="console-error">{r.error}</span>
                                            : r.returnedNothing
                                                ? <span className="console-error">nothing (is a <code>return</code> missing?)</span>
                                                : <code>{literal(r.actual)}</code>}
                                    </dd>
                                </dl>
                            )}
                            {r.logs.length > 0 && <pre className="test-logs">{r.logs.slice(0, 5).join('\n')}</pre>}
                        </div>
                    </li>
                ))}
            </ol>
        </div>
    );
}

// One line per engine, shown in the console header.
const NOTES = {
    executed: 'Ran in your browser.',
    estimated: "Predicted by AI. The code isn't run, so tricky code can be misjudged.",
    checked: "Checked by AI. The code isn't run, so tricky code can be misjudged.",
};

// Collapsible panel under the editor. "Output" shows what the program printed:
// run in the browser (JavaScript, TypeScript, Python) or predicted by the AI (the
// rest). Pages that pass `tests` also get a "Tests" view.
export default function OutputConsole({
    open,
    onToggle,
    output,
    isError,
    isRunning,
    source,
    status,
    tests,
    view = 'output',
    onViewChange,
}: {
    open: boolean;
    onToggle: () => void;
    output: string;
    isError: boolean;
    isRunning: boolean;
    source: 'executed' | 'estimated';
    status?: string | null; // e.g. "Loading Python…" while a run waits
    tests?: TestsPanel;
    view?: ConsoleView;
    onViewChange?: (view: ConsoleView) => void;
}) {
    const bodyId = useId();
    const showingTests = !!tests && view === 'tests';
    const shown = showingTests ? (tests!.engine === 'browser' ? 'executed' : 'estimated') : source;
    const tag = shown === 'executed' ? 'Executed' : showingTests ? 'AI-checked' : 'AI-estimated';

    const report = tests?.report;

    return (
        <div className={`console ${open ? '' : 'collapsed'}`}>
            <div className="console-head">
                {tests ? (
                    <div className="console-tabs" role="tablist" aria-label="Console">
                        <button
                            type="button"
                            role="tab"
                            aria-selected={!showingTests}
                            aria-controls={bodyId}
                            className="console-tab"
                            onClick={() => { onViewChange?.('output'); if (!open) onToggle(); }}
                        >
                            <Terminal size={16} aria-hidden="true" /> Output
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={showingTests}
                            aria-controls={bodyId}
                            className="console-tab"
                            onClick={() => { onViewChange?.('tests'); if (!open) onToggle(); }}
                        >
                            Tests
                            {report && !report.error && (
                                <span className={`console-count ${scoreClass(report.passed, report.total)}`}>
                                    {report.passed}/{report.total}
                                </span>
                            )}
                        </button>
                    </div>
                ) : (
                    <span className="console-title">
                        <Terminal size={16} aria-hidden="true" /> Output
                    </span>
                )}
                <span className={`tag ${shown === 'estimated' ? 'soft' : ''}`}>{tag}</span>
                <span className="console-note">{NOTES[shown === 'estimated' && showingTests ? 'checked' : shown]}</span>
                <button
                    type="button"
                    className="console-toggle"
                    onClick={onToggle}
                    aria-expanded={open}
                    aria-controls={bodyId}
                    aria-label={open ? 'Collapse console' : 'Expand console'}
                >
                    {open ? <CaretDown size={14} aria-hidden="true" /> : <CaretRight size={14} aria-hidden="true" />}
                </button>
            </div>
            {open && (
                showingTests ? (
                    <div id={bodyId} className="console-body tests-body" aria-live="polite" aria-busy={tests!.running}>
                        <TestsBody panel={tests!} status={status} />
                    </div>
                ) : (
                    <pre
                        id={bodyId}
                        className={`console-body ${isError ? 'error' : ''}`}
                        aria-live="polite"
                        aria-busy={isRunning}
                    >
                        {isRunning
                            ? (status ?? (source === 'executed' ? 'Running…' : 'The AI is predicting the output…'))
                            : (output || 'Run your code to see its output.')}
                    </pre>
                )
            )}
        </div>
    );
}
