---
name: adr
description: >
  Generates Architecture Decision Records (ADRs) in Spanish for the Software Architecture course.
  Use this skill whenever the user asks to document an architectural decision, write an ADR,
  record a design decision, justify a technology or architectural choice, or when they say
  things like "write the ADR for...", "document the decision to use X", "make an ADR for...",
  or "record that we chose X". Also trigger when the user is comparing architectural alternatives
  and wants to formally record the decision taken. The output document must always be written
  in Spanish regardless of the language the user is writing in.
---

# Skill: ADR Documentation

This skill generates Architecture Decision Records (ADRs) for the Software Architecture course.
The SKILL instructions are in English, but **all generated ADR output must be written in Spanish**.

---

## Mandatory output format

Always use exactly this structure, in this order. Do not add or remove sections.
Every section heading and all content must be written in Spanish:

```
# ADR {N}: {short title of the decision}

{Context description: the forces, constraints, requirements, and technological or business
aspects that drove the need for this decision. Include relevant quality attributes,
project constraints, and the problem being solved.}

## Decisión

{The decision taken, expressed in formal, impersonal sentences. Use impersonal constructions
such as "Se utilizará...", "Se adoptará...", "Se implementará...", or third-person references
to the team/project such as "El equipo empleará...", "El sistema hará uso de...".
Never use first-person plural ("Nosotros").}

## Justificación

{Reasoning behind the decision. Include:
- Why this option was chosen over alternatives
- Significant alternatives considered and why they were rejected
- Assumptions, constraints, or evaluation results that support the decision
- Accepted trade-offs}

## Estado

{One of: Propuesto | Aceptado | Obsoleto | Reemplazado}
{If Obsoleto: explain why. If Reemplazado: include a link or reference to the replacing ADR.}

## Consecuencias

{List all consequences of applying this decision. Include both positive and negative consequences.
Never omit the negatives or risks.}
```

---

## Writing rules

1. **Output language**: The generated ADR document must always be written in **Spanish**, without exception — regardless of what language the user writes in.
2. **Skill language**: These instructions are in English. That is fine. Only the output changes.
3. **Impersonal and formal voice in Decisión**: The "## Decisión" section must use impersonal constructions ("Se utilizará...", "Se adoptará...", "Se implementará...") or formal third-person references ("El equipo empleará...", "El sistema hará uso de..."). Never use first-person plural ("Nosotros").
4. **Formal register throughout**: The entire document must use a formal academic register. Avoid colloquialisms, contractions, or informal phrasing. All sections should read as formal technical documentation.
4. **Complete consequences**: List all consequences — positive, negative, and risks. Never omit the negatives.
5. **No invented requirements**: Do not add requirements, constraints, or quality attributes that weren't mentioned by the user or found in the course material. If you make an assumption, mark it explicitly as such.
6. **Quality attributes**: When relevant, relate the decision to course quality attributes (modifiability, performance, security, deployability, integrability, availability, testability).
7. **Numbering**: Use the ADR number the user provides. If none is given, use `{N}` as a placeholder and let the user know.
8. **Title**: Short, descriptive, and decision-oriented (not problem-oriented). Example: "Uso de Redis como caché de sesiones" not "Problema de performance en sesiones".
9. **Tone**: Academic, clear, and precise. Suitable for a university assignment.

---

## Course context

When generating ADRs in the context of the Software Architecture course, keep in mind:

- **Course technologies**: TypeScript, Node.js, Express/Koa, MySQL, MongoDB, Sequelize, Mongoose, Redis, Bull/RabbitMQ, Docker, Docker Compose, PM2, JWT, OpenID Connect.
- **Relevant patterns and styles**: Layers, Pipes & Filters, Publish/Subscribe, CQRS, Gatekeeper, Federated Identity, Service-Based Architecture, SOA, Multi-Tiers.
- **Quality attributes**: Always relate the decision to the quality attributes it impacts.
- **No over-engineering**: If a decision can be resolved simply, do not propose unnecessary complexity.
- **Orally defensible**: The ADR must be something the student can defend verbally in an evaluation.

---

## Generation process

When the user asks for an ADR:

1. **Identify the core decision**: What is being decided? What problem does it solve?
2. **Identify the context**: What forces, constraints, or requirements surround this decision?
3. **Identify alternatives**: What other options existed? Why were they rejected?
4. **Identify impacted quality attributes**: What quality attributes justify or are affected by the decision?
5. **Write the full ADR** following the mandatory format above, entirely in Spanish.
6. If information is missing to complete any section, either ask before generating or mark it explicitly with `[PENDIENTE: ...]`.

---

## Example of a well-formed ADR

```
# ADR 3: Uso de Redis para gestión de sesiones de usuario

El sistema requiere mantener sesiones de usuario autenticado entre múltiples requests.
La solución debe soportar alta concurrencia, permitir expiración automática de sesiones
y ser compatible con un eventual escalado horizontal del servidor de aplicaciones.
Almacenar sesiones en base de datos relacional implica latencia adicional por consultas
en cada request. Almacenarlas en memoria del proceso impide el escalado horizontal.

## Decisión

Se utilizará Redis como almacén de sesiones de usuario, accedido mediante la biblioteca
`ioredis` desde Node.js, con TTL configurado por ambiente.

## Justificación

Redis fue elegido por su modelo de datos clave-valor con soporte nativo de TTL, su
latencia sub-milisegundo en operaciones de lectura/escritura y su amplia adopción en
el ecosistema Node.js. Esto impacta positivamente en el atributo de performance.

**Alternativas consideradas y rechazadas:**
- **Sesiones en MySQL**: Descartado por la latencia adicional de consultas SQL en cada
  request autenticado y la carga innecesaria en la base de datos principal.
- **JWT sin estado (stateless)**: Descartado porque el obligatorio requiere capacidad de
  invalidación de sesiones activas, lo cual no es posible con JWT puro sin una lista
  de revocación (que equivale a tener estado igualmente).

**Suposición**: Se asume que Redis estará disponible como servicio dentro de la red
interna del despliegue (Docker Compose), sin exposición pública.

## Estado

Aceptado

## Consecuencias

**Positivas:**
- Latencia de sesión reducida a operaciones en memoria (~1ms vs ~10-50ms en SQL).
- Expiración automática de sesiones sin procesos de limpieza adicionales.
- Compatible con escalado horizontal del servidor de aplicaciones.

**Negativas:**
- Se agrega un nuevo componente de infraestructura (Redis) que debe ser desplegado,
  monitoreado y mantenido.
- Las sesiones son volátiles: un reinicio de Redis sin persistencia configurada
  invalida todas las sesiones activas.
- Requiere configurar persistencia (RDB/AOF) o aceptar la pérdida de sesiones ante
  caídas del servicio.

**Riesgos:**
- Si Redis no está disponible, el sistema no puede autenticar usuarios. Se recomienda
  definir una estrategia de fallback o healthcheck en el despliegue.
```
