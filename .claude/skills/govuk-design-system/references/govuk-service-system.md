# GOV.UK service-system references

Last reviewed: 2026-09-13

`govuk-design-system` が current GOV.UK public-service conventions を観察するための runtime reference。brand asset、exact CSS value、Nunjucks/Sass API をコピーせず、journey structure、pattern responsibility、recovery、completion、lifecycle confidence を見る。

## Current system and lifecycle

- [GOV.UK Design System](https://design-system.service.gov.uk/)
  - Observe: current release notice, system scope, component/pattern entry points.
  - Current note: 2026-09-13 時点で GOV.UK Frontend v6.5.0 (2026-08-27) を案内している。
- [What's new](https://design-system.service.gov.uk/community/whats-new/)
  - Observe: current releases and changed/new components.
- [Component lifecycle statuses](https://design-system.service.gov.uk/community/component-lifecycle-statuses/)
  - Observe: Stable vs Trial, research expectations, change/deprecation risk.
  - Current note: Feedback and Language navigation are Trial components in v6.5.0.
- [Roadmap](https://design-system.service.gov.uk/community/roadmap/)
  - Observe: recently shipped work and areas likely to change.
- [GOV.UK Frontend](https://github.com/alphagov/govuk-frontend)
  - Observe: current implementation/release/deprecation evidence only.
- [GOV.UK Design System source](https://github.com/alphagov/govuk-design-system)
  - Observe: published-guidance source and current design discussions.

## Service-level context

- [GOV.UK Service Manual](https://www.gov.uk/service-manual)
  - Observe: end-to-end service framing beyond individual screens.
- [Service Standard — Make sure everyone can use the service](https://www.gov.uk/service-manual/service-standard/point-5-make-sure-everyone-can-use-the-service)
  - Observe: accessibility, assisted digital, representative research, online/offline service considerations.
- [Accessibility](https://design-system.service.gov.uk/accessibility/)
  - Observe: explicit boundary that Design System usage alone does not make a service accessible.
- [Accessibility strategy](https://design-system.service.gov.uk/accessibility/accessibility-strategy/)
  - Observe: assistive-technology testing and disabled-user research as ongoing evidence.

## Entry and navigation

- [Start using a service](https://design-system.service.gov.uk/patterns/start-using-a-service/)
  - Observe: service entry, preparation, expectation-setting, relation to surrounding GOV.UK content.
- [Navigate a service](https://design-system.service.gov.uk/patterns/navigate-a-service/)
  - Observe: repeated/multi-task services vs clear linear journeys; host header vs service navigation vs page content.
  - Current note: current guidance places service name/navigation in Service navigation rather than the GOV.UK header.
- [Service navigation](https://design-system.service.gov.uk/components/service-navigation/)
  - Observe: service-owned identity/navigation role.
- [Phase banner](https://design-system.service.gov.uk/components/phase-banner/)
  - Observe: service-level lifecycle message rather than page-specific status.

## Focused question/page structure

- [Making labels and legends headings](https://design-system.service.gov.uk/get-started/labels-legends-headings/)
  - Observe: one focused thing per page and question/heading relationship.
  - Avoid generalizing: this is not a universal page-count rule for every product.
- [Question pages](https://design-system.service.gov.uk/patterns/question-pages/)
  - Observe: one coherent task, heading/context, question and continue relationship.

## Multi-task and multi-session journeys

- [Complete multiple tasks](https://design-system.service.gov.uk/patterns/complete-multiple-tasks/)
  - Observe: long/multi-session justification, task grouping, status vocabulary, flexible order.
  - Key rule: simplify the transaction before introducing task-list structure.
- [Task list](https://design-system.service.gov.uk/components/task-list/)
  - Observe: user-controlled order/session need, status semantics, completion gating.
  - Avoid: generic wizard progress or dashboard decoration.

## Review and correction

- [Check answers](https://design-system.service.gov.uk/patterns/check-answers/)
  - Observe: review before submission, sections/values/actions, conditional relevance, return-to-review after edits.
  - Key behavior: correction should preserve prior answers and avoid replaying unrelated journey steps.
- [Summary list](https://design-system.service.gov.uk/components/summary-list/)
  - Observe: key/value/action relationship used in review/detail contexts.

## Validation and recovery

- [Recover from validation errors](https://design-system.service.gov.uk/patterns/validation/)
  - Observe: preservation of entered values, correction-oriented errors, progression-time validation, distinction between invalid input and other service states.
- [Error summary](https://design-system.service.gov.uk/components/error-summary/)
  - Observe: page-level aggregation, focus behavior, links to affected answers, consistency with local errors.
- [Error message](https://design-system.service.gov.uk/components/error-message/)
  - Observe: local correction cue associated with the affected answer.

## Status, interruption, and completion

- [Notification banner](https://design-system.service.gov.uk/components/notification-banner/)
  - Observe: service/user-relevant notice that is distinct from validation and end-of-transaction confirmation.
  - Key boundary: do not use for validation errors; linear-service completion normally uses Confirmation page.
- [Interruption pages](https://design-system.service.gov.uk/patterns/interruption-pages/)
  - Observe: deliberate pause for important information or consequence before continuation.
- [Confirmation pages](https://design-system.service.gov.uk/patterns/confirmation-pages/)
  - Observe: completed transaction, reference/receipt, next step, timing/contact, follow-on information and record/save needs.
  - Known gap: the guidance notes uncertainty around transactions that are only one part of a wider user task; do not overclaim universality.

## Runtime catalogs

- [Patterns](https://design-system.service.gov.uk/patterns/)
  - Observe: task/page-type solutions that combine components around user-focused problems.
- [Components](https://design-system.service.gov.uk/components/)
  - Observe: reusable controls and current status/guidance after the service problem is understood.

## Comparison rules

### Linear vs repeated-use service

Linear transaction usually emphasizes explicit entry, focused ordered steps, low navigation competition, review/correction, explicit submission, and confirmation.

Repeated-use or multi-task services may justify persistent service navigation and independent destinations. Many pages alone do not prove a navigation need.

### Multi-page transaction vs task list

A long ordered transaction can remain one linear flow. Task lists are useful when users need to plan distinct tasks, return across sessions, choose task order where possible, and understand completion across tasks.

### Validation vs interruption vs notification vs confirmation

- validation: correct provided information and continue
- interruption: pause to understand important information/consequence
- notification: relevant status while the larger service/journey continues
- confirmation: end-of-transaction boundary

Select by journey semantics, not visual prominence.

## Do not generalize

Do not universalize exact GOV.UK colors, type, spacing, width fractions, Crown assets, one-question-per-page, task lists, header anatomy, Nunjucks/Sass APIs, or Trial component behavior. Extract service relationships, evidence-backed pattern boundaries, and verification obligations instead.
