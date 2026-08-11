# Category: `styling`

CSS lives in stylesheets, not inline; design tokens (colours, spacings,
fonts, radii, z-indexes) have one canonical home and are referenced by
name everywhere else. All detectors are **mechanical** (grep). Most
action items are **low-to-medium risk** — extractions and replacements,
no behaviour change.

Scope note: `styling` is the styling-layer specialisation of DRY + SSOT.
A duplicated colour literal is a token drift (SSOT); a duplicated class
body is class churn (DRY); an inline `style={{...}}` for a static rule
is a misplaced concern (SoC). All three surface here so they live next
to the styling fix recipe rather than scattered across `dry` / `ssot` /
`soc-yagni`.

## What counts as a violation

### A. Inline `style={{...}}` for static properties — mechanical
A React `style={{ ... }}` prop whose value is a literal object (or a
constant module-level object) — i.e. every property is fixed at write
time, none is computed per render from state. Belongs in a class / CSS
Module / token-bound rule.

Risk: low.

**Exception — genuinely dynamic styles.** A `style` whose values are
computed per render from props or state (e.g. `style={{ transform:
`translateX(${offset}px)` }}`) is fine, *but* only the dynamic
properties belong inline. Static siblings in the same object (e.g.
`color: '#333'` next to that `transform`) are still violations.

### B. Hard-coded design-token literals in JSX or stylesheets — mechanical
A colour (`#xxxxxx`, `rgb(...)`, `rgba(...)`, `hsl(...)`), spacing
(`Npx`, `Nrem`, `Nem` where N is a literal), border-radius, font-size,
or z-index that appears in two or more places without going through a
named token (CSS custom property, exported constant, or design-system
primitive).

The principle: the same literal should never appear in two files. Two
copies of `#7c5cff` is a drift bug waiting to happen — when the brand
colour shifts, one site updates and the other lags silently.

Risk: low-to-medium (one literal in one file is *not* a finding — wait
for the second occurrence; that's the SSOT cutoff).

### C. Duplicated CSS class body — mechanical seed, semantic confirm
Two or more class selectors with identical or near-identical rule sets
(same properties, same values, same order). Classic copy-pasted styling.

Risk: medium. The extraction is usually a shared class, a CSS
`@extend`-style composition (where available), or a utility token.

### D. Magic literal in CSS where a token would do — mechanical
A CSS rule that uses a raw colour or spacing literal *inside a
stylesheet that already imports / sees the token file*. The repo has a
custom-property home for the value; the rule should reference it.

Risk: low.

## Detection

All commands below use placeholders resolved per row of the `## Package
Layout` table in `AGENTS.md` (see SKILL.md Step 1.0). Substitute the
real path globs before running. Only packages whose path glob contains
UI source (TSX, JSX, CSS, SCSS) are scanned — skip pure type / DB /
domain packages.

### A — inline static `style={{...}}`

```bash
# Flag style={{ ... }} prop usages, then read each hit and decide:
#   - All properties literal strings/numbers → A finding (static inline).
#   - Mix of dynamic + static properties → A finding for the static ones only.
#   - All properties computed from variables → no finding (genuinely dynamic).
grep -rEn "style=\{\{" <pkg_root> --include="*.tsx" --include="*.jsx"
```

False positives to drop:

- The whole object is a single computed property
  (`style={{ transform: ... }}`).
- The value is a variable that flows in from props (`style={styleProp}`).
- The file is a test (`*.test.tsx`, `*.spec.tsx`).
- A storybook story file under `*.stories.tsx` — stories deliberately
  use inline styles to demo variants.

### B — hard-coded design-token literals across files

```bash
# Colour literals in JSX / TS / TSX
grep -rEn "#[0-9a-fA-F]{3,8}\b" <pkg_root> \
  --include="*.ts" --include="*.tsx" --include="*.jsx" --include="*.js"

# Colour literals in stylesheets
grep -rEn "#[0-9a-fA-F]{3,8}\b" <pkg_root> --include="*.css" --include="*.scss"

# rgb/rgba/hsl literals (JSX + CSS)
grep -rEn "(rgba?|hsla?)\(" <pkg_root> \
  --include="*.ts" --include="*.tsx" --include="*.jsx" --include="*.css" --include="*.scss"

# Spacing / size literals in JSX (units inside string literals or template parts)
grep -rEn "['\"\`][0-9]+(\.[0-9]+)?(px|rem|em)['\"\`]" <pkg_root> \
  --include="*.ts" --include="*.tsx" --include="*.jsx"
```

For each literal, count distinct occurrences across `<all_pkg_roots>`:

- 1 occurrence → not a violation (the SSOT rule kicks in on the second
  copy).
- 2+ occurrences → emit one finding per literal, listing every site.
- Already a named token (the literal appears once, inside a `:root` /
  `tokens.css` / exported constant module) → not a violation; the token
  IS the canonical home.

### C — duplicated class body

```bash
# Heuristic seed: collect class selectors and the line range of their rule
# body. Bodies that are identical when whitespace-normalised across files
# are duplication candidates. Confirm with eyes-on-code before flagging.
grep -rEn "^\s*\.[A-Za-z_][\w-]*\s*\{" <pkg_root> --include="*.css" --include="*.scss"
```

Then for each candidate pair: read both class bodies, normalise
whitespace, compare. Identical bodies under different selectors → finding.

Skip identical bodies that are different states of the same component
(`.button` vs `.button--disabled`); those genuinely differ at the
state-modifier level even if today's properties happen to overlap.

### D — magic literal where a token exists

```bash
# Find raw colour/spacing literals inside stylesheet files in a package
# whose <pkg_root> also contains a tokens.css / variables.css / a :root
# block. The token file IS the canonical home; raw literals elsewhere in
# the same package are violations.
grep -rln ":root" <pkg_root> --include="*.css" --include="*.scss"
# For each match, list the tokens defined (--custom-name: literal). Then
# grep the rest of the package's stylesheets for raw occurrences of those
# literals. Each hit is a D finding — replace with var(--custom-name).
```

## Action-item granularity

- **A** — one file per fix (one component, all inline-static styles in
  that component moved to a class / module). When several siblings in a
  small file share a single style, bundle into one item.
- **B** — one literal per fix (all sites for that literal listed in
  `files:`). The fix is "introduce token X with this value, replace
  every site". Mark `requires_decision: true` if the token's canonical
  home (which package owns the token file?) is not obvious from the
  call-site distribution.
- **C** — one duplicated class body per fix; both selectors named in
  `files:`. The fix is one extraction.
- **D** — one stylesheet per fix when many raw literals in the same
  file already have matching tokens. One literal per fix when the
  literal also appears in JSX (then merges with the matching B finding).

## Suggested fix shape

- **A** — move the static properties into:
  - the component's CSS Module (`.module.css`) and apply via
    `className={styles.foo}`, **or**
  - the package's global stylesheet under a named class, **or**
  - a design-system primitive that already covers the case.
  Keep only genuinely dynamic properties inline, on the same element.

- **B** — choose a name for the token (use the repo's existing token
  vocabulary if it has one — read `tokens.css` / `global.css` /
  `theme.ts` in the relevant package first). Define the token once in
  the canonical home. Replace every site with a reference. For JSX
  consumers of a CSS custom property, use `var(--token-name)` via a
  CSS class, not `style={{ color: 'var(--token-name)' }}` (that's a
  partial fix that re-introduces an A violation).

- **C** — extract the shared class to:
  - a private module in the same package (single-package duplication),
    **or**
  - the shared / global stylesheet if used from multiple packages.
  Replace both call sites with `className` references.

- **D** — replace the raw literal with `var(--token-name)` in CSS, or
  `tokens.foo` in TS-driven styles. Run `<typecheck>` and `<test>`.

## Scope rules (must appear verbatim in generated action items)

- No behaviour change — pixel-equivalent output before and after.
- For A: do not introduce new CSS files unless the package's convention
  already uses CSS Modules / global stylesheets in that location.
- For B: the token's canonical home is one file. Do not declare the
  same token in two packages — if multiple packages need it, the
  canonical home is whichever package they both can reach per the
  dependency direction in `AGENTS.md`.
- For C: extraction must preserve every property in the shared class
  body. If the two bodies are similar but not identical, this is *not*
  a C finding — record it under `dry.B` for semantic review.
- Update every cited site in the same commit. No leaving sites behind
  on the raw literal.

## Acceptance check

- `<typecheck>` and `<lint>` pass.
- `<test>` passes (visual regression / screenshot tests included if the
  repo has them).
- The raw literal / inline-style / duplicated class body is gone from
  every cited site.
- Token usage is reachable from every consumer (cross-package imports
  go through `index.ts` per the import rules — for CSS, the token file
  is loaded via the package's global stylesheet entry).
