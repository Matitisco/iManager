# Design

Keep NETWORK_ERROR_MESSAGE as the internal normalization and recovery signal. Filter network failures at load rendering boundaries, without substituting error/empty copy. Normalize action errors to neutral copy. OfflineScope continues health probing without rendering status. Update unit/component tests and existing E2E expectations, without adding E2E tests or running a build.
