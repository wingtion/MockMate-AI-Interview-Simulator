/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef, useId } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import * as signalR from '@microsoft/signalr';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import {
    ArrowClockwise,
    ArrowCounterClockwise,
    ArrowLeft,
    ArrowRight,
    ChartLineUp,
    ChatCircle,
    CheckCircle,
    Copy,
    House,
    Lightbulb,
    Lock,
    Microphone,
    MicrophoneSlash,
    NotePencil,
    PaperPlaneRight,
    Play,
    SpeakerSlash,
    Square,
    Stop,
    WarningCircle,
    X,
} from '@phosphor-icons/react';
import AudioVisualizer from '../components/AudioVisualizer';
import Modal from '../components/Modal';
import OutputConsole from '../components/OutputConsole';
import { useToast } from '../components/Toast';
import { saveRecord } from '../lib/history';
import { defineMockmateTheme, EDITOR_OPTIONS } from '../lib/editorTheme';
import { SERVER_UNREACHABLE } from '../lib/api';
import { runProgram } from '../lib/engine';
import { engineFor } from '../lib/practice';
import {
    ARENAS,
    LANGUAGES,
    LANG_LABEL,
    personaFor,
    isCodingMode,
    fixedLanguageFor,
    starterFor,
} from '../lib/modes';
import { API_URL } from '../config';
import '../App.css';

interface AiResponse {
    message: string;
    isCodeRequest: boolean;
}

interface InterviewFeedback {
    codingScore: number;
    communicationScore: number;
    feedbackPoints: string[];
}

type ReportState = 'idle' | 'loading' | 'done' | 'error';

const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
};

const scoreClass = (v: number) => (v >= 7 ? 'good' : v >= 4 ? 'mid' : 'bad');

// The grader contract is 1-10 for both scores. Anything else (including the
// 0/0 the backend used to return on a Groq failure) is treated as a failed report.
const isValidReport = (r: any): r is InterviewFeedback =>
    !!r &&
    Number.isFinite(r.codingScore) && r.codingScore >= 1 && r.codingScore <= 10 &&
    Number.isFinite(r.communicationScore) && r.communicationScore >= 1 && r.communicationScore <= 10;

// The Web Speech API (mic) is unavailable on iOS Safari (so all iPhone/iPad browsers)
// and some mobile browsers. When it's missing we hide the mic UI and steer the user
// to the typed chat input instead, which drives the interview just the same.
const VOICE_SUPPORTED =
    typeof window !== 'undefined' &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

function Interview() {
    const { modeParam } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const showToast = useToast();
    const modeSelectId = useId();
    const langSelectId = useId();

    // --- STATE ---
    const [connection, setConnection] = useState<signalR.HubConnection | null>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [isStarting, setIsStarting] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [code, setCode] = useState<string>("// The interviewer will give you a problem. Write your solution here…\n");
    const [mode, setMode] = useState<string>(modeParam || "Standard");
    const [language, setLanguage] = useState<string>("javascript");
    const [isAiSpeaking, setIsAiSpeaking] = useState(false);
    const [isAiThinking, setIsAiThinking] = useState(false);
    const [elapsed, setElapsed] = useState(0); // session seconds
    const speechTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
    const chatLogRef = useRef<HTMLDivElement>(null);
    const resumeText = location.state?.resumeText || "";

    // Execution state (engine picked per language, see lib/engine.ts)
    const [output, setOutput] = useState<string>("");
    const [outputIsError, setOutputIsError] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const [runStatus, setRunStatus] = useState<string | null>(null); // "Loading Python…"
    const [consoleOpen, setConsoleOpen] = useState(true);

    // Feedback State
    const [feedback, setFeedback] = useState<InterviewFeedback | null>(null);
    const [reportState, setReportState] = useState<ReportState>('idle');

    const [chatInput, setChatInput] = useState("");
    const [previewText, setPreviewText] = useState("");

    const codeRef = useRef<string>(code);
    const editorRef = useRef<any>(null);
    // Read from the live editor: React state can lag a keystroke behind a fast Ctrl+Enter.
    const currentCode = (): string => editorRef.current?.getValue() ?? codeRef.current;
    const recognitionRef = useRef<any>(null);
    const runCodeRef = useRef<() => void>(() => {});

    // Voice capture: accumulate speech until the user clicks STOP
    const finalTranscriptRef = useRef("");
    const interimRef = useRef("");
    const manualStopRef = useRef(false);

    const isSessionActive = useRef(false);

    useEffect(() => {
        codeRef.current = code;
    }, [code]);

    // Keep the editor language in sync with the arena: SQL/DevOps force a fixed
    // language, and switching away from one resets a now-invalid leftover.
    useEffect(() => {
        const fixed = fixedLanguageFor(mode);
        const next = fixed ?? (LANGUAGES.some((l) => l.id === language) ? language : 'javascript');
        if (next !== language) {
            setLanguage(next);
            setCode(starterFor(next));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode]);

    // Auto-scroll the chat to the newest message / typing indicator
    useEffect(() => {
        // Scroll only the transcript itself; scrollIntoView would also scroll the
        // page and pull the editor out of view on phones.
        const log = chatLogRef.current;
        if (log) log.scrollTo({ top: log.scrollHeight, behavior: 'smooth' });
    }, [messages, isAiThinking]);

    // Session timer: runs while connected
    useEffect(() => {
        if (!isConnected) return;
        setElapsed(0);
        const t = setInterval(() => setElapsed((e) => e + 1), 1000);
        return () => clearInterval(t);
    }, [isConnected]);

    const cleanTextForSpeech = (text: string) => {
        return text.replace(/[*#`]/g, '');
    };

    const speakText = (text: string) => {
        if (!isSessionActive.current) return;

        stopSpeaking();

        const cleanText = cleanTextForSpeech(text);
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'en-US';
        pendingUtteranceRef.current = utterance;

        utterance.onstart = () => {
            if (!isSessionActive.current || pendingUtteranceRef.current !== utterance) {
                window.speechSynthesis.cancel();
                setIsAiSpeaking(false);
                return;
            }
            setIsAiSpeaking(true);
        };

        utterance.onend = () => {
            pendingUtteranceRef.current = null;
            setIsAiSpeaking(false);
        };
        utterance.onerror = () => {
            pendingUtteranceRef.current = null;
            setIsAiSpeaking(false);
        };

        speechTimeoutRef.current = setTimeout(() => {
            speechTimeoutRef.current = null;
            if (isSessionActive.current) {
                window.speechSynthesis.speak(utterance);
            }
        }, 100);
    };

    const stopSpeaking = () => {
        if (speechTimeoutRef.current !== null) {
            clearTimeout(speechTimeoutRef.current);
            speechTimeoutRef.current = null;
        }

        pendingUtteranceRef.current = null;

        if (window.speechSynthesis.paused || window.speechSynthesis.pending || window.speechSynthesis.speaking) {
            window.speechSynthesis.resume();
            window.speechSynthesis.cancel();
        }

        setIsAiSpeaking(false);
    };

    const toggleMic = () => {
        stopSpeaking();

        if (!recognitionRef.current) return;

        if (isListening) {
            // User is done thinking/talking: finalize & send (handled in onend)
            manualStopRef.current = true;
            try { recognitionRef.current.stop(); } catch { /* already stopped */ }
        } else {
            // Fresh capture; stays open through pauses until STOP is pressed
            manualStopRef.current = false;
            finalTranscriptRef.current = "";
            interimRef.current = "";
            setPreviewText("");
            try {
                recognitionRef.current.start();
                setIsListening(true);
            } catch { /* already started */ }
        }
    };

    const sendToBackend = async (text: string) => {
        setMessages(prev => [...prev, { sender: 'user', text: text }]);
        setIsAiThinking(true);

        if (connection) {
            try {
                await connection.invoke("ProcessUserAudio", {
                    text: text,
                    currentCode: currentCode(),
                    mode: mode
                });
            } catch (error) {
                console.error("Error sending data:", error);
                setIsAiThinking(false);
                showToast("Your answer didn't reach the interviewer. Check your connection and send it again.", 'error');
            }
        }
    };

    const handleSendText = (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim()) return;

        sendToBackend(chatInput);

        setChatInput("");
    };

    const startInterview = async () => {
        if (isStarting) return;
        setIsStarting(true);
        try {
            isSessionActive.current = true;

            const newConnection = new signalR.HubConnectionBuilder()
                .withUrl(`${API_URL}/interviewHub`)
                .withAutomaticReconnect()
                .build();

            newConnection.on("ReceiveSystemStatus", (msg: string) => {
                console.log(msg);
                setIsAiThinking(true);
            });

            newConnection.on("ReceiveAiResponse", (response: AiResponse) => {
                setIsAiThinking(false);
                if (!isSessionActive.current) return;

                setMessages(prev => [...prev, { sender: 'ai', text: response.message }]);
                speakText(response.message);
            });

            newConnection.onclose(() => {
                if (isSessionActive.current) {
                    setIsAiThinking(false);
                    showToast("Lost the connection to the interviewer. End the session and start a new one.", 'error');
                }
            });

            await newConnection.start();
            setMessages([]);
            setConnection(newConnection);
            setIsConnected(true);

            if (newConnection.state === signalR.HubConnectionState.Connected) {

                let initialMessage = `I am ready for the ${mode} interview in ${language}.`;

                if (mode === "Resume" && resumeText) {
                    initialMessage = `Hello. I have uploaded my resume. Please ask me a deep, technical question about a specific project or technology listed in my resume. \n\n--- MY RESUME ---\n${resumeText}`;
                }

                await newConnection.invoke("ProcessUserAudio", {
                    text: initialMessage,
                    currentCode: currentCode(),
                    mode: mode
                });
            }

        } catch (error) {
            console.error(error);
            showToast(SERVER_UNREACHABLE, 'error');
            isSessionActive.current = false;
        } finally {
            setIsStarting(false);
        }
    };

    // Ask the hub for the scored report. On failure the connection (and the
    // server-side transcript) is kept alive so the user can retry.
    const requestReport = async (conn: signalR.HubConnection) => {
        setReportState('loading');
        try {
            const report = await conn.invoke<InterviewFeedback>("EndSession");
            if (!isValidReport(report)) throw new Error("Report came back without valid scores");
            const points = report.feedbackPoints ?? [];
            setFeedback({ ...report, feedbackPoints: points });
            saveRecord({
                kind: 'interview',
                mode,
                language,
                codingScore: report.codingScore,
                communicationScore: report.communicationScore,
                feedbackPoints: points,
            });
            setReportState('done');
            conn.stop();
        } catch (e) {
            console.error("Error getting feedback:", e);
            setReportState('error');
        }
    };

    const endSession = async () => {
        isSessionActive.current = false;
        stopSpeaking();

        // Stop voice capture without restarting
        manualStopRef.current = true;
        try { recognitionRef.current?.stop(); } catch { /* noop */ }
        setIsListening(false);
        setIsAiThinking(false);

        const watchdog = setInterval(() => {
            window.speechSynthesis.cancel();
            setIsAiSpeaking(false);
        }, 50);
        setTimeout(() => clearInterval(watchdog), 1000);

        setIsConnected(false);

        if (connection) {
            connection.off("ReceiveAiResponse");
            connection.off("ReceiveSystemStatus");
            await requestReport(connection);
        }
    };

    const canRetryReport = connection?.state === signalR.HubConnectionState.Connected;

    const retryReport = () => {
        if (connection && canRetryReport) requestReport(connection);
    };

    const leaveWithoutReport = () => {
        connection?.stop();
        setReportState('idle');
        navigate('/');
    };

    const closeReport = () => {
        setReportState('idle');
        setFeedback(null);
    };

    // Full teardown when leaving mid-session (so the AI doesn't keep talking on the home page).
    const exitToHome = () => {
        isSessionActive.current = false;
        manualStopRef.current = true;
        stopSpeaking();

        // Aggressively cancel TTS for a moment to defeat Chrome's resume quirk.
        const watchdog = setInterval(() => {
            window.speechSynthesis.resume();
            window.speechSynthesis.cancel();
        }, 60);
        setTimeout(() => clearInterval(watchdog), 1500);

        try { recognitionRef.current?.stop(); } catch { /* noop */ }
        if (connection) {
            connection.off("ReceiveAiResponse");
            connection.off("ReceiveSystemStatus");
            connection.stop();
        }
        setIsListening(false);
        setIsAiThinking(false);
        navigate('/');
    };

    const runCode = async () => {
        if (isRunning) return; // busy button keeps focus, so ignore repeat presses
        setIsRunning(true);
        setConsoleOpen(true);
        const result = await runProgram(language, currentCode(), setRunStatus);
        setOutput(result.output);
        setOutputIsError(result.isError);
        setIsRunning(false);
    };
    runCodeRef.current = runCode; // keep the Ctrl+Enter shortcut pointing at the latest

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
        setCode(starterFor(language));
        showToast('Editor reset', 'info', { label: 'Undo', onClick: () => setCode(previous) });
    };

    const handleEditorMount = (editor: any, monaco: any) => {
        editorRef.current = editor;
        editor.onDidDispose(() => { editorRef.current = null; });
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runCodeRef.current());
    };


    useEffect(() => {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = true;      // stay open across pauses
            recognitionRef.current.lang = 'en-US';
            recognitionRef.current.interimResults = true;  // live preview while speaking

            recognitionRef.current.onstart = () => console.log("🎤 Mic started, listening...");

            recognitionRef.current.onresult = (event: any) => {
                let interim = "";
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const chunk = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscriptRef.current += chunk + " ";
                    } else {
                        interim += chunk;
                    }
                }
                interimRef.current = interim;
                setPreviewText((finalTranscriptRef.current + interim).trim());
            };

            recognitionRef.current.onerror = (event: any) => {
                console.error("🎤 Speech recognition error:", event.error);
                if (event.error === 'no-speech' || event.error === 'aborted') {
                    // Silence during a thinking pause: keep alive (onend restarts the mic)
                    return;
                }
                // Fatal errors: stop the capture and inform the user
                manualStopRef.current = true;
                if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                    showToast("Microphone permission is blocked. Allow mic access for this site and try again.", 'error');
                } else if (event.error === 'network') {
                    showToast("Speech recognition needs an internet connection (it uses the browser's online service).", 'error');
                }
            };

            recognitionRef.current.onend = () => {
                // Browser auto-stopped (e.g. long silence) but user hasn't pressed STOP:
                // restart so the mic stays open while they think.
                if (!manualStopRef.current) {
                    try {
                        recognitionRef.current.start();
                        return;
                    } catch {
                        // fall through to finalize if restart fails
                    }
                }

                // User pressed STOP (or fatal error): finalize and send once.
                const text = (finalTranscriptRef.current + " " + interimRef.current).trim();
                finalTranscriptRef.current = "";
                interimRef.current = "";
                setPreviewText("");
                setIsListening(false);
                if (text) sendToBackend(text);
            };
        } else {
            console.error("🎤 SpeechRecognition not supported in this browser. Use Chrome or Edge.");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [connection]);

    //  Cleanup Effect
    useEffect(() => {
        return () => {
            manualStopRef.current = true;
            window.speechSynthesis.cancel();
            try { recognitionRef.current?.stop(); } catch { /* noop */ }
            if (connection) connection.stop();
        };
    }, [connection]);

    const persona = personaFor(mode);
    const PersonaIcon = persona.icon;
    const fixedLang = fixedLanguageFor(mode);

    return (
        <div className={`iv-container ${isConnected ? 'is-live' : ''}`}>

            {/* PRE-SESSION SETUP LOBBY */}
            {!isConnected && (
                <main className="iv-lobby">
                    <div className="iv-lobby-card">
                        <Link to="/" className="iv-lobby-back">
                            <ArrowLeft size={16} aria-hidden="true" /> Back home
                        </Link>
                        <h1>Set up your interview</h1>
                        <p className="iv-lobby-sub">Choose who interviews you and the language you'll code in.</p>

                        <div className="iv-field">
                            <label className="field-label" htmlFor={modeSelectId}>Interview mode</label>
                            <select id={modeSelectId} className="select" value={mode} onChange={(e) => setMode(e.target.value)}>
                                <option value="Standard">Standard</option>
                                {ARENAS.filter((a) => !a.resume).map((a) => (
                                    <option key={a.id} value={a.id}>{a.title}</option>
                                ))}
                            </select>

                            <div className="iv-lobby-persona">
                                <div className="persona-avatar" aria-hidden="true"><PersonaIcon size={22} /></div>
                                <div className="persona-info">
                                    <div className="persona-name">{persona.name}</div>
                                    <div className="persona-tag">{persona.tagline}</div>
                                </div>
                            </div>
                        </div>

                        {!isCodingMode(mode) ? (
                            <div className="iv-lobby-note">
                                <ChatCircle size={16} aria-hidden="true" /> Conversation only. This mode has no coding.
                            </div>
                        ) : fixedLang ? (
                            <div className="iv-lobby-note">
                                <Lock size={16} aria-hidden="true" /> Language fixed to {LANG_LABEL[fixedLang]} for this arena.
                            </div>
                        ) : (
                            <div className="iv-field">
                                <label className="field-label" htmlFor={langSelectId}>Language</label>
                                <select
                                    id={langSelectId}
                                    className="select"
                                    value={language}
                                    onChange={(e) => { setLanguage(e.target.value); setCode(starterFor(e.target.value)); }}
                                >
                                    {LANGUAGES.map((l) => (
                                        <option key={l.id} value={l.id}>{l.label}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {mode === 'Resume' && resumeText && (
                            <div className="iv-lobby-resume">
                                <CheckCircle size={16} weight="fill" aria-hidden="true" /> Résumé loaded
                            </div>
                        )}

                        <button
                            type="button"
                            className="btn btn-primary btn-lg btn-block iv-lobby-start"
                            onClick={startInterview}
                            aria-disabled={isStarting}
                        >
                            {isStarting ? 'Connecting…' : <>Start interview <ArrowRight size={18} aria-hidden="true" /></>}
                        </button>

                        <p className="iv-lobby-hint">
                            {VOICE_SUPPORTED
                                ? <><Lightbulb size={14} aria-hidden="true" /> Voice works best in Chrome or Edge on desktop.</>
                                : <><MicrophoneSlash size={14} aria-hidden="true" /> This browser doesn't support voice, so you'll type your answers. It works the same.</>}
                        </p>
                    </div>
                </main>
            )}

            {/* LEFT PANE: EDITOR (hidden for conversation-only modes like System Design / Amazon) */}
            {isCodingMode(mode) && (
            <div className="iv-editor-pane" inert={!isConnected}>
                <div className="iv-toolbar">
                    <button type="button" className="btn btn-ghost btn-sm icon-on-mobile" onClick={exitToHome}>
                        <ArrowLeft size={16} aria-hidden="true" /> <span className="btn-label">Exit</span>
                    </button>

                    <div className="divider" />

                    <span className="iv-lang-badge">{LANG_LABEL[language] ?? language}</span>

                    <div className="spacer" />

                    <button type="button" className="btn btn-ghost btn-sm icon-on-mobile" onClick={copyCode}>
                        <Copy size={16} aria-hidden="true" /> <span className="btn-label">Copy</span>
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm icon-on-mobile" onClick={resetCode}>
                        <ArrowCounterClockwise size={16} aria-hidden="true" /> <span className="btn-label">Reset</span>
                    </button>

                    {/* RUN BUTTON: JS/TS/Python run in the browser; other languages are AI-estimated */}
                    <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={runCode}
                        aria-disabled={isRunning}
                        title={engineFor(language) === 'browser' ? 'Run your code in the browser (Ctrl+Enter)' : 'Get an AI-predicted output (Ctrl+Enter)'}
                    >
                        <Play size={16} weight="fill" aria-hidden="true" /> {isRunning ? 'Running…' : 'Run'}
                    </button>
                </div>

                <div className="iv-editor-wrap">
                    <Editor
                        height="100%"
                        language={language}
                        theme="mockmate-dark"
                        value={code}
                        onChange={(val) => setCode(val || "")}
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
                    status={runStatus}
                />
            </div>
            )}

            {/* RIGHT PANE: CHAT */}
            <div className={`iv-chat-pane ${!isCodingMode(mode) ? 'iv-chat-pane-full' : ''}`} inert={!isConnected}>
                {isConnected && (
                    <div className="room-head">
                        <div className="persona-avatar" aria-hidden="true"><PersonaIcon size={22} /></div>
                        <div className="persona-info">
                            <div className="persona-name">{persona.name}</div>
                            <div className="persona-tag">{persona.tagline}</div>
                        </div>
                        <div className="persona-right">
                            {!isCodingMode(mode) && (
                                <button type="button" className="btn btn-ghost btn-sm" onClick={exitToHome}>
                                    <ArrowLeft size={16} aria-hidden="true" /> Exit
                                </button>
                            )}
                            <span className="session-status">
                                <span className="live-dot" aria-hidden="true" />
                                <span className="sr-only">Session time</span>
                                <time>{formatTime(elapsed)}</time>
                            </span>
                            <button type="button" className="btn btn-danger btn-sm" onClick={endSession}>
                                <Square size={14} weight="fill" aria-hidden="true" /> End
                            </button>
                        </div>
                    </div>
                )}

                <div ref={chatLogRef} className="chat-log" role="log" aria-live="polite" aria-label="Interview conversation">
                    {messages.length === 0 && (
                        <div className="chat-empty">Start a session to begin the conversation.</div>
                    )}

                    {messages.map((m, i) => (
                        <div key={i} className={`message ${m.sender}`}>
                            <span className="sender">{m.sender === 'ai' ? persona.name : 'You'}</span>
                            {m.sender === 'ai' ? (
                                <div className="markdown">
                                    <ReactMarkdown>{m.text}</ReactMarkdown>
                                </div>
                            ) : (
                                <div>{m.text}</div>
                            )}
                        </div>
                    ))}

                    {isAiThinking && (
                        <div className="message ai thinking">
                            <span className="sender">{persona.name}</span>
                            <span className="typing" aria-hidden="true"><i /><i /><i /></span>
                            <span className="sr-only">The interviewer is thinking.</span>
                        </div>
                    )}

                </div>

                {/* DOCK: type or speak. Fixed to the bottom of the screen on phones. */}
                <div className="room-dock">
                <form className="chat-input-row" onSubmit={handleSendText}>
                    <input
                        type="text"
                        className="input"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        disabled={!isConnected}
                        aria-label="Message the interviewer"
                        placeholder={isConnected ? "Type a message and press Enter…" : "Connect to chat…"}
                    />
                    <button
                        type="submit"
                        className="btn btn-secondary"
                        disabled={!isConnected}
                        aria-disabled={!chatInput.trim()}
                    >
                        <PaperPlaneRight size={16} aria-hidden="true" /> Send
                    </button>
                </form>

                {!isConnected ? (
                    <div className="voice-disconnected">Connect to start speaking</div>
                ) : !VOICE_SUPPORTED ? (
                    <div className="voice-note">
                        Voice isn't supported in this browser (for example iPhone Safari).
                        <strong> Type your answers in the box above.</strong> The interview works exactly the same.
                    </div>
                ) : (
                    <>
                        {isListening && previewText && (
                            <div className="voice-preview">{previewText}</div>
                        )}

                        <div className="voice-bar">
                            <button
                                type="button"
                                className={`mic-button ${isListening ? 'mic-active' : 'mic-inactive'}`}
                                onClick={toggleMic}
                            >
                                {isListening
                                    ? <><Stop size={20} weight="fill" aria-hidden="true" /> Stop &amp; send</>
                                    : <><Microphone size={20} aria-hidden="true" /> Speak</>}
                            </button>

                            <AudioVisualizer isListening={isListening} isSpeaking={isAiSpeaking} />

                            <div className={`voice-status ${isListening ? 'listening' : (isAiSpeaking ? 'speaking' : '')}`}>
                                {isListening
                                    ? "Listening. Take your time."
                                    : (isAiSpeaking ? "Interviewer speaking…" : "Answer out loud")}
                            </div>

                            {/* INTERRUPT BUTTON */}
                            {isAiSpeaking && (
                                <button type="button" className="btn btn-ghost btn-sm" onClick={stopSpeaking}>
                                    <SpeakerSlash size={16} aria-hidden="true" /> Stop audio
                                </button>
                            )}
                        </div>
                    </>
                )}
                </div>
            </div>

            {/* REPORT: loading (not dismissible) */}
            <Modal open={reportState === 'loading'} label="Generating your report" className="modal-plain" dismissible={false}>
                <div className="report-loading" role="status">
                    <div className="spinner" aria-hidden="true" />
                    Generating your report card…
                </div>
            </Modal>

            {/* REPORT: failed, transcript kept for a retry */}
            <Modal open={reportState === 'error'} label="Report failed" className="modal-wide" dismissible={false} role="alertdialog">
                <div className="report-error-icon" aria-hidden="true"><WarningCircle size={28} /></div>
                <h2>We couldn't generate your report</h2>
                <p className="modal-sub">
                    {canRetryReport
                        ? 'The AI grader is busy or timed out. Your conversation is still on the server, so you can try again.'
                        : 'The connection to the server was lost, so this session can no longer be scored.'}
                </p>
                <div className="report-actions">
                    <button type="button" className="btn btn-secondary btn-lg" onClick={leaveWithoutReport}>
                        Leave without report
                    </button>
                    {canRetryReport && (
                        <button type="button" className="btn btn-primary btn-lg" onClick={retryReport}>
                            <ArrowClockwise size={18} aria-hidden="true" /> Try again
                        </button>
                    )}
                </div>
            </Modal>

            {/* REPORT: results */}
            <Modal open={reportState === 'done' && !!feedback} onClose={closeReport} label="Interview results" className="modal-wide report">
                <button type="button" className="modal-close" aria-label="Close results" onClick={closeReport}>
                    <X size={16} aria-hidden="true" />
                </button>
                <h2>Interview results</h2>
                <p className="report-sub">Here's how the session went.</p>

                {feedback && (
                    <>
                        <div className="score-row">
                            <div className="score-card">
                                <div className={`score-value ${scoreClass(feedback.codingScore)}`}>
                                    {feedback.codingScore}<span className="score-max">/10</span>
                                </div>
                                <div className="score-label">Coding</div>
                            </div>
                            <div className="score-card">
                                <div className={`score-value ${scoreClass(feedback.communicationScore)}`}>
                                    {feedback.communicationScore}<span className="score-max">/10</span>
                                </div>
                                <div className="score-label">Communication</div>
                            </div>
                        </div>

                        <div className="feedback-box">
                            <h3><NotePencil size={18} aria-hidden="true" /> Feedback</h3>
                            <ul>
                                {feedback.feedbackPoints.length
                                    ? feedback.feedbackPoints.map((point, i) => <li key={i}>{point}</li>)
                                    : <li>No written feedback this time.</li>}
                            </ul>
                        </div>
                    </>
                )}

                <div className="report-actions">
                    <Link to="/" className="btn btn-secondary btn-lg">
                        <House size={18} aria-hidden="true" /> Home
                    </Link>
                    <Link to="/dashboard" className="btn btn-primary btn-lg">
                        <ChartLineUp size={18} aria-hidden="true" /> View Dashboard
                    </Link>
                </div>
            </Modal>
        </div>
    );
}

export default Interview;
