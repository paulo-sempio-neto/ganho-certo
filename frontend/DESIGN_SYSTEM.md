# Frontend visual foundation

Phase 46A preserves existing screens, calculations and API contracts. Future screen
work should use this foundation without introducing a parallel component library.

## Tokens

`src/styles/tokens.css` owns colors, typography, spacing, radii, shadows, control
heights and focus. `src/App.css` applies them to existing components.

- Neutral canvas/surfaces; green primary actions; blue information; amber attention;
  red errors. Choose colors by meaning, not by proximity to another screen.
- Use `--text-*`, `--weight-*` and `--leading-*` for type. No viewport-scaled text.
- Use the four-pixel `--space-*` scale (plus a two-pixel fine adjustment).
- Controls use six-pixel corners; existing surfaces use eight-pixel corners.
- Use tabular figures for amounts, durations and comparable metrics.
- Keep layout dimensions and chart geometry local to the relevant component.

## Existing patterns

| Pattern | Contract |
| --- | --- |
| `.button`, `.button-secondary`, `.button-ghost` | Commands; preserve native button type and disabled state. Links use the same styling only for navigation. |
| `.text-button` | Secondary command, visible keyboard focus and a minimum touch height. |
| Labeled native inputs/selects | Keep required/validation behavior. Associate any field-specific error using `aria-describedby` and `aria-invalid`. |
| `.metric-card` | Repeated financial metric, not a wrapper around whole page sections. |
| `.status-pill` with active/inactive state | Explicit status text; never rely on color alone. |
| `.empty-state` | No data or no matching records. Explain the situation and the existing next action. Not a loading indicator. |
| `FeedbackMessage` | `error`, `success`, `info` or `loading`; optional `compact`. Errors announce as alerts; other feedback as status. |

Use `FeedbackMessage` at the existing feedback location and preserve the original
condition that displays it. Do not make the entire application a live region.
Loading has its own indicator and respects reduced-motion preferences.
CSV file inputs remain keyboard accessible, with focus displayed on the dropzone.

## Financial certainty

`data-result-kind="realized|estimated|projected"` selects semantic metric styling.
Keep the visible Realizado, Estimado and Projetado labels and inclusion explanations.
Realized amounts have primary typographic weight; estimates and projections are
secondary. A negative amount retains its negative styling independently of its
certainty label. Styling must not change calculations or infer missing data.

## Validation

Run `npm run test` and `npm run build`. Token tests cover text/control contrast and
unresolved variables; component tests cover feedback semantics and result labels.
For shared CSS changes also check login/registration, daily entry, results, goals,
vehicles and account/plan at 320, 390, 1024 and 1440 px. Exercise Tab/Shift+Tab,
disabled controls, long amounts, loading/errors, reduced motion and CSV selection.
Use synthetic data for screenshots. A passing unit suite alone is not visual review.
