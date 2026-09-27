import { useEffect, useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, UploadSimple } from '@phosphor-icons/react';
import { useToast } from '../components/Toast';
import Footer from '../components/Footer';
import MatrixRain from '../components/MatrixRain';
import Modal from '../components/Modal';
import Reveal from '../components/Reveal';
import SiteNav from '../components/SiteNav';
import { ARENAS, type Arena, type ArenaCategory } from '../lib/modes';
import { API_URL } from '../config';
import { SERVER_UNREACHABLE } from '../lib/api';
import '../App.css';

// Arenas are grouped by the kind of loop they rehearse. Résumé mode is the
// one personalised arena, so it gets its own panel instead of a row.
const GROUPS: { category: ArenaCategory; title: string }[] = [
    { category: 'company', title: 'Company-style loops' },
    { category: 'domain', title: 'Specialist rounds' },
    { category: 'core', title: 'Generalist' },
];

const RESUME_ARENA = ARENAS.find((a) => a.resume);

function ArenaRow({ arena }: { arena: Arena }) {
    const ArenaIcon = arena.icon;
    return (
        <li>
            <Link to={`/interview/${arena.id}`} className="arena-row">
                <span className="arena-icon" aria-hidden="true"><ArenaIcon size={22} /></span>
                <span className="arena-text">
                    <span className="arena-title">{arena.title}</span>
                    <span className="arena-desc">{arena.desc}</span>
                </span>
                <span className="arena-meta">
                    <span className="arena-level">{arena.difficulty.label}</span>
                    {arena.tags && arena.tags.length > 0 && (
                        <span className="arena-topics">{arena.tags.map((t) => t.label).join(', ')}</span>
                    )}
                </span>
                <ArrowRight className="arena-go" size={18} aria-hidden="true" />
            </Link>
        </li>
    );
}

function Home() {
    const navigate = useNavigate();
    const showToast = useToast();
    const fileInputId = useId();

    // --- STATE FOR RESUME UPLOAD ---
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const scrollToHow = (e: React.MouseEvent) => {
        e.preventDefault();
        document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
    };

    // Backstop: kill any TTS still playing from an interview we just left.
    useEffect(() => {
        const kill = () => { window.speechSynthesis.resume(); window.speechSynthesis.cancel(); };
        kill();
        const id = setInterval(kill, 120);
        const stop = setTimeout(() => clearInterval(id), 1500);
        return () => { clearInterval(id); clearTimeout(stop); };
    }, []);

    // --- UPLOAD LOGIC ---
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile || isUploading) return;
        setIsUploading(true);

        const formData = new FormData();
        formData.append("file", selectedFile);

        let response: Response;
        try {
            response = await fetch(`${API_URL}/api/resume/upload`, {
                method: "POST",
                body: formData,
            });
        } catch (error) {
            console.error(error);
            showToast(SERVER_UNREACHABLE, 'error');
            setIsUploading(false);
            return;
        }

        try {
            if (!response.ok) throw new Error(`Upload failed (${response.status})`);
            const data = await response.json();
            setIsModalOpen(false);
            // Navigate to the room and pass the extracted text along in router state.
            navigate('/interview/Resume', { state: { resumeText: data.text } });
        } catch (error) {
            console.error(error);
            // Keep the dialog open so the user can pick another file.
            showToast("Couldn't read that PDF. Make sure it's a text-based PDF (not a scan) and try again.", 'error');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <>
            {/* ANIMATED BACKGROUND (outside .page so the page transition transform doesn't move it) */}
            <MatrixRain />

            <div className="page">

            {/* NAVBAR */}
            <SiteNav
                items={[
                    { label: 'How it Works', href: '#how-it-works', onClick: scrollToHow },
                    { label: 'Practice Problems', to: '/practice' },
                    { label: 'Dashboard', to: '/dashboard' },
                ]}
            />

            <main>
            {/* HERO: copy left, the real interview room right */}
            <header className="hero">
                <div className="hero-copy">
                    <h1 className="hero-title">
                        Rehearse the interview <span className="accent">out loud.</span>
                    </h1>
                    <p className="hero-sub">
                        Talk through your reasoning, code in a real editor, and get scored
                        on both by an AI interviewer.
                    </p>
                    <div className="hero-actions">
                        <Link to="/interview/Standard" className="btn btn-primary btn-lg">
                            Start interview <ArrowRight size={18} aria-hidden="true" />
                        </Link>
                        <Link to="/practice" className="btn btn-secondary btn-lg">
                            Practice Problems
                        </Link>
                    </div>
                </div>

                <figure className="hero-shot">
                    <a href="/interview-screen.png" target="_blank" rel="noreferrer" aria-label="Open the interview screenshot full size in a new tab">
                        <img
                            src="/interview-screen.png"
                            width={1307}
                            height={711}
                            fetchPriority="high"
                            alt="A MockMate session: a JavaScript solution to Longest Palindromic Substring in the editor on the left, the interviewer's problem statement and the Speak button on the right."
                        />
                    </a>
                </figure>
            </header>

            {/* Below the hero the rain fades behind a scrim so body text stays readable. */}
            <div className="home-lower">
            {/* HOW IT WORKS: one horizontal flow, not three cards */}
            <section id="how-it-works" className="section flow-section" aria-labelledby="how-title">
                <Reveal>
                <h2 id="how-title" className="section-title">How a session goes</h2>
                <ol className="flow stagger">
                    <li className="flow-step">
                        <h3>Pick an interviewer</h3>
                        <p>Company-style loops, specialist rounds, or questions drawn from your own résumé.</p>
                    </li>
                    <li className="flow-step">
                        <h3>Think out loud</h3>
                        <p>Answer by voice and write code in the editor. The interviewer follows along and pushes back in real time.</p>
                    </li>
                    <li className="flow-step">
                        <h3>Get scored</h3>
                        <p>End the session for coding and communication scores with notes you can act on, saved to your dashboard.</p>
                    </li>
                </ol>
                <p className="flow-note">
                    Voice works in Chrome and Edge. Everywhere else you can type your answers. JavaScript, TypeScript and Python run for real in your browser; the other languages are checked by AI.
                </p>
                </Reveal>
            </section>

            {/* ARENAS: featured résumé panel + grouped list */}
            <section className="section arenas" aria-labelledby="arena-title">
                <Reveal>
                <h2 id="arena-title" className="section-title">Choose your interviewer</h2>

                <div className="arenas-layout">
                    {RESUME_ARENA && (
                        <div className="resume-panel">
                            <span className="resume-icon" aria-hidden="true"><RESUME_ARENA.icon size={28} /></span>
                            <h3>{RESUME_ARENA.title}</h3>
                            <p>{RESUME_ARENA.desc}</p>
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => setIsModalOpen(true)}
                                aria-haspopup="dialog"
                            >
                                <UploadSimple size={18} aria-hidden="true" /> Upload résumé
                            </button>
                        </div>
                    )}

                    <div className="arena-groups">
                        {GROUPS.map((g) => {
                            const items = ARENAS.filter((a) => a.category === g.category && !a.resume);
                            if (items.length === 0) return null;
                            return (
                                <div key={g.category} className="arena-group">
                                    <h3 className="arena-group-title">{g.title}</h3>
                                    <ul className="arena-list">
                                        {items.map((a) => <ArenaRow key={a.id} arena={a} />)}
                                    </ul>
                                </div>
                            );
                        })}
                    </div>
                </div>
                </Reveal>
            </section>
            </div>
            </main>

            {/* FOOTER */}
            <Footer />

            {/* UPLOAD DIALOG */}
            <Modal open={isModalOpen} onClose={() => !isUploading && setIsModalOpen(false)} label="Upload your résumé">
                <h2>Upload your résumé</h2>
                <p className="modal-sub">PDF only. We extract the text and generate personalized, project-specific questions.</p>

                <label className="field-label" htmlFor={fileInputId}>Résumé (PDF)</label>
                <div className="file-drop">
                    <input
                        id={fileInputId}
                        type="file"
                        accept="application/pdf"
                        onChange={handleFileChange}
                        className="file-input"
                    />
                </div>

                <div className="modal-actions">
                    <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)} disabled={isUploading}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleUpload}
                        disabled={!selectedFile}
                        aria-disabled={isUploading}
                    >
                        {isUploading ? "Reading PDF…" : "Start interview"}
                    </button>
                </div>
            </Modal>

            </div>
        </>
    );
}

export default Home;
