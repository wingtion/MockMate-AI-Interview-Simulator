import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChartBar, ListChecks, NotePencil, X } from '@phosphor-icons/react';
import { getHistory, clearHistory, isPractice, type InterviewRecord } from '../lib/history';
import { ARENAS } from '../lib/modes';
import ScoreChart from '../components/ScoreChart';
import Footer from '../components/Footer';
import Modal from '../components/Modal';
import SiteNav from '../components/SiteNav';
import Reveal from '../components/Reveal';
import CountUp from '../components/CountUp';
import '../App.css';

const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

const scoreClass = (v: number) => (v >= 7 ? 'good' : v >= 4 ? 'mid' : 'bad');

// Records store the arena id ("SystemDesign"); show the human title instead.
const modeLabel = (mode: string) => ARENAS.find((a) => a.id === mode)?.title ?? mode;

const recordTitle = (r: InterviewRecord) =>
    isPractice(r) ? (r.problemTitle || 'Practice problem') : modeLabel(r.mode);

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function Dashboard() {
    const [records, setRecords] = useState<InterviewRecord[]>(() => getHistory());
    const [selected, setSelected] = useState<InterviewRecord | null>(null);

    const stats = useMemo(() => {
        if (records.length === 0) return null;
        const interviews = records.filter((r) => !isPractice(r));
        const practice = records.filter(isPractice);
        const avg = (list: InterviewRecord[], pick: (r: InterviewRecord) => number) =>
            list.length ? Math.round((list.reduce((s, r) => s + (pick(r) || 0), 0) / list.length) * 10) / 10 : null;
        return {
            interviews: interviews.length,
            practice: practice.length,
            avgCoding: avg(records, (r) => r.codingScore)!,
            avgComm: avg(interviews, (r) => r.communicationScore ?? 0),
            best: Math.max(...records.map((r) => r.codingScore || 0)),
        };
    }, [records]);

    // oldest → newest for the trend line
    const chartData = useMemo(
        () => [...records].reverse().map((r) => ({
            coding: r.codingScore || 0,
            communication: isPractice(r) ? null : (r.communicationScore ?? 0),
        })),
        [records],
    );

    const handleClear = () => {
        if (window.confirm('Clear all interview and practice history? This cannot be undone.')) {
            clearHistory();
            setRecords([]);
        }
    };

    const sessions = stats
        ? [stats.interviews ? plural(stats.interviews, 'interview', 'interviews') : '', stats.practice ? plural(stats.practice, 'practice problem', 'practice problems') : '']
            .filter(Boolean).join(' and ')
        : '';

    return (
        <div className="page">
            {/* NAVBAR */}
            <SiteNav
                items={[
                    { label: 'Home', to: '/' },
                    { label: 'Practice Problems', to: '/practice' },
                ]}
            />

            <main className="section dash-section">
                <div className="dash-head">
                    <div>
                        <h1 className="dash-title">Your Progress</h1>
                        <p className="dash-sub">Every finished interview and checked practice problem is saved on this device.</p>
                    </div>
                    {records.length > 0 && (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={handleClear}>Clear history</button>
                    )}
                </div>

                {records.length === 0 ? (
                    <div className="empty-state fade-in">
                        <ChartBar className="empty-icon" size={48} aria-hidden="true" />
                        <h2>Nothing here yet</h2>
                        <p>Finish a mock interview or check a practice solution, and your scores and progress will show up here.</p>
                        <Link to="/interview/Standard" className="btn btn-primary btn-lg">
                            Start interview <ArrowRight size={18} aria-hidden="true" />
                        </Link>
                    </div>
                ) : (
                    <>
                        {/* SUMMARY: one sentence instead of four metric tiles */}
                        <p className="dash-summary fade-in">
                            Across {sessions} you average{' '}
                            <strong className={`num ${scoreClass(stats!.avgCoding)}`}><CountUp value={stats!.avgCoding} decimals={1} /></strong> in coding
                            {stats!.avgComm !== null && (
                                <> and <strong className={`num ${scoreClass(stats!.avgComm)}`}><CountUp value={stats!.avgComm} decimals={1} /></strong> in communication</>
                            )}
                            . Your best coding score is <strong className={`num ${scoreClass(stats!.best)}`}><CountUp value={stats!.best} /></strong>.
                        </p>

                        {/* CHART */}
                        <Reveal>
                        <section className="panel" aria-labelledby="trend-title">
                            <div className="panel-head">
                                <h2 id="trend-title" className="panel-title">Score trend</h2>
                                <div className="chart-legend">
                                    <span className="legend-item"><i className="swatch" aria-hidden="true" /> Coding</span>
                                    {stats!.interviews > 0 && (
                                        <span className="legend-item"><i className="swatch comm" aria-hidden="true" /> Communication</span>
                                    )}
                                </div>
                            </div>
                            <ScoreChart data={chartData} />
                        </section>
                        </Reveal>

                        {/* HISTORY LIST */}
                        <Reveal>
                        <section className="panel" aria-labelledby="history-title">
                            <div className="panel-head">
                                <h2 id="history-title" className="panel-title">History</h2>
                                <span className="muted">{records.length} total</span>
                            </div>
                            <div className="history-list">
                                {records.map((r) => (
                                    <button
                                        key={r.id}
                                        type="button"
                                        className="history-row"
                                        onClick={() => setSelected(r)}
                                        aria-haspopup="dialog"
                                    >
                                        <span className="history-main">
                                            {isPractice(r) && <span className="tag">Practice</span>}
                                            {r.engine === 'ai' && <span className="tag soft">AI-checked</span>}
                                            <span className="history-mode">{recordTitle(r)}</span>
                                            <span className="history-meta">{[r.language, r.topic, r.difficulty].filter(Boolean).join(' · ')}</span>
                                        </span>
                                        <span className="history-right">
                                            <span className={`score-chip ${scoreClass(r.codingScore)}`}>Coding <b>{r.codingScore}</b></span>
                                            {isPractice(r)
                                                ? <span className={`score-chip ${scoreClass(r.codingScore)}`}>Tests <b>{r.testsPassed}/{r.testsTotal}</b></span>
                                                : <span className={`score-chip ${scoreClass(r.communicationScore ?? 0)}`}>Communication <b>{r.communicationScore}</b></span>}
                                            <time className="history-date" dateTime={r.date}>{fmtDate(r.date)}</time>
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </section>
                        </Reveal>
                    </>
                )}
            </main>

            <Footer />

            {/* DETAIL DIALOG */}
            <Modal
                open={!!selected}
                onClose={() => setSelected(null)}
                label={selected ? `${recordTitle(selected)} details` : 'Details'}
            >
                {selected && (
                    <>
                        <button type="button" className="modal-close" aria-label="Close" onClick={() => setSelected(null)}>
                            <X size={16} aria-hidden="true" />
                        </button>
                        <h2>{isPractice(selected) ? recordTitle(selected) : `${recordTitle(selected)} interview`}</h2>
                        <p className="modal-sub">
                            {[fmtDate(selected.date), isPractice(selected) ? 'Practice' : '', selected.engine === 'ai' ? 'AI-checked' : '', selected.language, selected.topic, selected.difficulty].filter(Boolean).join(' · ')}
                        </p>

                        <div className="score-row">
                            <div className="score-card">
                                <div className={`score-value ${scoreClass(selected.codingScore)}`}>
                                    {selected.codingScore}<span className="score-max">/10</span>
                                </div>
                                <div className="score-label">Coding</div>
                            </div>
                            {isPractice(selected) ? (
                                <div className="score-card">
                                    <div className={`score-value ${scoreClass(selected.codingScore)}`}>
                                        {selected.testsPassed}<span className="score-max">/{selected.testsTotal}</span>
                                    </div>
                                    <div className="score-label">Tests passed</div>
                                </div>
                            ) : (
                                <div className="score-card">
                                    <div className={`score-value ${scoreClass(selected.communicationScore ?? 0)}`}>
                                        {selected.communicationScore}<span className="score-max">/10</span>
                                    </div>
                                    <div className="score-label">Communication</div>
                                </div>
                            )}
                        </div>

                        <div className="feedback-box">
                            <h3>
                                {isPractice(selected)
                                    ? <><ListChecks size={18} aria-hidden="true" /> {selected.testsPassed === selected.testsTotal ? 'Result' : 'Failed tests'}</>
                                    : <><NotePencil size={18} aria-hidden="true" /> Feedback</>}
                            </h3>
                            <ul>
                                {selected.feedbackPoints?.length
                                    ? selected.feedbackPoints.map((p, i) => <li key={i}>{p}</li>)
                                    : <li>No feedback recorded.</li>}
                            </ul>
                        </div>

                        <button type="button" className="btn btn-secondary btn-block" onClick={() => setSelected(null)}>Close</button>
                    </>
                )}
            </Modal>
        </div>
    );
}

export default Dashboard;
