## MODIFIED Requirements

### Requirement: Camera starts without magnification and remains adjustable
The scanner SHALL request HD video, use native zoom when supported, and apply autofocus independently. It SHALL expose camera switching only when the caller permits it and multiple rear lenses are exposed by the browser.

#### Scenario: Autofocus constraint is rejected
- **WHEN** the browser rejects a focus adjustment but accepts native zoom
- **THEN** native zoom is still applied and the video remains usable

#### Scenario: Multiple rear cameras in an enabled context
- **WHEN** at least two rear camera devices are available and the caller permits switching
- **THEN** the user can change the active rear camera without leaving the scanner or clearing the batch's duplicate history

#### Scenario: Multiple rear cameras in Inventory or Sales
- **WHEN** at least two rear camera devices are available and the scanner is opened from Inventory or Sales
- **THEN** the scanner uses its default camera without showing a camera-switch action
