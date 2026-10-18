## ADDED Requirements

### Requirement: Donut center remains inside the hole
Reportes SHALL fit monetary totals, counts and selected percentages within the existing donut hole on desktop and mobile, retaining exact amounts in accessible text.

#### Scenario: Long currency total
- **WHEN** a total is too wide at the current maximum font size
- **THEN** its font shrinks deterministically and uses a donut-only compact representation if it would need less than 11px
- **AND** digits are not truncated with ellipsis

#### Scenario: Selected slice
- **WHEN** a slice is selected in any report tab
- **THEN** the percentage fits and the selected label and exact total remain accessible
