# Clean Architecture — Layer Boundaries

---

## The Dependency Rule

> Source code dependencies must always point inward.
> Inner layers know nothing about outer layers.

```
┌─────────────────────────────────────────────┐
│           Infrastructure / Adapters          │  ← DB, HTTP clients, file system, 3rd party APIs
│  ┌───────────────────────────────────────┐   │
│  │       Presentation / Delivery         │   │  ← REST controllers, CLI, GraphQL resolvers
│  │  ┌─────────────────────────────────┐  │   │
│  │  │    Application / Use Cases      │  │   │  ← Orchestrates domain, no framework deps
│  │  │  ┌───────────────────────────┐  │  │   │
│  │  │  │     Domain / Entities     │  │  │   │  ← Business rules, pure logic
│  │  │  └───────────────────────────┘  │  │   │
│  │  └─────────────────────────────────┘  │   │
│  └───────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

---

## What belongs where

### Domain Layer
**Allowed**: Entities, Value Objects, Domain Services, Domain Events, Repository Interfaces (ports), business rules, invariants.

**NOT allowed**: Framework imports, DB drivers, HTTP clients, ORMs, loggers, env variables.

```
// GOOD domain entity — zero external dependencies
class Order {
  private items: OrderItem[] = []

  addItem(item: OrderItem): void {
    if (item.quantity <= 0) throw new Error("Quantity must be positive")
    this.items.push(item)
  }

  total(): Money {
    return this.items.reduce((sum, i) => sum.add(i.subtotal()), Money.zero())
  }
}
```

---

### Application Layer
**Allowed**: Use cases, application services, DTOs, interfaces for infrastructure (ports), transaction coordination, calling domain objects.

**NOT allowed**: HTTP request/response objects, SQL queries, ORM calls, framework decorators, UI concerns.

```
// GOOD use case — orchestrates, doesn't implement infrastructure
class PlaceOrderUseCase {
  constructor(
    private orderRepo: IOrderRepository,    // port, defined here
    private paymentGateway: IPaymentGateway // port, defined here
  ) {}

  async execute(command: PlaceOrderCommand): Promise<OrderId> {
    const order = Order.create(command.items)
    const payment = await this.paymentGateway.charge(order.total())
    order.confirmPayment(payment.transactionId)
    await this.orderRepo.save(order)
    return order.id
  }
}
```

---

### Presentation Layer
**Allowed**: HTTP handlers, request parsing, response formatting, authentication middleware, input validation (schema), mapping to/from DTOs.

**NOT allowed**: Business logic, domain rules, direct DB access.

```
// GOOD controller — thin, delegates to use case
class OrderController {
  constructor(private placeOrder: PlaceOrderUseCase) {}

  async create(req, res) {
    const command = PlaceOrderCommand.fromRequest(req.body)  // parse & validate
    const orderId = await this.placeOrder.execute(command)
    res.status(201).json({ orderId })
  }
}
```

---

### Infrastructure Layer
**Allowed**: Repository implementations, ORM models, DB migrations, HTTP client wrappers, message broker adapters, file system access, external API integrations.

**NOT allowed**: Business rules, use case logic.

```
// GOOD infrastructure adapter — implements the port defined in domain/application
class PostgresOrderRepository implements IOrderRepository {
  async save(order: Order): Promise<void> {
    const row = OrderMapper.toPersistence(order)
    await this.db.query("INSERT INTO orders ...", row)
  }

  async findById(id: OrderId): Promise<Order | null> {
    const row = await this.db.query("SELECT * FROM orders WHERE id = $1", [id])
    return row ? OrderMapper.toDomain(row) : null
  }
}
```

---

## Common Violations to Flag

| Violation | Description | Severity |
|---|---|---|
| Fat controller | Business logic inside HTTP handler | 🔴 High |
| Repository in domain | Domain entity calls ORM directly | 🔴 High |
| Framework in domain | Domain imports Express, Sequelize, etc. | 🔴 High |
| Use case calls HTTP | Application layer makes HTTP calls directly | 🔴 High |
| DTO leak | Domain entity used as API response directly | 🟡 Medium |
| Missing mapper | Infrastructure model and domain model are the same class | 🟡 Medium |
| Logic in controller | Validation or business rule in the HTTP layer | 🟡 Medium |
| Direct instantiation | `new ConcreteRepository()` inside use case | 🟡 Medium |
