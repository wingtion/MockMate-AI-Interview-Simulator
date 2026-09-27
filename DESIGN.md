---
name: MockMate
description: A dark, quiet recording studio for rehearsing technical interviews out loud.
colors:
  studio-black: "#0a0b0d"
  booth-dark: "#0e0f12"
  sunken: "#0c0d10"
  surface-1: "#141519"
  surface-2: "#1a1c22"
  surface-3: "#23252d"
  surface-hover: "#2c2f37"
  border: "rgba(255, 255, 255, 0.07)"
  border-strong: "rgba(255, 255, 255, 0.12)"
  text-1: "#f4f5f7"
  text-2: "#a8adb8"
  text-3: "#858a96"
  studio-mint: "#239978"
  studio-mint-hover: "#2fb592"
  studio-mint-press: "#1d8166"
  text-on-mint: "#03140f"
  rec-red: "#ff5f5f"
  text-on-rec: "#1d0707"
  amber: "#f5a623"
  data-secondary: "#c4c8d0"
  key: "#e6e8ec"
  key-hover: "#f4f5f7"
  key-press: "#d3d6dc"
  key-text: "#0a0b0d"
typography:
  display:
    fontFamily: "Geist Variable, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 5.5vw, 3.5rem)"
    fontWeight: 700
    lineHeight: 1.06
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Geist Variable, system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 3.4vw, 2.5rem)"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Geist Variable, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Geist Variable, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "-0.006em"
  body-sm:
    fontFamily: "Geist Variable, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Geist Variable, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.06em"
  mono:
    fontFamily: "Geist Mono Variable, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
    fontFeature: "\"tnum\" 1"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  full: "999px"
spacing:
  s-1: "4px"
  s-2: "8px"
  s-3: "12px"
  s-4: "16px"
  s-6: "24px"
  s-8: "32px"
  s-12: "48px"
  s-16: "64px"
  s-24: "96px"
components:
  button-primary:
    backgroundColor: "{colors.key}"
    textColor: "{colors.key-text}"
    rounded: "{rounded.sm}"
    height: "44px"
    padding: "0 24px"
  button-primary-hover:
    backgroundColor: "{colors.key-hover}"
  button-primary-active:
    backgroundColor: "{colors.key-press}"
  button-secondary:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text-1}"
    rounded: "{rounded.sm}"
    height: "44px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-2}"
    rounded: "{rounded.sm}"
    height: "36px"
  button-danger:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text-1}"
    rounded: "{rounded.sm}"
  button-danger-hover:
    backgroundColor: "rgba(255, 95, 95, 0.1)"
  input:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text-1}"
    rounded: "{rounded.sm}"
    height: "44px"
    padding: "0 12px"
  card:
    backgroundColor: "{colors.surface-1}"
    rounded: "{rounded.md}"
    padding: "24px"
  modal:
    backgroundColor: "{colors.surface-1}"
    rounded: "{rounded.lg}"
    padding: "32px"
  tag:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.text-2}"
    typography: "{typography.mono}"
    rounded: "{rounded.sm}"
  arena-row:
    backgroundColor: "transparent"
    textColor: "{colors.text-1}"
    padding: "16px 12px"
  arena-row-hover:
    backgroundColor: "{colors.surface-1}"
  mic-button:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.text-1}"
    rounded: "{rounded.full}"
    height: "48px"
    padding: "0 24px 0 16px"
  mic-button-recording:
    backgroundColor: "{colors.rec-red}"
    textColor: "{colors.text-on-rec}"
---

# Design System: MockMate

## Overview

**Creative North Star: "The Recording Studio"**

MockMate is a booth you step into to rehearse. The room is dark and quiet so your voice and your code carry the session; color appears only when something is happening. When you speak, the red recording light comes on. When the interviewer answers, the room glows mint. Everything else stays neutral, so a state change is impossible to miss and never competes with decoration.

The system is dark-only by decision: an editor-centred practice tool used at a desk, often for long sessions. All color is expressed as CSS custom properties on `:root` so a light theme can be added later by redefining tokens, never by editing components. Density is calm on the marketing surface and moderately dense inside the interview room, where scanability of the chat, editor, and console beats expression.

The Matrix rain on the Home page is a deliberate, retained signature of the current build. It sits behind content at reduced opacity, is tinted from the accent token, and stops entirely under reduced motion.

**Key Characteristics:**
- One accent (Studio Mint) that means "the interviewer is speaking", never "click me".
- Buttons are console keys: off-white or dark, bevelled, no glow.
- Red is reserved for recording and errors; it is a state, never a decoration.
- Geist for the interface, Geist Mono only for code, data, timers, and scores.
- Three radii, one rule per role; no gradients on text, no side-stripe borders.
- Real controls everywhere: every clickable thing is a `<button>` or a link and has a visible focus state.

## Colors

A neutral cool-grey studio with a single mint signal light and a red recording lamp.

### Primary
- **Studio Mint** (`studio-mint`): the "AI is speaking" state (voice status, visualizer, the interviewer's name in the transcript), links, focus rings, selection, the AI-estimated tag, the headline emphasis, the résumé panel, good scores, and the coding series in charts. It is not a button fill. Deliberately shifted cooler and deeper than the Supabase green the project started from, so the brand is its own.

### Keys
- **Console Key** (`key`, `key-hover`, `key-press`, text `key-text`): the primary button. An off-white key with a light top edge and a darker bottom edge; it has no brand color on purpose, so the one mint thing on screen is always a signal.

### Secondary
- **Rec Red** (`rec-red`): the microphone while recording, the live-session dot, destructive actions, error text, and low scores. Text on a red fill uses `text-on-rec`; white on this red fails contrast.
- **Amber** (`amber`): mid-range scores and medium difficulty only.
- **Data Secondary** (`data-secondary`): the communication series in charts (dashed line) so charts do not introduce a second accent hue.

### Neutral
- **Studio Black** (`studio-black`): page background.
- **Booth Dark** (`booth-dark`): the chat pane and editor background.
- **Sunken** (`sunken`): the output console well.
- **Surface 1 / 2 / 3** (`surface-1`, `surface-2`, `surface-3`): cards and panels, inputs and nested blocks, chips and icon tiles. `surface-hover` is the hover step above surface-3.
- **Border / Border Strong**: 7% and 12% white hairlines. Hover borders step to 18% white.
- **Text 1 / 2 / 3**: primary text, secondary text, muted text. Text 3 is the floor for anything a person must read; it passes AA (about 5.7:1 on the page, 5:1 on surface-2).

### Named Rules
**The Signal Light Rule.** Color reports state. Mint means the interviewer is talking or an action is primary; red means you are recording or something failed. If an element is colored and nothing is happening, remove the color.

**The One Accent Rule.** There is no blue, violet, or second brand hue. Categories, tags, and chart series distinguish themselves with neutrals, weight, and line style.

**The Readable Floor Rule.** No readable text uses a color below `text-3`, and no text is smaller than 12px.

## Typography

**Display Font:** Geist Variable (with system-ui)
**Body Font:** Geist Variable (with system-ui)
**Label/Mono Font:** Geist Mono Variable (with ui-monospace)

**Character:** A precise, engineered sans that reads like a well-made developer tool, paired with its own mono for code and numbers so the two never clash. Both are self-hosted through Fontsource.

### Hierarchy
- **Display** (700, `clamp(2.5rem, 5.5vw, 3.5rem)`, 1.06): the Home hero headline only. Emphasis is a solid Studio Mint span, never a gradient.
- **Headline** (700, `clamp(1.75rem, 3.4vw, 2.5rem)`, 1.12): page and section titles.
- **Title** (600, 1.375rem, 1.2): card headings, modal titles.
- **Body** (400, 1rem, 1.55): running text, max 65ch.
- **Body Small** (400, 0.875rem, 1.55): chat messages, descriptions, helper text.
- **Label** (600, 0.75rem, 0.06em tracking, uppercase): form field labels and score labels only.
- **Mono** (400, 0.875rem, tabular figures): code, console output, the session timer, scores, language badges, tags.

### Named Rules
**The Mono Means Measurement Rule.** Mono is for code, data, and time. It is never used to make prose look technical.

**The No Eyebrow Rule.** No small uppercase kicker above a heading. The heading carries itself.

## Layout

A 4px base spacing scale with the steps 4, 8, 12, 16, 24, 32, 48, 64, 96 (`--s-1` through `--s-24`). Marketing sections are contained at 1180px with a 24px gutter (16px under 600px) and separated by 96px. The interview room is a full-viewport split: editor pane (flex 1.15) and chat pane (flex 0.85, max 520px); conversation-only modes centre a single 760px chat column. Viewport heights use `dvh` so mobile browser chrome does not cause jumps.

Breakpoints: 900px (hero stacks; the résumé panel moves above the arena list), 768px (interview panes stack, the dock becomes fixed; session flow stacks), 600px (single column; navbar collapses to logo plus primary action; arena metadata moves under the description). On any touch screen (`pointer: coarse`, tablets included) and at 768px and below, every button, select, and close control is at least 44px.

## Elevation & Depth

Depth comes mainly from tonal layering (studio-black, surface-1, surface-2, surface-3) plus hairline borders. Shadows are soft, offset, and dark, and are reserved for things that float: modals, the lobby card, toasts, and hovered arena cards.

### Shadow Vocabulary
- **Small** (`box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4)`): resting primary buttons.
- **Medium** (`box-shadow: 0 6px 22px rgba(0, 0, 0, 0.38)`): hovered cards.
- **Large** (`box-shadow: 0 20px 56px rgba(0, 0, 0, 0.55)`): dialogs, lobby card, toasts.
- **Key bevel** (`--key-bevel`, `--key-bevel-dark`): a 1px light top edge, a 2px darker bottom edge and a tight drop shadow on buttons; pressing swaps it for an inset shadow (`--key-pressed`) and sinks the key 1px. No colored glow on any button.

### Named Rules
**The Flat At Rest Rule.** Cards are flat until they are hovered or focused; only floating layers carry a shadow at rest.

## Shapes

Three radii, one per role. Controls (buttons, inputs, selects, tags, icon tiles) use 8px. Containers (cards, panels, chat messages, notes, the chat log) use 12px. Floating layers (dialogs, lobby card, report) use 16px. Full rounding is only for the mic button, status pills, and dots. Borders are always 1px; a thicker colored edge on one side is never used.

## Components

### Buttons
- **Shape:** gently squared (8px).
- **Primary:** off-white console key (`key` with `key-text`), 44px tall (52px for `btn-lg`, 36px for `btn-sm` with a mouse, 44px on touch). One primary action per view: in the interview room that is Run, so Send is secondary; in Practice it is Check, so Run and Generate are secondary. Run and Check sit together in a `.run-group` that takes its own full-width row on phones.
- **Hover / Focus:** hover brightens the key; press sinks it 1px with an inset shadow. Nothing lifts, scales, or glows. Keyboard focus shows a 2px mint outline offset by 2px.
- **Secondary:** the same key in the dark (surface-2, strong border, dark bevel). **Ghost:** transparent with a `border-strong` edge so it still reads as a button in toolbars. **Danger (End):** a dark key whose only red is its stop icon; on hover the key tints red.
- **Named rule: The Console Key Rule.** A button looks like hardware, not like a brand. Color on a control means state (recording, error), never emphasis.
- **Busy:** while an action runs (Run, Generate, Connecting, Reading PDF) the button uses `aria-disabled="true"`, never `disabled`, so keyboard focus stays on it; it dims to 45% and the handler ignores repeat presses. `disabled` is only for "not possible yet" (no file chosen, not connected).
- **Navigation vs action:** anything that only changes the page is a link styled as a button; `<button>` is for actions (including Exit in the interview room, which tears the session down).
- **Dialog action rows:** wrap instead of overflowing; under 600px they stack full width with the primary on top.
- **Destructive edits:** Reset clears the editor immediately and offers **Undo** in the toast instead of asking first.
- **Icons:** Phosphor, 16px in small buttons and 18px in large ones, placed before the label (arrows after).

### Chips / Tags
- **Style:** mono, 12px, surface-3 with a hairline border. The only colored variant is the mint `soft` tag used for "AI-estimated". Difficulty is plain mono text, never a colored pill (Signal Light Rule).

### Cards / Containers
- **Default is no card.** Sections are separated by a 1px rule (`border-strong`) and spacing, lists by hairlines between rows. A container earns a box only when it is a distinct object: the résumé panel, a dialog, the lobby card.
- **When boxed:** 12px radius, surface-1, 1px `border`, 24-32px padding, flat at rest.

### Named Rules
**The Ruled Not Boxed Rule.** Before adding a card, try a rule line and space. Never nest a card inside a card.

### Inputs / Fields
- **Style:** surface-2 fill, 1px strong border, 8px radius, 44px tall. Labels sit above the field and are real `<label>` elements tied to the control; placeholder is never the label.
- **Focus:** mint border at 35% plus a 3px mint ring at 12%.
- **Disabled:** 50% opacity with a not-allowed cursor.

### Navigation
- **Style:** sticky 64px bar with a translucent studio-black background and blur, a hairline bottom rule, and real links. Links are text-2, turning text-1 on a surface-2 pill when hovered or focused. The single call to action is labelled "Start interview" everywhere in the product.
- **Mobile:** under 600px the text links collapse into a 44px Menu button beside "Start interview"; it opens a dropdown of 48px rows that closes on Escape, a link tap, or a tap outside. Shared component: `components/SiteNav.tsx`.
- **Toolbars on phones:** secondary tool buttons (Exit, Copy, Reset) become 44px icon-only keys with their label kept for screen readers; the primary action (Run, Generate) keeps its label. In Practice, Generate takes its own full-width row.
- **Reveal-on-scroll:** content is only hidden until any pixel enters the viewport, and never hidden under reduced motion or without IntersectionObserver.

### Dialogs
- Built on the native `<dialog>` element opened with `showModal()`, so focus moves in, stays in, and returns to the trigger on close. Escape and a backdrop click close dismissible dialogs; the report-loading dialog is not dismissible.

### Output Console (signature)
- A sunken mono well under the editor. Its tag says how the output was produced: **Executed** (run in the browser: JavaScript, TypeScript, Python), **AI-estimated** (output predicted by the AI: the other languages, SQL, YAML) or, on the Practice Tests tab, **AI-checked** (return values predicted by the AI and graded by the server), with a one-line note. Errors, including compiler output, render in Rec Red.
- **Tests view (Practice):** Output and Tests tabs; the selected tab gets a surface-2 fill and a 2px text-1 underline, and the Tests tab shows a pass count colored by band. Results are a ruled list: pass/fail icon (mint / Rec Red), the call in mono, and for failures an Expected / Got pair (or the error, or "nothing" for a missing return), plus any printed lines; the summary shows the total run time. A note under the problem says whether the tests were confirmed by the hidden reference solution.

### Home Hero
- Two columns: copy (max 430px) aligned with the logo on the left; the real interview-room screenshot (`public/interview-screen.png`) on the right, reaching half a gutter past the content edge (never closer than 32px to the viewport edge) so the UI inside stays legible. 16px rounding on all corners; it links to the full-size image in a new tab. Under 900px it stacks. No glow blobs, no fake browser chrome.

### Session Flow ("How a session goes")
- One ruled row of three steps, read left to right; the first 48px of the rule is lit mint. Headings are verb phrases, no numbers, no cards. Stacks under 768px.

### Arena List (signature)
- A sticky résumé panel (the one personalised arena, mint-tinted, 12px radius) beside grouped rows: "Company-style loops", "Specialist rounds", "Generalist". Each row is a link: 40px neutral icon tile, title and description, mono difficulty and topics on the right, arrow that turns mint on hover or focus. Rows are separated by hairlines and highlight to surface-1.

### Interview Room
- **Header:** persona, session clock, End; a plain row with a bottom rule, aligned with the editor toolbar.
- **Transcript:** interviewer turns are plain text under a mint name label; your turns are right-aligned surface-2 bubbles. No card around the log. New messages scroll the transcript itself, never the page; on phones it is capped at 60dvh so the editor stays put.
- **Editor:** Monaco is pinned to its wrapper with absolute positioning (`.iv-editor-wrap > section`), because its `height: 100%` collapses in the stacked phone layout.
- **Dock:** text input above a voice bar, separated from the transcript by a rule. Under 768px the dock is fixed to the bottom of the screen while a session is live, so the mic is reachable from the editor.

### Mic Button (signature)
- A 48px pill with an icon and a visible label ("Speak", "Stop & send"). At rest it is surface-3; while recording it fills Rec Red and pulses. The visualizer beside it is red while recording and mint while the interviewer speaks.

### Dashboard Summary
- One sentence summarises history ("Across 4 interviews you average 6.8 in coding..."), numbers in mono and colored by score band. It replaces metric tiles; the chart and history follow as ruled sections.

## Do's and Don'ts

### Do:
- **Do** keep exactly one primary (off-white) key per view, and keep `studio-mint` for the interviewer-speaking state and other signals.
- **Do** keep every interactive element a `<button>` or a link with a visible `:focus-visible` state that matches its hover.
- **Do** label code output as AI-estimated wherever it appears.
- **Do** use Phosphor icons in one weight (regular) instead of emoji or Unicode glyphs.
- **Do** read colors from CSS tokens in canvas, SVG, and Monaco code instead of hard-coding hex values.
- **Do** keep reduced-motion users informed: state changes fade instead of moving; nothing important disappears.

### Don't:
- **Don't** use gradient text, a thick one-sided border, or a second accent hue.
- **Don't** put readable text below `text-3` or smaller than 12px.
- **Don't** use white text on Rec Red.
- **Don't** use em-dashes in interface copy.
- **Don't** put an uppercase eyebrow above a heading.
- **Don't** fake product chrome (made-up URLs, window dots) around screenshots.
- **Don't** build a page from grids of identical cards or big-number metric tiles.
