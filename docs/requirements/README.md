# Requirements Specification

This translates the architecture and technical design into normative, testable MVP behavior.

## Files

- `requirements.md` — complete product and engineering requirements
- `acceptance-scenarios.md` — Given/When/Then behavior scenarios
- `traceability.md` — mapping from requirements to architecture, technical design, and tests

## Interpretation

Requirement statements use RFC 2119 keywords in capitals:

- **MUST / SHALL / REQUIRED**: mandatory for the stated release
- **SHOULD**: strongly preferred; deferral requires an explicit decision
- **MAY**: optional behavior

Every requirement has a stable `REQ-<AREA>-NNN` identifier that never changes and is never reused. Issues, pull requests, tests, and ADRs cite the identifier. A test that verifies a requirement names its identifier in the test name or a comment.

No requirement is verified yet; the acceptance scenarios describe the intended verification. Requirements marked as depending on a prototype spike are not yet verifiable at all. See [`../open-questions.md`](../open-questions.md).
