---
name: clean-code
description: >
  Apply this skill whenever the user shares code for review, asks to write new code with quality standards,
  or mentions any of the following: clean code, clean architecture, code quality, SOLID principles,
  code smell, refactoring, dependency inversion, separation of concerns, DRY, YAGNI, KISS, naming conventions,
  layered architecture, or wants to improve the structure of their codebase.
  Use it both proactively (when generating new code) and reactively (when reviewing existing code).
  Even if the user just pastes a code snippet without an explicit question, trigger this skill to analyze it.
---

# Clean Code & Clean Architecture Skill

## Purpose

This skill enables two modes of operation:

- **Review Mode**: Analyze existing code and produce a structured findings report with actionable recommendations.
- **Generation Mode**: Write new code that follows clean code principles and clean architecture from the start.

Both modes are language-agnostic. Apply the principles regardless of the stack.

---

## Core Principles Reference

Before analyzing or generating code, internalize these principles. They are the evaluation criteria.

### 1. SOLID

| Principle | What to check |
|---|---|
| **S** — Single Responsibility | Does each class/module/function have exactly one reason to change? |
| **O** — Open/Closed | Is the code open for extension but closed for modification? (prefer composition, interfaces, strategies) |
| **L** — Liskov Substitution | Can subtypes replace their base types without altering correctness? |
| **I** — Interface Segregation | Are interfaces minimal? Do clients depend only on what they use? |
| **D** — Dependency Inversion | Do high-level modules depend on abstractions, not on concrete implementations? |

### 2. Clean Architecture Layers

```
[ Presentation / Delivery ]   ← Controllers, CLI, API handlers
        ↓ depends on
[ Application / Use Cases ]   ← Orchestrates domain logic, no framework deps
        ↓ depends on
[ Domain / Entities ]         ← Business rules, pure logic, no external deps
        ↑ implemented by
[ Infrastructure ]            ← DB, HTTP clients, message brokers, file system
```

**Dependency rule**: Source code dependencies must point inward. Domain knows nothing about infrastructure or frameworks.

### 3. Separation of Concerns (SoC)

- Each layer handles its own responsibility.
- Mixing persistence logic with business logic in the same function/class is a violation.
- HTTP request parsing and business validation must not live in the same place.

### 4. Dependency Inversion & Injection

- High-level modules define interfaces (ports).
- Low-level modules implement them (adapters).
- Dependencies are injected, not instantiated internally.
- Avoid `new ConcreteService()` inside business logic.

### 5. DRY — Don't Repeat Yourself

- Duplication of logic (not just code) is the smell.
- Ask: if this logic changes, how many places need to change?
- Consolidate into shared abstractions, but only when the duplication is real, not coincidental.

### 6. YAGNI — You Aren't Gonna Need It

- Do not add functionality or abstraction until it is actually needed.
- Over-engineering is a quality risk, not a quality improvement.
- Flag unnecessary complexity.

### 7. KISS — Keep It Simple, Stupid

- Prefer the simplest solution that correctly solves the problem.
- Complex code is a maintenance liability.
- Ask: could a developer unfamiliar with this code understand it in under 2 minutes?

### 8. Naming Conventions

- **Variables**: reveal intent (`userAge`, not `x` or `temp`)
- **Functions**: verb + noun, describes what it does (`calculateTax`, `fetchUserById`)
- **Classes/Modules**: noun, describes what it is (`OrderRepository`, `PaymentService`)
- **Booleans**: use `is`, `has`, `can` prefix (`isActive`, `hasPermission`)
- **Constants**: UPPER_SNAKE_CASE
- **Avoid**: abbreviations, single letters (except loop counters), misleading names

---

## Review Mode

**Trigger**: User pastes existing code and asks for feedback, or just pastes code with no clear question.

### Step 1 — Understand the context

Before analyzing, identify:
- What does this code do? (purpose)
- What layer does it belong to? (presentation, application, domain, infrastructure)
- What language/framework is being used?

### Step 2 — Run the analysis

Evaluate the code against all 8 principles above. For each violation found, record:
- **Category** (which principle is violated)
- **Location** (function name, class name, line range if visible)
- **Description** (what exactly is wrong)
- **Severity** (High / Medium / Low)
- **Recommendation** (concrete action to fix it)

### Step 3 — Produce the Findings Report

Use this exact structure:

---

**📋 Code Review — Findings Report**

**Context**: [What the code does and what layer it belongs to]

**Summary**: [1–2 sentences on overall code health]

---

**🔴 High Severity**

| # | Principle | Location | Finding | Recommendation |
|---|---|---|---|---|
| 1 | [e.g. SRP] | [e.g. `UserService.ts`] | [Description] | [Fix] |

**🟡 Medium Severity**

| # | Principle | Location | Finding | Recommendation |
|---|---|---|---|---|

**🟢 Low Severity / Style**

| # | Principle | Location | Finding | Recommendation |
|---|---|---|---|---|

---

**Positive aspects**: [What the code does well — always include at least one if applicable]

**Priority refactoring actions**: [Top 3 things to fix first, ordered by impact]

---

### Step 4 — Offer refactoring

After the report, always ask:
> "¿Querés que refactorice el código aplicando estas recomendaciones?"

If the user says yes, proceed to Refactoring Mode (see below).

---

## Generation Mode

**Trigger**: User asks to write new code (a module, class, function, service, etc.).

### Step 1 — Clarify before writing

Ask (only if not already clear from context):
- What is the responsibility of this unit? (one sentence)
- What layer does it belong to?
- Does it depend on external resources (DB, HTTP, etc.)?

### Step 2 — Apply principles by default

When generating code:

1. **Each function/method does one thing** — if you need "and" to describe it, split it.
2. **Inject dependencies** — never instantiate concrete dependencies inside the unit.
3. **Define interfaces for external dependencies** — especially infrastructure ones.
4. **Name everything clearly** — no abbreviations, no generic names.
5. **No business logic in controllers or infrastructure** — route it to the application layer.
6. **No infrastructure code in domain** — domain is pure.
7. **Keep functions short** — ideally under 20 lines; extract if growing.
8. **Avoid magic numbers/strings** — use named constants.

### Step 3 — Annotate the code

When returning generated code, add inline comments explaining **why** (not what) for any non-obvious decision:

```
// Injected via constructor to allow test doubles and swap implementations
// without modifying this class (Dependency Inversion)
```

### Step 4 — Add a brief design note

After the code, include a short block:

---

**🏗️ Design note**

- **Layer**: [which layer this belongs to]
- **Principles applied**: [list]
- **Dependencies**: [what this depends on, and via what interface]
- **What to watch out for**: [any YAGNI/complexity risk if applicable]

---

## Refactoring Mode

**Trigger**: User asks to refactor code, or accepts the offer after a review.

### Process

1. Show the **before** code (or reference it if just reviewed).
2. Apply all High + Medium severity fixes from the report.
3. Show the **after** code, fully rewritten.
4. Add a **Refactoring summary** at the end:

---

**🔧 Refactoring Summary**

| Change | Principle Applied | Reason |
|---|---|---|
| Extracted `X` into its own class | SRP | It had two reasons to change |
| Introduced `IRepository` interface | DIP | Domain no longer depends on DB driver |
| Renamed `doStuff()` to `calculateOrderTotal()` | Naming | Reveals intent |
| Removed unused `generateReport()` method | YAGNI | Not called anywhere |

---

## Severity Guidelines

| Severity | When to use |
|---|---|
| 🔴 High | Violates architectural boundaries, introduces tight coupling, breaks testability, or causes serious maintainability risk |
| 🟡 Medium | Violates a SOLID principle in a way that will hurt when the code needs to change, but doesn't break things now |
| 🟢 Low | Naming issues, style inconsistency, minor DRY violations, small KISS improvements |

---

## What NOT to do

- Do not flag every single thing as High severity — prioritize.
- Do not recommend splitting code into microservices or adding heavy infrastructure.
- Do not add abstraction layers that aren't justified by a concrete need.
- Do not rewrite working code just for style if no principle is violated.
- Do not assume a framework when the user hasn't specified one.

---

## Reference files

- `references/solid-examples.md` — Code examples (before/after) for each SOLID principle
- `references/clean-arch-layers.md` — Detailed guidance on layer boundaries and what belongs where
- `references/naming-guide.md` — Extended naming conventions by construct type

Read these when you need deeper guidance on a specific area.
