# Naming Guide

---

## General Rules

1. **Reveal intent** — the name should tell you WHY it exists, not WHAT it is mechanically.
2. **Avoid disinformation** — don't use names that suggest the wrong thing.
3. **Make meaningful distinctions** — `data`, `info`, `object`, `manager` add nothing.
4. **Use pronounceable names** — if you can't say it, you can't discuss it.
5. **Use searchable names** — single letters and magic numbers are unsearchable.
6. **Avoid encodings** — no Hungarian notation, no `I` prefix on interfaces (except where the convention is established).

---

## By Construct Type

### Variables & Properties

| ❌ Bad | ✅ Good | Why |
|---|---|---|
| `x` | `userAge` | Reveals what it holds |
| `d` | `elapsedTimeInDays` | Reveals unit |
| `temp` | `cachedUserList` | Reveals purpose of "temporariness" |
| `flag` | `isEmailVerified` | Booleans should be questions |
| `data` | `orderPayload` | Data is meaningless |
| `list` | `pendingInvoices` | Type + domain context |

### Booleans

Always use `is`, `has`, `can`, `should`, `was`, `needs`:

```
isActive          hasPermission       canRetry
isEmailVerified   hasChildren         shouldRetry
wasDeleted        needsReview         canPublish
```

### Functions / Methods

Use **verb + noun** that describes the action and its subject:

| ❌ Bad | ✅ Good |
|---|---|
| `process()` | `calculateOrderTotal()` |
| `handle()` | `handlePaymentFailure()` |
| `doStuff()` | `archiveExpiredSessions()` |
| `check()` | `isUserEligibleForDiscount()` |
| `get()` | `fetchUserById()` |
| `update()` | `updateShippingAddress()` |

Functions that return booleans should read as yes/no questions:
```
isValidEmail(email)
hasActiveSubscription(userId)
canUserAccessResource(userId, resourceId)
```

### Classes

Use **nouns or noun phrases** that describe what the object IS, not what it does:

| ❌ Bad | ✅ Good |
|---|---|
| `UserManager` | `UserService` or `UserRegistrar` |
| `DataProcessor` | `InvoiceProcessor` |
| `Handler` | `PaymentFailureHandler` |
| `Helper` | [extract into domain concept] |
| `Utils` | [group by actual domain] |

Clean Architecture naming patterns:
```
// Domain
Order, Customer, Money, OrderItem, OrderId

// Application
PlaceOrderUseCase, CancelOrderUseCase
PlaceOrderCommand, OrderSummaryDTO

// Infrastructure
PostgresOrderRepository, StripePaymentGateway
SendgridEmailAdapter, RedisSessionStore

// Presentation
OrderController, AuthMiddleware
OrderRequestSchema, OrderResponseMapper
```

### Constants

```
// UPPER_SNAKE_CASE
const MAX_RETRY_ATTEMPTS = 3
const DEFAULT_PAGE_SIZE = 20
const JWT_EXPIRATION_SECONDS = 3600
```

### Interfaces / Ports

Prefer naming by what it represents, not by the fact that it's an interface:

```
// Good (describes role/capability)
interface UserRepository { ... }
interface PaymentGateway { ... }
interface EmailSender { ... }

// Avoid (encodes type, not meaning)
interface IUserRepository { ... }
interface IPaymentGateway { ... }
```

---

## Anti-patterns to Flag

| Anti-pattern | Example | Problem |
|---|---|---|
| Generic suffixes | `Manager`, `Helper`, `Utils`, `Handler` | Says nothing about responsibility |
| Abbreviated names | `usrSvc`, `pymtGtwy`, `calc` | Hard to read and search |
| Type in name | `userArray`, `nameString` | Type system handles this |
| Context repetition | `userUser.userName` | Redundant |
| Misleading names | `getUser()` that also updates state | Violates least surprise |
| Number suffixes | `service1`, `service2` | Use specific names |
| Vague verbs | `process`, `handle`, `do`, `run` | Too broad |
