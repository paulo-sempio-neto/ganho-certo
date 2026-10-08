# Frontend visual foundation

Phase 46A+ evolves the visual identity toward precision, movement and confidence —
giving drivers clarity and control over their money. Screens, calculations and API
contracts are preserved. Future screen work should use this foundation without
introducing a parallel component library.

## Visual personality

Financial precision through monospaced tabular figures and tight tracking on
amounts. Confidence through bold hierarchy and generous whitespace. Movement
through intentional transitions on interactive elements. The green brand color
(`--color-brand: #147a4a`) signals trust and financial health.

## Tokens

`src/styles/tokens.css` owns colors, typography, spacing, radii, shadows, controls,
focus and motion. `src/App.css` applies them to existing components.

- Neutral canvas/surfaces; green primary actions; blue information; amber attention;
  red errors. Choose colors by meaning, not by proximity to another screen.
- Use `--text-*`, `--weight-*`, `--leading-*` and `--tracking-*` for type. No
  viewport-scaled text. Headings use `--tracking-tight`; eyebrow labels use
  `--tracking-wide`.
- Use `--font-mono` (JetBrains Mono fallback chain) for financial figures via
  the tabular-nums rule.
- Use the four-pixel `--space-*` scale (plus a two-pixel fine adjustment).
- Controls use eight-pixel corners (`--radius-control`); surfaces use twelve-pixel
  corners (`--radius-surface`); prominent cards use sixteen-pixel corners
  (`--radius-card`).
- Use tabular figures for amounts, durations and comparable metrics.
- Transitions use `--ease-out` (fast deceleration) for enter animations and
  `--ease-in-out` for state changes. Always respect `prefers-reduced-motion`.
- Shadows progress through four levels: `--shadow-sm`, `--shadow-panel`,
  `--shadow-card` and `--shadow-elevated`.
- Keep layout dimensions and chart geometry local to the relevant component.

## Existing patterns

| Pattern | Contract |
| --- | --- |
| `.button`, `.button-secondary`, `.button-ghost` | Commands; preserve native button type and disabled state. Includes hover lift, active press (`scale(0.98)`), and focus ring. Links use the same styling only for navigation. |
| `.text-button` | Secondary command, visible keyboard focus and a minimum touch height. |
| Labeled native inputs/selects | Keep required/validation behavior. Associate any field-specific error using `aria-describedby` and `aria-invalid`. Inputs show brand-subtle glow on focus and danger-surface glow on invalid focus. Hover raises border contrast. |
| `.metric-card` | Repeated financial metric with monospaced figures, not a wrapper around whole page sections. White background by default; result-kind cards get colored top border and tinted surface. |
| `.status-pill` with active/inactive state | Explicit status text with wide tracking; never rely on color alone. |
| `.empty-state` | No data or no matching records. Centered text with dashed border. Explain the situation and the existing next action. Not a loading indicator. |
| `FeedbackMessage` | `error`, `success`, `info` or `loading`; optional `compact`. Errors announce as alerts; other feedback as status. |

Use `FeedbackMessage` at the existing feedback location and preserve the original
condition that displays it. Do not make the entire application a live region.
Loading has its own indicator and respects reduced-motion preferences.
CSV file inputs remain keyboard accessible, with focus displayed on the dropzone.

## Financial certainty

`data-result-kind="realized|estimated|projected"` selects semantic metric styling.
Keep the visible Realizado, Estimado and Projetado labels and inclusion explanations.
Realized amounts have primary typographic weight (`--weight-extrabold`); estimates
and projections are secondary. A negative amount retains its negative styling
independently of its certainty label. Styling must not change calculations or infer
missing data.

## Validation

Run `npm run test` and `npm run build`. Token tests cover text/control contrast and
unresolved variables; component tests cover feedback semantics and result labels.
For shared CSS changes also check login/registration, daily entry, results, goals,
vehicles and account/plan at 320, 390, 1024 and 1440 px. Exercise Tab/Shift+Tab,
disabled controls, long amounts, loading/errors, reduced motion and CSV selection.
Use synthetic data for screenshots. A passing unit suite alone is not visual review.
