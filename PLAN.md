# Minimal Floating Copy Canvas Plan

## Summary
Build a very simple `Next.js` canvas app with one central auto-growing text box and floating action buttons around it. The user pastes or writes copy, the box autosaves with a glow, then two floating option groups appear: `Tone` above the box and `Length` below it. The user can pick one option from each side, combine them, generate a new version, and keep expanding from that result.

No sidebars, no dashboards, no branch tree, no heavy panels.

## Core UI
- Full-screen light canvas with a subtle texture/grid and one restrained accent color.
- Center text box starts compact and expands vertically based on pasted copy, up to a comfortable max height.
- The text box remains the main object on screen, with soft shadow, 8px-ish radius, strong focus state, and readable typography.
- Corner FABs provide only utility actions:
  - `fullscreen`
  - `screenshot`
  - `copy`
  - `100% reset`
- After autosave completes, show floating option boxes:
  - top floating row: tone options such as `Professional`, `Friendly`, `Punchy`, `Persuasive`
  - bottom floating row: length options such as `Shorter`, `Same length`, `Expanded`, `Thread`, `One-liner`
- Selected top + bottom options form the generation combination.
- A compact floating `Generate` FAB appears once a valid combination is selected.
- Recent outputs appear only as tiny step dots or small chips near the bottom edge, not as a full history UI.

## Motion And Interaction Standards
- Text box autosave state uses a soft glowing ring that pulses while saving and settles into a brief saved shimmer.
- Tone boxes animate upward from the text box; length boxes animate downward.
- Option boxes use smooth fade/scale transitions and subtle stagger.
- Selected options feel tactile with a clear pressed state.
- Generated text replaces or expands from the current box with a short reveal transition.
- On narrow screens, floating rows wrap gracefully around the center box instead of becoming side panels.
- Respect `prefers-reduced-motion` by removing pulse, stagger, and reveal animations while keeping state changes clear.

## AI Flow
- Use OpenRouter through a server route such as `/api/generate-copy`.
- Client sends current copy, selected tone, selected length, user context, and recent steps.
- Server always applies the hygiene checklist before calling OpenRouter:
  - preserve meaning unless asked to change it,
  - do not invent facts,
  - respect required and banned phrases,
  - match selected tone and length,
  - remove fluff and repetition,
  - improve clarity and rhythm,
  - keep or strengthen CTA language when present,
  - return only the rewritten copy.
- Store draft, selected options, recent outputs, and user context in local browser storage.

## UI Standards From Build Web Apps
- Use a design-first implementation with a clean product-tool surface, not a landing page.
- Use accessible shadcn-style primitives where useful: `Button`, `ToggleGroup`, `Popover`, `Tooltip`, `Textarea`, `Toast`.
- Use semantic design tokens, not raw one-off color classes.
- Use icon buttons with tooltips for utilities.
- Keep controls real and functional; no decorative inactive UI.
- Verify at `800px`, desktop, and mobile widths.
- Avoid nested cards, heavy panels, purple-heavy palettes, and explanatory in-app text.

## Test Plan
- Paste long and short copy; text box grows without layout breaking.
- Autosave glow appears and resolves correctly.
- Tone boxes appear above after save.
- Length boxes appear below after save.
- Selecting tone + length enables generate.
- Generated copy updates the central box and adds a small recent-step chip.
- Fullscreen, screenshot, copy, and reset FABs work.
- Layout remains simple and usable at `800px`.
- Reduced-motion mode remains accessible and calm.

## Assumptions
- v1 keeps a single active copy chain, not a visual branching tree.
- The default interaction is `write -> autosave glow -> choose tone above -> choose length below -> generate`.
- User context exists but stays tucked away in a small settings/context FAB, not visible as a large panel.
