# KOCM interface design

KOCM is a campus reporting and fellowship workspace. Use direct labels and a restrained visual hierarchy so people can find their campus, submit a report, and review records quickly.

## Foundations

Tokens live in `app/globals.css`. Light mode uses warm white (`--background`, #f7f6f2), charcoal (`--foreground`, #20231f), white surfaces (`--card`), muted text (`--muted-foreground`, #687168) and subtle dividers (`--border`, #dedfd8). Gold (`--yellow`, #dfbd53) marks primary actions and the selected navigation item. Olive (#69754e) identifies activity/completion in charts. Red/green status colours convey reporting or academic outcomes; do not use colour alone.

Use Arial with Helvetica Neue/sans-serif fallbacks. Body text is 14px; inputs on phones remain 16px to avoid browser zoom. Main titles are 28–34px, section titles 18px, control labels 12–14px. Figma uses Arimo as an available Arial-compatible substitute. Avoid display typefaces and tightly tracked oversized slogans inside the management app.

The editable Figma reference is [KOCM design](https://www.figma.com/design/4XFO7Zb6Ek0lNKSYztgQMz). Its sample statistics are fictional. Published screens must obtain statistics through the existing scoped queries.

## Structure

Keep the workspace within 1240px, with 40px desktop gutters and 20px on phones. The header stays flat with a divider. Metric totals form an aligned row, split into two columns on smaller screens. Use small-radius white panels for charts, forms and record groups; avoid repeated decorative coloured tiles. Tables use restrained header styles, generous row spacing, numeric alignment and horizontal scrolling within the table container.

Use at most five primary navigation destinations, grouping related views in secondary tabs. The floating dock uses 44px circles. Retain the circular floating navigation interaction requested for KOCM. Its selected gold circle moves between items; the background is opaque with a subtle shadow. Respect reduced-motion settings and reserve bottom space so it never covers the last controls.

Public pages explain the two concrete paths: starting a university fellowship and signing into an existing campus account. Authentication is a calm labelled form. Remove ornamental orbits, glow effects, trust badges and marketing filler. Preserve approval guidance and error messages.

## Interaction and access

Keep keyboard focus visible, labels associated with controls, and tap targets at least 44px where practical. Check desktop and narrow phone widths in both themes. Never weaken campus isolation, approval rules, materials protection or validation as part of a visual change. Empty statistics stay unknown; do not substitute decorative example data in production. Temporary design-preview routes must be removed before deployment.

## Campus network and public imagery

The admin campus network adapts the dotted globe reference into a UK-only SVG with keyboard-accessible campus pins. Missing locations remain searchable rather than receiving invented coordinates. University coordinates are reference points, not confirmed fellowship venues. Lead contact details appear only in the authenticated admin view.

The public landing page uses the supplied community, prayer and fellowship flyer images in their original aspect ratios, with optimized JPEG derivatives. The fellowship flyer is adapted into transparent lettering only: Kharis On Campus and Fellowship with us every Tuesday. Faces, blank venue fields and the rectangular background are removed; a soft halo blends the artwork into either page theme. Both themes use semantic surface and text tokens; purple is reserved for the fellowship section.
