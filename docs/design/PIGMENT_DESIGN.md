# nod Admin — "Pigment" Design Spec

> Governed by the Apple Design Skill (`.agents/skills/apple-design`). This spec is the
> point of view for the admin panel redesign. Every rule below maps to a cited HIG principle.

## 0. Why the previous change was "colors only"

The prior restyle swapped hues inside an unchanged skeleton. Three tell-tale signs from the
skill's craft lens (`SKILL.md › Lens 3`):

- **Aurora gradients** on the app and login background (`radial-gradient` blobs) — a default
  decoration with no reason rooted in the product.
- **"Welcome back, {Name}!"** — a template greeting that duplicates the page's own function.
- **A generic blue accent (#0071E3)** — Apple's value, not the brand's.

This spec replaces those defaults with a structure-shaping system, not a recolor.

## 1. Grounding

- **Product:** NOD Makeup — a cosmetics house. Admin panel for its e-commerce operations.
- **Audience:** store operators doing daily commerce work: orders, catalog, CRM, marketing, users.
- **The screen's single job:** run the whole store from one calm, legible command point.
- **Visual world drawn from the subject:** makeup's vernacular — *compact* (the black case),
  *pigment* (the colour carrying meaning), *swatch* (the chip that communicates shade/finish),
  *porcelain* (the canvas), *lacquer* (the one confident stroke).

## 2. Token system

### 2.1 Color — "Porcelain, compact, one pigment"

| Role | Light | Dark | Uses |
| --- | --- | --- | --- |
| Canvas | `#F6F4F1` | `#151310` | page background |
| Surface | `#FFFFFF` | `#211D1B` | cards, tables, fields |
| Ink (content) | `#1C1A18` | `#F3EFEA` | primary text (~15:1 on canvas) |
| Ink secondary | `#6E675F` | `#A89F94` | captions, meta (~4.7:1 light) |
| Lacquer (accent) | `#B61548` | `#FF8FA8` | links, active nav, focus (≥4.5:1 both) |
| Compact | `#1C1A18` | `#EDE9E4` | primary button fill (ink on white / ivory on dark) |
| Pigment set | blush/orchid, moss, sky, graphite | (brightened variants) | status, segments, categories — one colour, one meaning |

**Signal pigments (light / dark text pair):**

| meaning | pigment | text on light chip | chip on dark |
| --- | --- | --- | --- |
| pending / new | `#F7DFE7` | `#9E2A50` | `rgba(255,143,168,.16)` + `#FFB9C9` |
| delivered / active | `#DDF0E3` | `#1B6B42` | `rgba(88,204,138,.16)` + `#7FDCA4` |
| shipped / neutral | `#E7E3DE` | `#6E675F` | `rgba(168,159,148,.16)` + `#C9BFB2` |
| cancelled / draft | `#ECEAE7` | `#6E675F` | `rgba(168,159,148,.10)` + `#83786C` |
| refund / warn | `#FBEEDB` | `#8A5E14` | `rgba(255,191,87,.16)` + `#FFCF6B` |

Rules: one colour one meaning (`color.md › Meaning`); nothing conveyed by colour alone
(`accessibility.md › Color`); semantic vars, never hard-coded hex in the cascade layer
(`dark-mode.md › Dark Mode colors`).

### 2.2 Type — SF Pro, one family, tight scale

Body 13 px (macOS default, `typography.md › Font sizes`), Large Title 26 px / 700 / −0.022em,
Title 2 20 px / 600, Title 3 17 px / 600, Headline 15 px / 600, table heads & field labels
11 px / 600 / 0.06em uppercase, data 13 px with `font-variant-numeric: tabular-nums`.
Minimum ever used: 11 px. No light weights under 13 px (`Lens 1`).

### 2.3 Layout — "the counter"

Sidebar (the compact) + a slim toolbar + one wide surface to breathe on.

```
compact (264px, collapsible to 72px)   .  .  .  toolbar (64px, glass)
+----------------------------------+  +------------------------------+
| ◘  palettes                      |  | Large Title ......... [search][acct] |
| ▸ Overview                       |  +------------------------------+
|    Dashboard         ●            |                                     |
| ▸ Orders                         |  [ filters: ▫ All ▫ Pending ▫ ...]   |
|    Orders            ●            |  +──────────────────────────────────+
| ▸ Catalog                        |  |  card surface, cards, tables      |
|    Products                      |  |  generous gutters, stone-calm     |
|    Collections                   |  |                                  |
|    Categories                    |  |                                  |
|    Brands                        |  |                                  |
| ▸ Content / CRM / System         |  |                                  |
+----------------------------------+  +──────────────────────────────────+
```

- Sidebar floats as Liquid Glass with a 1 px **inlay hairline** rim and a soft edge
  (`sidebars.md › Best practices`, `materials.md › Liquid Glass`: glass only on the functional
  rail, never in content).
- Active nav = **Compact pill** (ink on light, ivory on dark) with the icon tinted — a clear
  "you are here" (`sidebars.md`).
- At most two levels; sections group; footer holds nothing critical (`sidebars.md › two levels`).
- Content max-width ~1600 px, section padding 2–2.5rem. Collapses honestly:
  992 px → overlay drawer; 480 px → search hides behind More.

### 2.4 Signature — "the swatch chip"

The single remembered element: **status, segment, and attribute colour always renders as a
pigment chip** — a small elliptical dye with a label — sized 18×10 px dot + 11 px label, hairline
ring on light surfaces. It appears in every table's status cell, the segment legend, KPI deltas,
and current-filter pills. Everything else stays quiet. Boldness spent in one place
(`SKILL.md › Lens 3`, `branding.md`).

Secondary signature: numbers use tabular figures and KPI values sit flush against a pigment
hairline, so the money reads like a printed receipt (`charting-data.md`).

### 2.5 Motion — one moment

Route change: content eases up 10 px with a 320 ms spring fade-in on `.admin-page-content`.
Press states scale to 0.985 (150 ms). Activated `prefers-reduced-motion` and `prefers-reduced-transparency` respected (`motion.md`, `dark-mode.md › Reduce Transparency`).

## 3. Critique of the plan (before proposing)

**Would I ship this for a different product?** The "matte black + ivory + one flush colour"
family is a known luxury shorthand, so on its own it *is* a default. What makes it specific is
the **swatch chip**: colour only ever appears as pigment with a label, mirroring the product's
own vocabulary (shade cards, finish swatches). That element belongs to NOD, not to a banking app.

**Check against templates flagged in the skill:** not warm-cream+serif (canvas is neutral, type
is SF, not serif); not near-black+acid accent (surfaces are porcelain, accent is a beauty
lacquer); not hairline-rules-zero-radius (chips and compacts carry soft radius, rails have one
lit seam). The aurora gradient and "Welcome back" greeting are removed.

**Platform check:** navigation is a sidebar drawer per `sidebars.md`; actions live in a toolbar
(`toolbars.md`); filters use segmented controls / pop-up menus (`segmented-controls.md`,
`styles.md`); destructive actions confirm in an alert-sheet (`alerts.md`); switches are iOS-style
(`toggles.md`). Conventions kept, identity borrowed — `branding.md › Personalisation`.

**Critique round 2 (removal):** the toolbar keeps only Search + account. The greeting, the
aurora, the countdown of every KPI chip down to two, and any gradient in content are removed.
Nothing left that can go without loss.

## 4. Concrete changes (sequenced: accessibility → conventions → craft → polish)

1. **Semantic token file** — rewrite `design-system/variables.css`: porcelain/compact/lacquer
   in light+dark, motion tokens, type scale; keep legacy var names so untouched modules inherit.
2. **Theme layer** — rewrite `Layout/apple-theme.css` as the Pigment theme (imported last):
   - Surfaces: canvas, cards, tables → porcelain/white; dark via vars only. No gradients in content.
   - Sidebar: Liquid Glass rail, inlay rim, Compact active pill, hover glints, collapse to 72 px.
   - Toolbar: 64 px glass, Large Title (now section-reactive), right-side actions.
   - Buttons: Compact primary (ink/ivory), secondary hairline, destructive red-text role,
     pressed scale, ≥36 px hit height on desktop (`buttons.md`, `Lens 1`).
   - Components: segmented control (orders status), iOS switch, search-field with clear,
     hairline tables + sticky headers + hover tint, pigment chips, frosted menu sheets,
     alert modal for destructive confirms, spinner/empty/error states per `feedback.md`.
   - Dark mode: every rule defined in `prefers-color-scheme: dark`.
3. **Structure edits (JSX, behaviour unchanged):**
   - `Header.js`: drop greeting → section title from route map + search trigger + account.
   - `AdminLayout.js`: collapsible compact (local state), content padding transition.
   - `OrderListPage.jsx`: status `<select>` → segmented control (scrollable); search gets a
     Clear button. API params untouched.
4. **Verify:** admin build, ESLint clean, orders filter/search/pagination API sweep unchanged,
   admin server serves the new build. Append `IMPLEMENTATION_LOG.md`.

## 5. Quality floor

- Responsive to 360 px width; sidebar becomes chart-overlay drawer ≤992 px.
- Keyboard focus visible (focus-visible ring in lacquer), controls ≥20 px targets on desktop.
- Light + dark both legible (numbers above); `prefers-reduced-motion` honoured.
- Original theme.css may still be imported by other apps; keep `variables.css` names stable.