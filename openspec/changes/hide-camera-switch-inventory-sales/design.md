# Design

Add an `allowCameraSwitch` option to the shared `CameraScanner`, defaulting to enabled so existing callers keep their behavior. Keep the existing default-camera selection, skip the extra rear-camera enumeration used only to populate the switch control when switching is disabled, and render the control only when enabled and multiple rear cameras are available.

Pass `allowCameraSwitch={false}` from Inventory's single-equipment form, batch load, and scan review. In the shared operation form, disable switching for normalized `inventory` and `sales` sources; retain it for other sources. For the scan review reopened from an operation, derive the option from its resume source, defaulting an unscoped inventory scan to disabled.

Tests use a synthetic camera that advertises multiple rear lenses. They assert the control is absent while scans still complete in Inventory/Sales, and assert that an unaffected context can still switch lenses. No real IMEI, camera device, production record, external account, or live email is used.
