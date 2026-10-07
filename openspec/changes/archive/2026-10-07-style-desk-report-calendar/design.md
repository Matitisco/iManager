## Decisions

- Use editable text fields displaying dd/mm/yyyy and a calendar icon button. Convert complete manual dates and calendar selections to the existing ISO date-only draft format; keep incomplete input available for validation.
- Render a calendar dialog within the desk theme. Position it relative to its field while keeping it within the viewport. Close on outside interaction or Escape, returning focus after selection or keyboard dismissal.
- Use a Monday-first calendar with adjacent-month dates, a dark selected day, lime accent for Today, and month/year views for historical ranges.
- Provide roving day focus with arrow, Home/End and PageUp/PageDown navigation. Buttons never submit the report form; selected dates remain drafts until Aplicar período.
- Reuse report date parsing and retain the existing range error messages and calculations.

## Validation

Test selection, leap days/month transitions, manual entry, keyboard navigation, dismissal/focus, Today/Clear and report integration. Review the actual popup at desktop and narrow widths; run frontend/backend TypeScript checks without building.
