# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two primary audiences, weighted equally:

- **Developers preparing for technical interviews** (students, juniors, career switchers, working engineers brushing up). They use MockMate alone, usually at a desk with a mic, to rehearse the pressure of a live interview: talking through their reasoning, writing code while observed, and getting a scored verdict afterwards.
- **Recruiters and hiring managers evaluating the author.** MockMate is also the author's flagship full-stack/AI portfolio piece. These visitors arrive from GitHub or LinkedIn, often briefly, and judge engineering depth and product judgement from what they see and can try.

## Product Purpose

MockMate simulates a technical interview end to end: pick an interviewer, speak your answers aloud, write code in a real editor, and receive coding and communication scores with actionable feedback. It exists so candidates can practice the *performance* of an interview (thinking aloud under observation), not just solve problems silently.

Success means a practice session feels close enough to a real interview to be useful, the feedback is specific enough to act on, and a portfolio visitor can reach a live, working interview in seconds.

## Positioning

A voice-first, persona-driven interview rehearsal: the AI listens to you speak, reads the code in your editor, reacts in real time over a live connection, and scores both coding and communication. Neighbouring tools are mostly silent problem banks (solve, submit, pass/fail); MockMate's claim is rehearsing the conversation around the code.

## Operating Context

- Browser-based SPA; voice requires Chrome or Edge (Chromium Web Speech API for speech-to-text and text-to-speech). Other browsers must degrade gracefully.
- Flow: Home (arena selection) → Interview lobby (persona, language) → live Interview (mic, AI voice replies, Monaco editor, output console) → End session → scored report → Dashboard (history, stats, trend chart).
- Separate self-paced **Practice** page: generate a problem by topic and difficulty, solve it solo, and press **Check** to run the solution against tests. Each checked problem is saved to the Dashboard (best attempt per problem).
- **Résumé mode**: upload a PDF; its text is extracted and used to ask project-specific questions.
- No accounts. Interview and practice history lives in the browser's `localStorage` only.
- Deployment: React/Vite frontend on Netlify, .NET 9 API + SignalR hub on Fly.io with a machine that suspends when idle (roughly 1s cold resume; first request after idle may be slower).

## Capabilities and Constraints

- **Arenas (interview modes)** are defined in `mockmate-ui/src/lib/modes.ts` and must stay in sync with backend personas in `GroqAiService` by `id`: Google Algorithms, Grill My Résumé, Meta Frontend, System Design, SQL & Data, Amazon Leadership, DevOps & Cloud, Startup Velocity. Some are conversation-only (no editor); some fix the editor language (SQL, YAML).
- **Company-named arenas are open to reframing** as style-based labels (e.g. "Big-Tech algorithms") if design or legal reasons call for it. The `id` contract with the backend must be preserved or migrated together.
- **Code execution: two engines, labelled in the UI.** JavaScript, TypeScript and Python run for real in the visitor's browser (Web Workers; sucrase strips TypeScript types; Pyodide runs Python). Java, C#, C++, Go and Rust are not run: for Practice Run/Check the AI predicts what the code returns for each test without seeing the expected answers, and the server compares the prediction with the answer (tagged "AI-checked"); for the interview room's Run it predicts the printed output (tagged "AI-estimated"), as it does for the SQL and YAML arenas. Server-side AI calls share the Groq free tier, and the API limits each visitor to 20 per 10 minutes. The interview room has Run only, no Check.
- **Practice problems are typed and tested.** Generation returns a typed signature (int, double, string, bool, 1-D arrays of those, 2-D int/string arrays), JSON test cases, a hidden JavaScript reference solution, and a starter for each language. The server wraps the candidate's code in a per-language harness that runs every test in one submission and compares the returned values. The browser runs the reference once when a problem is generated and drops any test whose AI-written expected answer it contradicts; if the reference fails, tests are shown as unverified. There is no curated problem bank.
- LLM: Groq, model set by the `GroqModel` setting (default `openai/gpt-oss-20b`; Groq retires models, which is why it is configurable). The free tier allows 8,000 tokens per minute shared by every feature. Responses can be slow, rate-limited, or unavailable; every AI-dependent surface needs loading, failure, and retry states.
- Editor languages: JavaScript, TypeScript, Python, Java, C#, C++, Go, Rust (plus fixed SQL/YAML per arena).
- Scores: coding and communication, plus written feedback, per interview.
- Roadmap (undecided, not shipped): account-based persistent history, shareable/downloadable report cards.
- Terminology in use: "arena" for an interview mode, "persona" for the interviewer, "Practice" for solo mode, "Dashboard" for history.

## Brand Commitments

- Name: **MockMate**. Tagline in use: "AI Interview Simulator".
- Author credit: Doğan Süle, with GitHub and LinkedIn links (footer, README). Keep the attribution; it serves the portfolio audience.
- Existing assets: `mockmate-ui/public/favicon.svg`, `og-image.png` / `og-image.svg`, `demo.svg`.

## Evidence on Hand

- A working, deployed product and a real demo illustration (`mockmate-ui/public/demo.svg`).
- No user counts, testimonials, company endorsements, success rates, or hiring outcomes exist. Future work must not fabricate any of these, and must not imply affiliation with or endorsement by Google, Meta, Amazon, or any other company named in an arena.

## Product Principles

1. **Rehearse the conversation, not just the code.** Voice, thinking aloud, and communication scoring are the core; features that reduce MockMate to a silent problem bank dilute it.
2. **Honest about the machinery.** Say what is AI-estimated (code output, scores) and what is real. Credibility with both candidates and technical recruiters depends on it.
3. **Seconds to a live interview.** A first-time or portfolio visitor should reach a working session with minimal setup: no account, clear browser/mic requirements up front.
4. **Feedback must be actionable.** Scores are only useful alongside specific notes the candidate can act on in the next session.
5. **Degrade gracefully.** Unsupported browsers, denied mic permission, a cold-starting API, or a busy LLM are expected conditions, not edge cases.
