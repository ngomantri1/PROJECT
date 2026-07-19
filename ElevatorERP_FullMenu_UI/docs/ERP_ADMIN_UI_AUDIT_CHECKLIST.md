# ERP/Admin Shell UI Audit Checklist

Use this checklist to review screens, drawers, modals, tables, filters, and forms for a professional ERP/admin shell.

## Layout
- Primary task appears in the first viewport without unnecessary scrolling.
- Page content uses dense but readable spacing; avoid marketing-style hero/card layouts.
- Drawer/modal titles stay left aligned; close icon stays top right.
- Footer actions are fixed for long forms and use clear hierarchy.
- Repeated sections are compact lists or tables, not oversized cards.

## Typography
- Page titles: 20-24px, 650-750 weight.
- Drawer/modal titles: 15-17px, 600-700 weight.
- Section headings: 13-14px, 600-700 weight.
- Metadata/help text: 11-13px, muted color, normal or italic only when secondary.
- Avoid too many bold labels competing on one screen.

## Forms
- Required fields are visually clear and near the top.
- Labels are short, consistent, and business-specific.
- Related fields are grouped in two-column grids on desktop and one column on mobile.
- Advanced or long detail entry opens in a drawer/modal instead of stretching the main form.
- Empty states include one clear next action.

## Actions
- One primary action per surface: usually Save/Create/Apply.
- Destructive actions are visually quieter until hover unless they are the main decision.
- Icon-only actions need tooltip and accessible label.
- Duplicate/copy actions operate at the business object level, not the parent record unless intended.

## Tables And Lists
- Use compact rows with stable heights.
- Show the most scannable fields first.
- Keep row actions aligned right.
- Use badges/counts for totals and completion state.
- Long lists inside side panels should scroll internally.

## Responsive
- Desktop can use two columns for primary form plus supporting side panel.
- Tablet/mobile should collapse to one column.
- Buttons should not wrap awkwardly or overlap close icons.
- Fixed footers must not cover editable content.

## Visual Polish
- Keep border radius restrained, usually 8px or less.
- Use muted borders and backgrounds for admin surfaces.
- Avoid heavy shadows, decorative gradients, and large empty cards.
- Ensure light/dark theme parity for new components.
