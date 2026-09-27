# USWDS system references

Last reviewed: 2026-09-13

この reference は U.S. federal public-service adaptation のための runtime input。exact visual values や federal assets を unrelated product へコピーしない。

## Current system / implementation state

- [USWDS](https://designsystem.digital.gov/)
  - Observe: current download version、component/pattern taxonomy、system scope。
  - Current review anchor: site offers v3.14.0.
- [USWDS 3.14.0 milestone](https://github.com/uswds/uswds/milestone/167)
  - Observe: release date/status and current implementation work.
- [USWDS 2026 shipping news](https://github.com/uswds/uswds/wiki/Shipping-news-2026)
  - Observe: current maintenance, component guidance changes, accessibility-driven changes.
  - Avoid copying: implementation backlog as design policy.

## Trust / agency identity

- [Banner](https://designsystem.digital.gov/components/banner/)
  - Observe: official-government trust statement, .gov/.mil explanation, progressive enhancement, current accessibility test status, current Web Component status.
  - Useful for: distinguishing official-site trust from product branding.
  - Avoid copying: federal wording outside an eligible U.S. government context.
- [Identifier](https://designsystem.digital.gov/components/identifier/)
  - Observe: highest-level parent agency, required links, parent-agency logo vs product logo, hierarchical multiple-parent handling, redundancy avoidance.
  - Useful for: accountability and site-wide agency identity.
  - Avoid copying: Identifier as a generic branded footer.

## Journey / progress

- [Step indicator](https://designsystem.digital.gov/components/step-indicator/)
  - Observe: stable linear multi-page process, current/completed/pending semantics, separate navigation, explicit page heading, when not to use for conditional/nonlinear/short flows.
  - Useful for: long federal application/registration processes with stable chapters.
  - Avoid copying: fixed step counts into conditional flows or using the indicator as navigation.
- [Complete a complex form](https://designsystem.digital.gov/patterns/complete-a-complex-form/)
  - Observe: establish expectations/trust, humane progression, review/record of submitted information.
  - Useful for: service-level form experience beyond individual field design.
  - Avoid copying: treating this pattern family as a field/component API.
- [Create a user profile](https://designsystem.digital.gov/patterns/create-a-user-profile/)
  - Observe: profile information as identity/service data; pattern-specific treatment for name, address, contact preference, date, phone and other sensitive identity fields.
  - Useful for: deciding when generic field assumptions fail in government identity/service contexts.
  - Avoid copying: assuming every service requires every profile attribute.

## Comparison / responsibility boundary

Compare USWDS findings against the repository's domain Skills. `form-design` owns field/question/validation flow; `navigation-design` owns general information-space movement; `content-design` owns wording and information priority; accessibility Skills own broader conformance and inclusive/cognitive methods. `uswds` only translates these decisions into current U.S. federal trust, agency identity, and service-pattern conventions.

`govuk-design-system` is a neighboring public-service adapter, not a synonym. Compare service context before borrowing patterns: USWDS has explicit U.S. federal official-site and parent-agency identity responsibilities that do not generalize to GOV.UK or non-government products.
