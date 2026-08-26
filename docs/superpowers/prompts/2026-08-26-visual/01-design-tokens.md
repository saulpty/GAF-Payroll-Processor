# Connect the design tokens that are already declared

Two files only: **`src/index.css`** and **`src/tailwind.config.js`**. No
component, page or action may be touched.

`index.css` declares a full token set, but most of it is never wired into
Tailwind, so it has no effect. This change connects what exists and names the
status colours once. **No component changes yet** — those come later and will
consume these.

## 1. `src/tailwind.config.js`

### a. Wire the chart colours

`--chart-1` … `--chart-6` are declared and used by nothing. Add them inside
`theme.extend.colors` so `text-chart-1`, `bg-chart-3`, `stroke-chart-2` etc.
resolve:

```js
'chart-1': 'var(--chart-1)',
'chart-2': 'var(--chart-2)',
'chart-3': 'var(--chart-3)',
'chart-4': 'var(--chart-4)',
'chart-5': 'var(--chart-5)',
'chart-6': 'var(--chart-6)',
```

### b. Wire the shadow scale

`--shadow-2xs` … `--shadow-2xl` are declared and used by nothing: the config has
no `boxShadow` key, so the 45 `shadow-*` classes in the app currently render
Tailwind's stock defaults instead of these brand values. Add to `theme.extend`:

```js
boxShadow: {
  '2xs': 'var(--shadow-2xs)',
  xs:    'var(--shadow-xs)',
  sm:    'var(--shadow-sm)',
  DEFAULT:'var(--shadow)',
  md:    'var(--shadow-md)',
  lg:    'var(--shadow-lg)',
  xl:    'var(--shadow-xl)',
  '2xl': 'var(--shadow-2xl)',
  card:  'var(--shadow-card)',
},
```

This will make existing shadows very slightly softer and more consistent. That
is the intended effect.

### c. Add the status colours (see part 2 for the values)

Also inside `theme.extend.colors`:

```js
'status-green':  { fill: 'var(--status-green-fill)',  ink: 'var(--status-green-ink)',  tint: 'var(--status-green-tint)' },
'status-yellow': { fill: 'var(--status-yellow-fill)', ink: 'var(--status-yellow-ink)', tint: 'var(--status-yellow-tint)' },
'status-red':    { fill: 'var(--status-red-fill)',    ink: 'var(--status-red-ink)',    tint: 'var(--status-red-tint)' },
```

### d. Font stack — add a fallback, do not replace

`fontFamily.sans` currently begins with `var(--layout-text-font-family)`, a
variable UI Bakery injects at runtime. **It works — Inter is what actually
renders today, so do not remove it.** Insert `'var(--font-sans)'` immediately
after it as the second entry, keeping every existing entry in order after that.
That way the app still gets Inter from our own token if UIB ever stops injecting
its variable. Nothing should change visually.

### e. Delete the dead `sidebar` colour block

`theme.extend.colors.sidebar` references eight variables — `--sidebar`,
`--sidebar-foreground`, `--sidebar-primary`, `--sidebar-primary-foreground`,
`--sidebar-accent`, `--sidebar-accent-foreground`, `--sidebar-border`,
`--sidebar-ring` — **none of which are declared anywhere in the project**, and no
`sidebar-*` class is used in `src/app`. Remove the whole `sidebar: { … }` block.

Change nothing else in this file. Leave `darkMode`, `container`, `borderRadius`,
`keyframes`, `animation` and `plugins` exactly as they are.

## 2. `src/index.css`

Add a status block inside the existing `:root`, directly after the
`/* Chart colors */` group and before `/* Topnav */`. Keep the existing comment
style.

```css
  /* Status fills — the Excel conditional-format colours operators read.
     Deliberately kept: HR staff read these the way they read a spreadsheet.
     Defined once here instead of being retyped in four page files. */
  --status-green-fill:  #C6EFCE;
  --status-green-ink:   #006100;
  --status-green-tint:  #EDF7EE;
  --status-yellow-fill: #FFEB9C;
  --status-yellow-ink:  #9C6500;
  --status-yellow-tint: #FFFBEB;
  --status-red-fill:    #FFC7CE;
  --status-red-ink:     #9C0006;
  --status-red-tint:    #FFF0F0;
```

The fill and ink pairs are Excel's own conditional-format values, which is why
they look familiar. The tints are the lighter row backgrounds already used in
`ActionRequired.tsx` and `PayrollMaster.tsx`.

Change nothing else in `index.css` — leave the brand tokens, the keyframes, the
`.no-scrollbar` utility and the `.shadow-card` utility exactly as they are.

## Do not touch

- **No file under `src/app/` or `src/components/`.** This change adds capability;
  it does not consume it. A component that changes here is collateral damage.
- No action, no migration.
- Do not remove or rename any existing token in `index.css`.

## Acceptance criteria

- The app looks **essentially unchanged**. Shadows may be marginally softer; that
  is the only intended visible difference.
- Text still renders in Inter everywhere.
- Every page still loads: Dashboard, Process, Action Required, Payroll Master,
  HRK Summary, Period Log, PTO, Attendance, Admin.
- No console errors.

Then confirm every identifier used in each file is imported.
