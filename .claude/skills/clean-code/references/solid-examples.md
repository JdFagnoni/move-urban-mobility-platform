# SOLID — Before/After Examples (Language-Agnostic)

---

## S — Single Responsibility Principle

**Violation**: A `UserService` that handles registration, email sending AND password hashing.

```
// BAD: three reasons to change
class UserService {
  register(data) {
    const hash = bcrypt.hash(data.password)         // reason 1: hashing algorithm changes
    db.save({ ...data, password: hash })             // reason 2: persistence changes
    mailer.send(data.email, "Welcome!")              // reason 3: email strategy changes
  }
}
```

```
// GOOD: each unit has one responsibility
class PasswordHasher { hash(plain) { ... } }
class UserRepository { save(user) { ... } }
class WelcomeEmailSender { send(email) { ... } }

class RegisterUserUseCase {
  constructor(hasher, repo, mailer) { ... }
  execute(data) {
    const hash = this.hasher.hash(data.password)
    const user = this.repo.save({ ...data, password: hash })
    this.mailer.send(user.email)
  }
}
```

---

## O — Open/Closed Principle

**Violation**: Adding a new payment method requires modifying existing code.

```
// BAD: every new method requires editing this function
function processPayment(order, method) {
  if (method === "card") { chargeCard(order) }
  else if (method === "paypal") { chargePaypal(order) }
  // adding crypto = edit this function
}
```

```
// GOOD: extend without modifying
interface PaymentProcessor { process(order): void }

class CardProcessor implements PaymentProcessor { ... }
class PaypalProcessor implements PaymentProcessor { ... }
class CryptoProcessor implements PaymentProcessor { ... }  // no edit needed elsewhere

function processPayment(order, processor: PaymentProcessor) {
  processor.process(order)
}
```

---

## L — Liskov Substitution Principle

**Violation**: A subclass breaks the contract of its base class.

```
// BAD: Square breaks Rectangle's contract
class Rectangle {
  setWidth(w) { this.width = w }
  setHeight(h) { this.height = h }
  area() { return this.width * this.height }
}

class Square extends Rectangle {
  setWidth(w) { this.width = w; this.height = w }   // breaks expected behavior
  setHeight(h) { this.width = h; this.height = h }  // a caller expecting Rectangle is surprised
}
```

```
// GOOD: use composition or a shared abstraction, not inheritance
interface Shape { area(): number }
class Rectangle implements Shape { ... }
class Square implements Shape { ... }
```

---

## I — Interface Segregation Principle

**Violation**: A client is forced to depend on methods it doesn't use.

```
// BAD: every implementor must handle everything
interface Animal {
  walk(): void
  swim(): void
  fly(): void
}

class Dog implements Animal {
  fly() { throw new Error("Dogs can't fly") }  // forced to implement
}
```

```
// GOOD: split into focused interfaces
interface Walkable { walk(): void }
interface Swimmable { swim(): void }
interface Flyable { fly(): void }

class Dog implements Walkable, Swimmable { ... }
class Bird implements Walkable, Flyable { ... }
```

---

## D — Dependency Inversion Principle

**Violation**: High-level module directly instantiates a low-level module.

```
// BAD: UserService is coupled to a specific DB implementation
class UserService {
  constructor() {
    this.db = new MySQLUserRepository()   // hard dependency, can't swap, can't test
  }
  getUser(id) { return this.db.findById(id) }
}
```

```
// GOOD: depend on abstraction, inject the implementation
interface IUserRepository {
  findById(id: string): User
}

class UserService {
  constructor(private repo: IUserRepository) {}   // injected, swappable
  getUser(id) { return this.repo.findById(id) }
}

// Wiring (composition root / DI container):
const service = new UserService(new MySQLUserRepository())
// or in tests:
const service = new UserService(new InMemoryUserRepository())
```
