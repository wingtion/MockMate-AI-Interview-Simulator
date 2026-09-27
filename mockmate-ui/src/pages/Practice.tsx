/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import {
    ArrowCounterClockwise,
    ArrowLeft,
    Copy,
    ListChecks,
    Play,
    PuzzlePiece,
    ShieldCheck,
    Shuffle,
    WarningCircle,
} from '@phosphor-icons/react';
import OutputConsole, { type ConsoleView } from '../components/OutputConsole';
import { useToast } from '../components/Toast';
import { defineMockmateTheme, EDITOR_OPTIONS } from '../lib/editorTheme';
import { SERVER_UNREACHABLE } from '../lib/api';
import { checkSolution } from '../lib/engine';
import { verifySpec } from '../lib/runner';
import {
    BROWSER_LANGUAGES,
    callLabel,
    engineFor,
    literal,
    newProblemId,
    starterFor,
    type ProblemSpec,
    type TestReport,
} from '../lib/practice';
import { savePracticeResult } from '../lib/history';
import { LANGUAGES } from '../lib/modes';
import { API_URL } from '../config';
import '../App.css';

const TOPICS: { id: string; label: string }[] = [
    { id: 'Arrays', label: 'Arrays' },
    { id: 'Strings', label: 'Strings' },
    { id: 'LinkedLists', label: 'Linked Lists' },
    { id: 'Trees', label: 'Trees' },
    { id: 'Graphs', label: 'Graphs' },
    { id: 'DynamicProgramming', label: 'Dynamic Programming' },
];
const topicLabel = (id: string) => TOPICS.find((t) => t.id === id)?.label ?? id;

interface Verification {
    verified: boolean;
    dropped: number;
    total: number;
}

// Feedback lines saved to the dashboard: the first few failing tests.
function summarizeFailures(report: TestReport, spec: ProblemSpec): string[] {
    if (report.passed === report.total) return [`All ${report.total} tests passed.`];
    return report.results
        .filter((r) => !r.passed)
        .slice(0, 4)
        .map((r) => {
            const got = r.error ?? (r.returnedNothing ? 'nothing' : literal(r.actual));
            return `${callLabel(spec, r.args)}: expected ${literal(r.expected)}, got ${got}`;
        });
}

function Practice() {
    const showToast = useToast();
    const topicId = useId();
    const difficultyId = useId();
    const languageId = useId();

    const [topic, setTopic] = useState('Arrays');
    const [difficulty, setDifficulty] = useState('Medium');
    const [language, setLanguage] = useState('javascript');

    const [problem, setProblem] = useState('');
    const [spec, setSpec] = useState<ProblemSpec | null>(null);
    const [verification, setVerification] = useState<Verification | null>(null);
    const [problemId, setProblemId] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    const [starter, setStarter] = useState(() => starterFor(null, 'javascript'));
    const [code, setCode] = useState(starter);

    const [output, setOutput] = useState('');
    const [outputIsError, setOutputIsError] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const [status, setStatus] = useState<string | null>(null); // "Loading Python…"
    const [report, setReport] = useState<TestReport | null>(null);
    const [isChecking, setIsChecking] = useState(false);
    const [consoleOpen, setConsoleOpen] = useState(true);
    const [consoleView, setConsoleView] = useState<ConsoleView>('output');

    const busy = isRunning || isChecking;
    const codeRef = useRef(code);
    const editorRef = useRef<any>(null);
    // Read from the live editor: React state can lag a keystroke behind a fast Ctrl+Enter.
    const currentCode = (): string => editorRef.current?.getValue() ?? codeRef.current;
    const runCodeRef = useRef<() => void>(() => {});
    const checkRef = useRef<() => void>(() => {});

    useEffect(() => {
        codeRef.current = code;
    }, [code]);

    const generateProblem = async () => {
        if (isGenerating) return; // busy button keeps focus, so ignore repeat presses
        setIsGenerating(true);
        try {
            const params = new URLSearchParams({ topic, difficulty });
            const res = await fetch(`${API_URL}/api/problem/generate?${params}`);
            const data = res.ok ? await res.json() : null;
            if (!data?.spec) {
                showToast(data?.error || "The AI couldn't write a problem right now. Try again in a moment.", 'error');
                return;
            }
            // Confirm the AI's expected answers by running its hidden reference solution.
            const checked = await verifySpec(data.spec as ProblemSpec);
            const kept = checked.spec.tests.length;
            setProblem(String(data.problem).replace(/against \d+ tests/, `against ${kept} tests`));
            setSpec(checked.spec);
            setVerification({ verified: checked.verified, dropped: checked.dropped, total: kept });
            setProblemId(newProblemId());
            setReport(null);

            const nextStarter = starterFor(checked.spec, language);
            const previous = currentCode();
            const hadWork = previous.trim() !== starter.trim();
            setStarter(nextStarter);
            setCode(nextStarter);
            if (hadWork) {
                showToast('Loaded the starter for the new problem.', 'info', { label: 'Undo', onClick: () => setCode(previous) });
            }
        } catch (e) {
            console.error(e);
            showToast(SERVER_UNREACHABLE, 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    const changeLanguage = (next: string) => {
        const nextStarter = starterFor(spec, next);
        const untouched = currentCode().trim() === starter.trim();
        setLanguage(next);
        setStarter(nextStarter);
        setReport(null);
        if (untouched) setCode(nextStarter);
        else showToast('Kept your code. Press Reset to load the starter for this language.', 'info');
    };

    // Run: call the function with Example 1 and show what it printed and returned.
    // Check does the same for every test. The engine depends on the language (engine.ts).
    const runCode = async () => {
        if (busy || !spec) return;
        setIsRunning(true);
        setConsoleOpen(true);
        setConsoleView('output');
        const result = await checkSolution(spec, currentCode(), language, 'example', setStatus);
        const r = result.results[0];
        if (result.error || !r) {
            setOutput(result.error || 'The code could not be run.');
            setOutputIsError(true);
        } else {
            const printed = [...result.logs, ...r.logs];
            const returned = r.error ?? (r.returnedNothing ? 'nothing (is a return missing?)' : literal(r.actual));
            setOutput([
                ...(printed.length ? [...printed, ''] : []),
                `${callLabel(spec, r.args)}`,
                `  returned  ${returned}`,
                `  expected  ${literal(r.expected)}`,
                '',
                r.passed ? 'Matches Example 1. Press Check to run every test.' : "Doesn't match Example 1 yet.",
            ].join('\n'));
            setOutputIsError(!!r.error);
        }
        setIsRunning(false);
    };

    const check = async () => {
        if (busy) return;
        setConsoleOpen(true);
        setConsoleView('tests');
        if (!spec) return; // the Tests panel explains what to do
        setIsChecking(true);
        const result = await checkSolution(spec, currentCode(), language, 'check', setStatus);
        setReport(result);
        setIsChecking(false);
        if (!result.error) {
            savePracticeResult({
                kind: 'practice',
                problemId,
                problemTitle: spec.title,
                mode: 'Practice',
                language,
                engine: result.engine,
                topic: topicLabel(topic),
                difficulty,
                codingScore: Math.round((result.passed / Math.max(result.total, 1)) * 10),
                testsPassed: result.passed,
                testsTotal: result.total,
                feedbackPoints: summarizeFailures(result, spec),
            });
        }
    };

    // Keep the keyboard shortcuts pointing at the latest handlers.
    useEffect(() => {
        runCodeRef.current = runCode;
        checkRef.current = check;
    });

    const copyCode = async () => {
        try {
            await navigator.clipboard.writeText(currentCode());
            showToast('Code copied to clipboard', 'success');
        } catch {
            showToast('Could not copy code', 'error');
        }
    };

    const resetCode = () => {
        const previous = currentCode();
        setCode(starter);
        showToast('Editor reset', 'info', { label: 'Undo', onClick: () => setCode(previous) });
    };

    const handleEditorMount = (editor: any, monaco: any) => {
        editorRef.current = editor;
        editor.onDidDispose(() => { editorRef.current = null; });
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runCodeRef.current());
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => checkRef.current());
    };

    return (
        <main className="iv-container">
            {/* LEFT: PROBLEM */}
            <section className="pr-problem-pane" aria-label="Problem">
                <div className="iv-toolbar pr-toolbar">
                    <Link to="/" className="btn btn-ghost btn-sm icon-on-mobile">
                        <ArrowLeft size={16} aria-hidden="true" /> <span className="btn-label">Exit</span>
                    </Link>

                    <div className="divider" />

                    <label className="sr-only" htmlFor={topicId}>Topic</label>
                    <select id={topicId} className="select select-sm" value={topic} onChange={(e) => setTopic(e.target.value)}>
                        {TOPICS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>

                    <label className="sr-only" htmlFor={difficultyId}>Difficulty</label>
                    <select id={difficultyId} className="select select-sm" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                        <option value="Easy">Easy</option>
                        <option value="Medium">Medium</option>
                        <option value="Hard">Hard</option>
                    </select>

                    <button type="button" className="btn btn-secondary btn-sm spacer" onClick={generateProblem} aria-disabled={isGenerating}>
                        <Shuffle size={16} aria-hidden="true" /> {isGenerating ? 'Generating…' : (problem ? 'New problem' : 'Generate')}
                    </button>
                </div>

                <div className="pr-problem-body" aria-live="polite" aria-busy={isGenerating}>
                    {isGenerating ? (
                        <div className="pr-skeleton" aria-hidden="true">
                            <div className="sk-line sk-title" />
                            <div className="sk-line" />
                            <div className="sk-line" />
                            <div className="sk-line short" />
                            <div className="sk-block" />
                            <div className="sk-line" />
                            <div className="sk-line short" />
                        </div>
                    ) : problem ? (
                        <>
                            <div className="markdown pr-markdown">
                                <ReactMarkdown>{problem}</ReactMarkdown>
                            </div>
                            {verification && (
                                <p className={`pr-verify ${verification.verified ? '' : 'unverified'}`}>
                                    {verification.verified
                                        ? <ShieldCheck size={18} aria-hidden="true" />
                                        : <WarningCircle size={18} aria-hidden="true" />}
                                    <span>
                                        {verification.verified
                                            ? verification.dropped > 0
                                                ? `${verification.total} tests, each confirmed by running a reference solution. ${verification.dropped} AI-written ${verification.dropped === 1 ? 'test was' : 'tests were'} dropped because the reference disagreed.`
                                                : `${verification.total} tests, each confirmed by running a reference solution.`
                                            : `${verification.total} AI-written tests. They couldn't be double-checked, so an expected answer may occasionally be wrong.`}
                                    </span>
                                </p>
                            )}
                        </>
                    ) : (
                        <div className="pr-empty">
                            <PuzzlePiece className="pr-empty-icon" size={48} aria-hidden="true" />
                            <h1>Generate a problem to begin</h1>
                            <p>Pick a topic and difficulty above, then press Generate. Solve it in any of the eight languages, then press Check. JavaScript, TypeScript and Python run for real in your browser; the other languages are checked by AI.</p>
                        </div>
                    )}
                </div>
            </section>

            {/* RIGHT: EDITOR + CONSOLE */}
            <section className="iv-editor-pane" aria-label="Editor">
                <div className="iv-toolbar">
                    <label className="sr-only" htmlFor={languageId}>Language</label>
                    <select
                        id={languageId}
                        className="select select-sm"
                        value={language}
                        onChange={(e) => changeLanguage(e.target.value)}
                    >
                        <optgroup label="Runs in your browser">
                            {LANGUAGES.filter((l) => BROWSER_LANGUAGES.includes(l.id)).map((l) => (
                                <option key={l.id} value={l.id}>{l.label}</option>
                            ))}
                        </optgroup>
                        <optgroup label="Checked by AI">
                            {LANGUAGES.filter((l) => !BROWSER_LANGUAGES.includes(l.id)).map((l) => (
                                <option key={l.id} value={l.id}>{l.label}</option>
                            ))}
                        </optgroup>
                    </select>

                    <div className="spacer" />

                    <button type="button" className="btn btn-ghost btn-sm icon-on-mobile" onClick={copyCode}>
                        <Copy size={16} aria-hidden="true" /> <span className="btn-label">Copy</span>
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm icon-on-mobile" onClick={resetCode}>
                        <ArrowCounterClockwise size={16} aria-hidden="true" /> <span className="btn-label">Reset</span>
                    </button>

                    <div className="run-group">
                        <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={runCode}
                            aria-disabled={busy || !spec}
                            title="Call your function with Example 1 (Ctrl+Enter)"
                        >
                            <Play size={16} weight="fill" aria-hidden="true" /> {isRunning ? 'Running…' : 'Run'}
                        </button>
                        <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={check}
                            aria-disabled={busy || !spec}
                            title="Test your function against every test (Ctrl+Shift+Enter)"
                        >
                            <ListChecks size={16} aria-hidden="true" /> {isChecking ? 'Checking…' : 'Check'}
                        </button>
                    </div>
                </div>

                <div className="iv-editor-wrap">
                    <Editor
                        height="100%"
                        language={language}
                        theme="mockmate-dark"
                        value={code}
                        onChange={(val) => setCode(val || '')}
                        beforeMount={defineMockmateTheme}
                        onMount={handleEditorMount}
                        options={EDITOR_OPTIONS}
                    />
                </div>

                <OutputConsole
                    open={consoleOpen}
                    onToggle={() => setConsoleOpen((o) => !o)}
                    output={output}
                    isError={outputIsError}
                    isRunning={isRunning}
                    source={engineFor(language) === 'browser' ? 'executed' : 'estimated'}
                    status={status}
                    view={consoleView}
                    onViewChange={setConsoleView}
                    tests={{
                        spec,
                        report,
                        running: isChecking,
                        engine: engineFor(language),
                    }}
                />
            </section>
        </main>
    );
}

export default Practice;
