# UI Guide

Reference for building UI in this project. Read this before adding components or
styling so new work matches what's already here.

## Stack

- **Component library**: [shadcn/ui](https://ui.shadcn.com), style `radix-nova`, base color `neutral`, icon library `lucide-react`. Config lives in `components.json`.
- **Primitives**: `radix-ui` (unified package), wrapped by shadcn components in `components/ui/`.
- **Styling**: Tailwind CSS v4 (CSS-first config, no `tailwind.config.js` — everything is in `app/globals.css` via `@theme` and `@import`).
- **Variants**: `class-variance-authority` (cva) for components with multiple visual variants (e.g. `Button`).
- **Class merging**: `cn()` helper in `lib/utils.ts` (`clsx` + `tailwind-merge`) — always use this instead of template-string concatenation when a component accepts a `className` override.
- **Fonts**: `Geist` (sans) and `Geist_Mono`, loaded via `next/font/google` in `app/layout.tsx`, exposed as CSS variables `--font-geist-sans` / `--font-geist-mono`.

Adding a new shadcn primitive: use the shadcn CLI (`npx shadcn@latest add <component>`) rather than hand-writing one, so it picks up the `radix-nova` style and existing aliases (`@/components`, `@/lib`, `@/hooks`).

## Theme tokens (app/globals.css)

All colors are semantic CSS variables in OKLCH, defined once in `:root` (light) and `.dark`, then re-exposed as Tailwind colors inside `@theme inline`. **Never hardcode a hex/rgb color in a component** — use the token classes below so dark mode and future palette tweaks work for free.

| Token | Utility classes | Purpose |
|---|---|---|
| `background` / `foreground` | `bg-background` / `text-foreground` | Page base |
| `card` / `card-foreground` | `bg-card` / `text-card-foreground` | Card surfaces |
| `popover` / `popover-foreground` | `bg-popover` / `text-popover-foreground` | Dropdowns, dialogs |
| `primary` / `primary-foreground` | `bg-primary` / `text-primary-foreground` | Primary actions |
| `secondary` / `secondary-foreground` | `bg-secondary` / `text-secondary-foreground` | Secondary actions |
| `muted` / `muted-foreground` | `bg-muted` / `text-muted-foreground` | De-emphasized text/surfaces |
| `accent` / `accent-foreground` | `bg-accent` / `text-accent-foreground` | Hover/active highlight |
| `destructive` | `bg-destructive`, `text-destructive` | Errors, delete actions |
| `border` / `input` / `ring` | `border-border`, `border-input`, `ring-ring` | Borders, form outlines, focus rings |
| `sidebar*` | `bg-sidebar`, `text-sidebar-foreground`, etc. | Sidebar-specific surface (separate palette slot from `background`) |
| `chart-1..5` | `bg-chart-1`, `fill-chart-1`, etc. | Data visualization series |

Current palette: light mode is a cool neutral/teal base — background `oklch(0.985 0.004 197)` (near-white, faint cyan), primary `oklch(0.58 0.1 195)` (muted teal), accent a lighter teal wash. Dark mode currently falls back to shadcn's default neutral grays (not yet teal-tinted) — if you touch dark mode, keep this in mind.

Radius scale is derived from one variable, `--radius: 0.75rem`, via `@theme inline`:
`--radius-sm` (0.6×) → `--radius-md` (0.8×) → `--radius-lg` (1×, base) → `--radius-xl` (1.4×) → up to `--radius-4xl` (2.6×). Use `rounded-lg`/`rounded-xl`/etc., not arbitrary `rounded-[Npx]` values.

## Typography

- Base font: `font-sans` (Geist) on `<html>`; headings use `font-heading` (also Geist, kept as a distinct token in case a different display font is added later).
- No fixed type-scale file — sizes are applied ad hoc with Tailwind's scale (`text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`). Observed conventions:
  - Card/section titles: `text-base font-medium` (`CardTitle` default) or bumped to `text-lg` for emphasis (e.g. `InjuryCard` title).
  - Page/header titles: `text-base font-semibold md:text-lg`.
  - Auth page titles: `text-2xl` centered.
  - Body/secondary text: `text-sm text-muted-foreground`.
  - Error text: `text-sm text-destructive`.
- Default line-height/weight comes from Tailwind defaults — don't introduce custom `leading-*`/`font-*` values unless matching an existing pattern above.

## Spacing conventions

- Card internal spacing uses a local CSS variable, `--card-spacing` (`--spacing(4)`, i.e. `1rem`), consumed via `py-(--card-spacing)` / `px-(--card-spacing)`. A `size="sm"` variant shrinks it to `--spacing(3)`. Prefer extending this pattern over hardcoding padding when adding new Card-based components.
- Form fields: `space-y-4` between fields in a form; `space-y-1` for tight label+value stacks.
- Page/section layout: `gap-3`, `gap-4`, `gap-6` for flex/grid layouts, scaling up with breakpoint (`md:px-6` etc.).
- Component sizing follows Tailwind's default spacing scale (`px-2.5`, `h-8`, `size-4` for icons) — no custom spacing scale is defined.

## Component patterns

### 1. Variant-driven primitive (`components/ui/button.tsx`)

Use `cva` for any component with a fixed set of visual variants/sizes. Pattern:

```tsx
const buttonVariants = cva(
  "base classes shared by all variants...",
  {
    variants: {
      variant: { default: "...", outline: "...", ghost: "...", destructive: "..." },
      size: { default: "...", sm: "...", icon: "..." },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

function Button({ className, variant, size, asChild = false, ...props }: ...) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
```

Conventions to follow: tag the root element with `data-slot="<name>"` (and `data-variant`/`data-size` where relevant) for stylable/testable hooks; support `asChild` via Radix `Slot.Root` when the component might wrap a `Link` or other element; always thread `className` through `cn(...)` last so callers can override.

### 2. Compound presentational component (`components/ui/card.tsx`)

Multi-part components are split into small named exports (`Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`, `CardContent`, `CardFooter`) that compose via plain children, each with its own `data-slot`. Example usage, from `components/dashboard/injury-card.tsx`:

```tsx
<Link href={`/dashboard/injuries/${injury.id}`}>
  <Card className="cursor-pointer transition hover:shadow-md">
    <CardHeader>
      <CardTitle className="text-lg">{injury.name}</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="space-y-1 text-sm text-muted-foreground">
        <p>Area: {injury.bodyArea}</p>
      </div>
    </CardContent>
  </Card>
</Link>
```

Keep domain components (`components/dashboard/*`) thin: they import `ui/*` primitives and compose them with real data, they don't reimplement styling.

### 3. Page-level layout wrapper (`components/PageContainer.tsx`, `components/AuthCard.tsx`)

Simple centered-page shells are plain functions, not shadcn primitives:

```tsx
export default function PageContainer({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      {children}
    </main>
  );
}
```

`AuthCard` builds on `Card` for the auth pages (`w-full max-w-md rounded-2xl shadow-sm`, centered `text-2xl` title). Use this pair (`PageContainer` + a `Card`) as the template for any new standalone (non-dashboard) page.

### 4. Forms and dialogs (`components/dashboard/create-injury-dialog.tsx`)

Forms are plain controlled `useState` + a native `<form onSubmit>`, wrapped in the shadcn `Dialog`:

```tsx
<Dialog open={open} onOpenChange={onOpenChange}>
  <DialogContent className="max-h-[90vh] overflow-y-auto">
    <DialogHeader><DialogTitle>Create Injury</DialogTitle></DialogHeader>
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Label + Input/Textarea fields */}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Creating..." : "Create Injury"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  </DialogContent>
</Dialog>
```

Field-heavy forms are extracted into their own component (see `components/dashboard/injury-form/injury-basic-info-form.tsx`) and passed value/setter pairs as props rather than lifting a form library — no react-hook-form/formik in this project currently.

## Checklist for new UI

- Use existing `ui/*` primitives before writing new markup; add a new one via the shadcn CLI if missing.
- Style with semantic tokens (`bg-card`, `text-muted-foreground`, …), never raw hex/oklch values or arbitrary colors.
- Use `rounded-{sm,md,lg,xl,2xl,...}` from the shared radius scale, not one-off pixel radii.
- Route all conditional/merged classNames through `cn()`.
- Icons from `lucide-react` only, sized via the button/svg defaults (`[&_svg:not([class*='size-'])]:size-4` pattern) unless a specific `size-*` is needed.
- Keep domain components thin wrappers around `ui/*` primitives with real data — don't duplicate primitive styling in feature components.
