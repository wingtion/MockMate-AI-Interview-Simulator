/* eslint-disable @typescript-eslint/no-explicit-any */
import { cssToken } from './tokens';

// Monaco theme that matches the app palette. Call from the editor's `beforeMount`.
// Monaco needs literal hex values, so they are read from the CSS tokens at mount.
export function defineMockmateTheme(monaco: any) {
    const bgElev = cssToken('--bg-elev', '#0e0f12');
    const surface1 = cssToken('--surface-1', '#141519');
    const surface3 = cssToken('--surface-3', '#23252d');
    const text2 = cssToken('--text-2', '#a8adb8');
    const accent = cssToken('--accent', '#239978');

    monaco.editor.defineTheme('mockmate-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: {
            'editor.background': bgElev,
            'editorGutter.background': bgElev,
            'editor.lineHighlightBackground': '#16171b',
            'editorLineNumber.foreground': '#5c616d',
            'editorLineNumber.activeForeground': text2,
            'editor.selectionBackground': '#1f4a40',
            'editorCursor.foreground': accent,
            'editorWidget.background': surface1,
            'editorWidget.border': surface3,
            'editorIndentGuide.background1': '#1c1d22',
        },
    });
}

// Shared Monaco options for the Interview and Practice editors.
export const EDITOR_OPTIONS = {
    automaticLayout: true, // re-measure on container resize (fixes collapsed editor on mobile / layout changes)
    minimap: { enabled: false },
    fontSize: 15,
    padding: { top: 16 },
    smoothScrolling: true,
    cursorBlinking: 'smooth' as const,
    fontLigatures: true,
    fontFamily: "'Geist Mono Variable', ui-monospace, 'SF Mono', monospace",
    scrollBeyondLastLine: false,
    roundedSelection: true,
};
