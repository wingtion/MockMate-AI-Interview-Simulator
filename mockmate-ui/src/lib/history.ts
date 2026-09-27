// Client-side history (localStorage): finished interviews and checked practice problems.
// Kept deliberately small so it can later be swapped for a real API without
// touching the dashboard UI; the function shapes stay the same.

export interface InterviewRecord {
    id: string;
    date: string; // ISO timestamp
    kind?: 'interview' | 'practice'; // missing on records saved before practice existed = interview
    mode: string;
    language: string;
    topic?: string;
    difficulty?: string;
    codingScore: number;
    communicationScore?: number; // interviews only
    feedbackPoints: string[];
    // practice only
    problemId?: string;
    problemTitle?: string;
    testsPassed?: number;
    testsTotal?: number;
    engine?: 'browser' | 'ai'; // "ai" = checked by AI, not run (Java, C#, C++, Go, Rust)
}

export type NewInterviewRecord = Omit<InterviewRecord, 'id' | 'date'>;

const STORAGE_KEY = 'mockmate.history.v1';

export const isPractice = (r: InterviewRecord) => r.kind === 'practice';

export function getHistory(): InterviewRecord[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as InterviewRecord[]) : [];
    } catch {
        return [];
    }
}

function write(list: InterviewRecord[]) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
        // storage full / unavailable: non-fatal
    }
}

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

export function saveRecord(data: NewInterviewRecord): InterviewRecord {
    const record: InterviewRecord = { id: newId(), date: new Date().toISOString(), ...data };
    write([record, ...getHistory()]);
    return record;
}

// Practice keeps one record per problem, holding the best attempt: checking the
// same problem again only replaces it when at least as many tests pass (so a
// later, broken edit can't erase a solved problem).
export function savePracticeResult(data: NewInterviewRecord & { problemId: string }): InterviewRecord {
    const history = getHistory();
    const existing = history.find((r) => r.problemId === data.problemId);
    if (existing && (existing.testsPassed ?? 0) > (data.testsPassed ?? 0)) return existing;
    const others = history.filter((r) => r.problemId !== data.problemId);
    const record: InterviewRecord = { id: newId(), date: new Date().toISOString(), ...data, kind: 'practice' };
    write([record, ...others]);
    return record;
}

export function clearHistory(): void {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch {
        /* noop */
    }
}
