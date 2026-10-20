## ADDED Requirements

### Requirement: Rear cameras switch without concurrent access
The scanner SHALL release the current camera before opening another rear lens, recover the previous lens if replacement fails, and stop a camera opened after the scanner was closed.

#### Scenario: Exclusive mobile camera
- **WHEN** a phone rejects a second active camera
- **THEN** switching to another rear camera succeeds because the first stream has already stopped

#### Scenario: Replacement fails
- **WHEN** a selected camera cannot be opened
- **THEN** the scanner attempts to reopen the prior camera instead of retaining a stopped stream

#### Scenario: Scanner closes during permission or camera startup
- **WHEN** a stream arrives after cancellation
- **THEN** its tracks are stopped without opening another camera

### Requirement: Camera starts without magnification and remains adjustable
The scanner SHALL request HD video, use native zoom when supported, apply autofocus independently, and offer a camera switch when multiple rear lenses are exposed by the browser.

#### Scenario: Autofocus constraint is rejected
- **WHEN** the browser rejects a focus adjustment but accepts native zoom
- **THEN** native zoom is still applied and the video remains usable

#### Scenario: Multiple rear cameras
- **WHEN** at least two rear camera devices are available
- **THEN** the user can change the active rear camera without leaving the scanner or clearing the batch's duplicate history

### Requirement: Preview preserves camera brightness
The scanner SHALL display video without an opacity filter that darkens the label, while keeping scanner instructions legible.

#### Scenario: Physical label in the viewport
- **WHEN** the live camera preview is shown
- **THEN** the label retains the captured brightness and text is backed by its own contrast surface
