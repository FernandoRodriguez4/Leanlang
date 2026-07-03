# Plan de Migración a PostgreSQL

> Auditoría técnica y plan de migración del backend (FastAPI + SQLAlchemy + LangGraph)
> desde SQLite hacia una única instancia PostgreSQL.
>
> **Estado:** propuesta técnica. No incluye cambios de código (solo este documento).
> **Fecha:** 2026-07-02

---

## 1. Resumen ejecutivo

El backend **declara PostgreSQL en los defaults del código** (`app/core/config.py`) pero
**corre sobre SQLite en la práctica**, porque el `.env` activo lo fuerza. Existen **dos
almacenes SQLite independientes**:

1. **BD de negocio** — `app.db`, gestionada por SQLAlchemy (`users`, `projects`, `blueprints`, `experiments`).
2. **Checkpointer de LangGraph** — `checkpoints.sqlite`, gestionado por `SqliteSaver`.

El objetivo es consolidar **todo** en una única instancia PostgreSQL, con **Alembic** como
único mecanismo de migraciones, `PostgresSaver` para LangGraph, esquema `public` para el
dominio de negocio y esquema `langgraph` para checkpoints. La buena noticia: **todas las
dependencias necesarias ya están instaladas** (`psycopg` v3, `alembic`,
`langgraph-checkpoint-postgres`) y buena parte de la ruta Postgres ya está escrita pero
sin cablear.

**Supuestos de este plan** (confirmar antes de ejecutar fases con cambios de datos):

- **Datos:** baseline limpio (empezar de cero). No se portan `users/projects/blueprints`
  ni checkpoints; el catálogo se re-siembra desde `app/catalog/experiments.json`.
  Justificación: el proyecto está en desarrollo.
- **Tipos:** migrar a tipos nativos de PostgreSQL (`UUID`, `JSONB`, `timestamptz`).
- **Infra:** el backend queda desacoplado de la infraestructura. Solo depende de
  `DATABASE_URL` y `LANGGRAPH_PG_DSN`; el proveedor de PostgreSQL (local, RDS, Supabase,
  Neon, Railway, Cloud SQL, etc.) es una elección de despliegue, no un requisito del repo.
  No se añade Docker ni `docker-compose.yml`.

---

## 2. Auditoría técnica

### 2.1 Dependencias con SQLite (a eliminar)

| Ubicación | Dependencia SQLite | Detalle |
|---|---|---|
| `.env` (activo) | `DATABASE_URL=sqlite:///./app.db` | Fuerza SQLAlchemy a SQLite pese a los defaults Postgres del código. |
| `app/core/config.py:27` | `checkpoint_db_path="./checkpoints.sqlite"` | Ruta del archivo del checkpointer SQLite. |
| `app/graph/runtime.py:38-50` | `init_graph_sqlite()` | `SqliteSaver.from_conn_string(...)` + `saver.setup()`. |
| `app/graph/runtime.py:68-76` | `init_graph_persistent()` | Cadena por defecto **SQLite → memoria**; nunca llega a Postgres. |
| `tests/conftest.py`, `tests/test_api.py` | `sqlite:///./test.db`, `sqlite:///./test_api.db` | Vía `os.environ.setdefault("DATABASE_URL", ...)`. |
| Raíz del repo | `app.db` (~69 KB), `checkpoints.sqlite` (~9.9 MB) | Artefactos de datos existentes. |
| `requirements.txt` | `aiosqlite`, `langgraph-checkpoint-sqlite`, `sqlite-vec` | Quedan como transitivas/dev tras la migración. |

**Nota:** son **dos migraciones distintas**. Cambiar `DATABASE_URL` a Postgres **no**
mueve el checkpointer de LangGraph — este se controla por separado en `runtime.py`.

### 2.2 Qué ya soporta PostgreSQL (reutilizable)

| Elemento | Ubicación | Estado |
|---|---|---|
| Defaults de conexión Postgres | `app/core/config.py:24-25` | `database_url=postgresql+psycopg://...`, `langgraph_pg_dsn=postgresql://...` |
| Driver psycopg v3 | `requirements.txt` | `psycopg==3.3.4`, `psycopg-binary==3.3.4`, `psycopg-pool==3.3.1` |
| Alembic | `requirements.txt` | `alembic==1.18.5` (instalado, **no inicializado**) |
| PostgresSaver | `requirements.txt` | `langgraph-checkpoint-postgres==3.1.0` |
| Ruta Postgres del grafo | `app/graph/runtime.py:53-65` | `init_graph_postgres()` **ya existe** (definido pero nunca llamado) |
| Plantilla de entorno | `.env.example` | Ya documenta el target Postgres |

Ausentes (y no necesarios): `asyncpg`, `psycopg2`.

### 2.3 Inicialización de SQLAlchemy

`app/db/session.py`:

```python
engine = create_engine(settings.database_url, pool_pre_ping=True, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)

class Base(DeclarativeBase): ...

def init_db() -> None:                       # dev-only
    from app.db import models  # noqa: F401
    Base.metadata.create_all(bind=engine)
```

- **Todo síncrono** (`create_engine`, `Session`), sin `connect_args`.
- El esquema se crea en runtime con `Base.metadata.create_all`, invocado desde el
  lifespan (`app/main.py:24-28`). **No hay Alembic inicializado** (sin `alembic.ini`,
  sin `migrations/`, sin `env.py`).
- `get_db()` es la dependencia de sesión de FastAPI (usada en `auth.py`, `blueprint.py`,
  `export.py`, `projects.py`).

**Modelos** (`app/db/models.py`):

| Tabla | PK | Campos notables | Índices / FK |
|---|---|---|---|
| `users` | `String(36)` (UUID app-side) | `email`, `hashed_password`, `created_at (tz)` | `email` unique+index |
| `projects` | `String(36)` | `name`, `raw_idea (Text)`, `constraints (JSON)`, `created_at` | FK `user_id → users.id` CASCADE, index |
| `blueprints` | `String(36)` | `thread_id (String64)`, `state (JSON)`, `status`, `version`, `created_at` | FK `project_id → projects.id` CASCADE; index en `project_id`, `thread_id` |
| `experiments` | `String(64)` (**slug**) | catálogo estático (44 filas), varios `JSON` e `Integer` 1..5 | — |

Observaciones para Postgres:
- PKs son UUID generados en la app (`str(uuid.uuid4())`) o slug → **sin secuencias/autoincrement** → migración de claves trivial.
- `JSON` genérico (candidato a `JSONB`), `String(36)` (candidato a `UUID` nativo), `DateTime(timezone=True)` (será `timestamptz` real).
- FK `ondelete="CASCADE"` se **aplicará realmente** en Postgres (SQLite hoy no las fuerza salvo `PRAGMA foreign_keys=ON`, que no está activo).
- No hay `__table_args__`, ni `CheckConstraint`, ni `UniqueConstraint` más allá de `email`.

### 2.4 Inicialización de LangGraph

`app/graph/runtime.py` centraliza el checkpointer. Puntos clave:

- `build_blueprint_graph(checkpointer)` (`app/graph/build_graph.py:115`) es la **única**
  llamada a `.compile()`.
- Existen `init_graph_memory()`, `init_graph_sqlite()`, `init_graph_postgres()` y
  `init_graph_persistent()`.
- **`init_graph_persistent()` es lo que llama el lifespan**, y hardcodea **SQLite → memoria**:

```python
def init_graph_persistent(stack: ExitStack):
    """Elige el mejor checkpointer disponible: SQLite -> memoria."""
    try:
        init_graph_sqlite(stack)      # <-- nunca prueba Postgres
    except Exception:
        init_graph_memory()
    return _graph
```

- `init_graph_postgres()` ya usa `PostgresSaver.from_conn_string(settings.langgraph_pg_dsn)`
  + `saver.setup()`, con fallback a memoria — **pero nadie lo invoca**.
- **Savers síncronos** ejecutados desde un thread worker (`app/api/streaming.py`), por lo
  que son compatibles con las rutas `async`. **No** se requiere migrar a savers async.
- El grafo compilado es un **singleton de módulo** (`_graph`), consumido vía `get_graph()`
  en `app/api/routes/blueprint.py` (sin inyección de dependencias).

### 2.5 Riesgo de seguridad detectado (fuera de scope, pero prioritario)

El `.env` **commiteado** contiene secretos reales (clave DeepSeek, clave LangSmith,
`jwt_secret`). Recomendación: **rotar** esas credenciales y sacar `.env` del control de
versiones (ver §5.6). No forma parte de la migración de BD, pero debe atenderse.

---

## 3. Arquitectura objetivo

```
                     ┌─────────────────────────────────────────────┐
                     │        Instancia PostgreSQL (1 sola)          │
                     │                DB: blueprint                  │
                     │                                               │
   FastAPI (async)   │   ┌─────────────────┐   ┌─────────────────┐  │
   rutas + Depends   │   │  schema: public │   │ schema:langgraph│  │
        │            │   │                 │   │                 │  │
        ▼            │   │  users          │   │  checkpoints    │  │
  SQLAlchemy (sync)  │   │  projects       │   │  checkpoint_    │  │
  engine + pool ─────┼──▶│  blueprints     │   │    blobs        │  │
  (psycopg v3)       │   │  experiments    │   │  checkpoint_    │  │
                     │   │  alembic_version│   │    writes       │  │
   LangGraph graph   │   └─────────────────┘   │  checkpoint_    │  │
   (thread worker)   │                         │    migrations   │  │
   PostgresSaver ────┼────────────────────────▶└─────────────────┘  │
   (psycopg-pool)    │     search_path=langgraph                     │
                     └─────────────────────────────────────────────┘

   Alembic = ÚNICA fuente del esquema de negocio (public)
   PostgresSaver.setup() = crea/gestiona las tablas de langgraph
```

Principios:

- **Una instancia, una base de datos (`blueprint`), dos esquemas.** El negocio vive en
  `public`; el checkpointer en `langgraph`.
- **Alembic es la única fuente de verdad** del esquema de negocio. Se elimina
  `Base.metadata.create_all` de la ruta de producción.
- **PostgresSaver gestiona su propio esquema** vía `setup()`. Se aísla en `langgraph`
  fijando `search_path=langgraph` en la conexión del saver.
- **SQLAlchemy permanece síncrono** (coherente con el modelo de threads del grafo); se
  añade configuración de pool explícita.
- **Cero SQLite en producción.**

---

## 4. Plan de migración por fases

> Cada fase es autocontenida y validable. Las fases 0–3 son de infraestructura/código;
> la 4 es datos/seed; la 5 elimina SQLite; la 6 valida end-to-end.

### Fase 0 — Preparación e infraestructura

> **Principio de esta fase:** el backend queda **desacoplado de la infraestructura**.
> El código y la configuración solo dependen de dos variables de entorno —
> `DATABASE_URL` y `LANGGRAPH_PG_DSN` — sin asumir dónde ni cómo corre PostgreSQL
> (localhost, contenedor local, Supabase, Railway, Neon, RDS, etc.). Por eso esta fase
> **no incluye Docker ni `docker-compose.yml`**: aprovisionar la instancia de Postgres
> (local o gestionada) es responsabilidad de quien despliega, no del repositorio.

- Provisionar **una instancia PostgreSQL 16** por fuera del repo (a elección: instalación
  local, servicio gestionado como Supabase/Railway/Neon, u otro). El repo no prescribe el
  mecanismo. *(Ya satisfecho: existe una instancia PostgreSQL local disponible para
  desarrollo.)*
- Crear la base `blueprint` y los esquemas `public` (existe por defecto) y `langgraph` en
  esa instancia (vía cliente SQL manual o el gestor del proveedor). La creación del esquema
  `langgraph` también puede resolverse en la Fase 2 desde la migración inicial de Alembic.
- Actualizar **`.env.example`** para que `DATABASE_URL` y `LANGGRAPH_PG_DSN` documenten el
  target Postgres, como el **único contrato de configuración** (cualquier proveedor es
  válido mientras exponga un DSN compatible):
  - `DATABASE_URL=postgresql+psycopg://<user>:<password>@<host>:<port>/<db>`
  - `LANGGRAPH_PG_DSN=postgresql://<user>:<password>@<host>:<port>/<db>?options=-c%20search_path%3Dlanggraph`
  - **El `.env` real no se toca en esta fase**: el entorno de desarrollo sigue en SQLite
    hasta que se ejecute la fase que efectivamente cablea la app a Postgres (Fase 1 en
    adelante). `.env.example` documenta el target sin forzar el corte.
- Añadir `.gitignore` para `*.sqlite` (mantener el resto de reglas existentes; `.env` y
  `*.db` ya estaban cubiertos).
- ~~Rotar los secretos expuestos (§2.5).~~ **Fuera de alcance de esta migración** (decisión
  explícita del usuario). Queda como recomendación de seguridad independiente en §2.5/§5.6,
  no como tarea de la Fase 0.

#### Estado esperado
- ✅ Existe una instancia PostgreSQL accesible (independiente del proveedor) con la base
  `blueprint` y los esquemas `public` y `langgraph`.
- ✅ `.env.example` documenta `DATABASE_URL` y `LANGGRAPH_PG_DSN` apuntando a Postgres, como
  plantilla del contrato de configuración objetivo.
- N/A `.env` sigue en SQLite intencionalmente; el corte a Postgres se hace en una fase
  posterior, no en la Fase 0.
- ✅ Ningún archivo del repo asume Docker ni un host/puerto fijo: la app (cuando se cablee)
  funcionará con cualquier DSN válido en `DATABASE_URL` / `LANGGRAPH_PG_DSN`.
- ✅ `*.sqlite` está ignorado por git (además de `.env` y `*.db`, ya presentes).
- N/A Rotación de secretos: fuera de alcance por decisión del usuario; `checkpoints.sqlite`
  permanece versionado hasta la Fase 6.

### Fase 1 — SQLAlchemy sobre PostgreSQL

- Ajustar el pool en `app/db/session.py`: `pool_size`, `max_overflow`, `pool_pre_ping=True`,
  `pool_recycle`.
- Migrar `app/db/models.py` a tipos nativos:
  - `String(36)` → `postgresql.UUID(as_uuid=True)`; cambiar `default=_uuid` a `default=uuid.uuid4`.
  - Ajustar tipos de FK (`user_id`, `project_id`) a `UUID`.
  - `JSON` → `postgresql.JSONB`.
  - Confirmar `DateTime(timezone=True)` → `timestamptz`.
  - (`Experiment.id` sigue siendo slug `String(64)`.)
- Añadir `__table_args__` con constraints e índices explícitos:
  - `CheckConstraint` para escalas 1..5 (`cost`, `setup_time`, `run_time`, `evidence_strength`).
  - `CheckConstraint`/enum para `blueprints.status` (`running|awaiting_input|done`, valores
    reales usados hoy en `app/api/routes/blueprint.py`; **no** `draft|interrupted` como
    decía una versión previa de este documento — el código, no el documento, es la fuente
    de verdad de los estados).
- Definir una **naming convention** en `Base.metadata` para constraints deterministas
  (necesario para que Alembic genere nombres estables).

#### Estado esperado
> Validación de esta fase = **estática** (código, sin requerir una instancia PostgreSQL
> en ejecución). La validación funcional contra Postgres real es puerta de la Fase 5.

- ✅ Los modelos usan `UUID`, `JSONB` y `timestamptz` (sin `String(36)`/`JSON` genérico).
- ✅ El engine queda configurado con pool explícito (`pool_size`, `max_overflow`,
  `pool_pre_ping`, `pool_recycle`) — verificable por lectura de `session.py`, sin abrir
  conexión real.
- ✅ Existen los `CheckConstraint` de escalas 1..5 y de `blueprints.status`
  (`running|awaiting_input|done`).
- ✅ La `naming convention` está definida en `Base.metadata`.
- ✅ La app importa los modelos sin errores de mapeo (`python -c "import app.db.models"`,
  no requiere DB).

### Fase 2 — Alembic como único mecanismo de migraciones

- `alembic init` (crear `alembic.ini` + `migrations/`).
- Cablear `migrations/env.py`:
  - `target_metadata = Base.metadata` (importando los modelos).
  - URL desde `settings.database_url`.
  - `include_schemas=True`, `version_table_schema="public"`, `compare_type=True`.
  - Crear el esquema `langgraph` en la migración inicial (o script de infra) para que
    `PostgresSaver.setup()` tenga dónde escribir.
- Autogenerar la **revisión inicial** con todas las tablas de negocio en `public`.
- Retirar `Base.metadata.create_all` de la ruta de producción (dejarlo solo para tests o
  eliminarlo); documentar `alembic upgrade head` como paso de despliegue.

#### Estado esperado
- ✅ `alembic upgrade head` corre sin errores desde una base vacía.
- ✅ Todas las tablas de negocio existen en el esquema `public`.
- ✅ Existe la tabla `alembic_version` con la revisión inicial.
- ✅ `alembic downgrade` revierte la revisión sin errores.
- ✅ La ruta de producción ya no usa `create_all`.

### Fase 3 — LangGraph con PostgresSaver

- Reescribir `init_graph_persistent()` en `app/graph/runtime.py`:
  - **Postgres-first**: si `langgraph_pg_dsn` está configurado, usar `init_graph_postgres(stack)`.
  - Fallback a **memoria** (no a SQLite) — en producción no debe caer a SQLite silenciosamente.
- Garantizar `search_path=langgraph` en la conexión del saver (vía DSN `options=-c search_path=langgraph`, o configurando la conexión/pool del `PostgresSaver`).
- `saver.setup()` crea `checkpoints`, `checkpoint_blobs`, `checkpoint_writes`,
  `checkpoint_migrations` en `langgraph`.
- Retirar `init_graph_sqlite()` de la cadena por defecto (puede quedar para dev local).

> **Nota técnica:** `PostgresSaver.setup()` crea tablas **sin cualificar el esquema**.
> El aislamiento en `langgraph` se consigue con el `search_path`, no con un parámetro de
> esquema (la versión 3.1.0 no lo expone). Verificar tras la primera ejecución que las
> tablas aparezcan en `langgraph` y no en `public`.

#### Estado esperado
- ✅ `init_graph_persistent()` selecciona `PostgresSaver` (no SQLite) al arrancar.
- ✅ `saver.setup()` crea las tablas del checkpointer en el esquema `langgraph`.
- ✅ Ninguna tabla del checkpointer queda en `public`.
- ✅ Fallback a memoria (no a SQLite) si Postgres no está disponible.
- ✅ No se crea ni escribe `checkpoints.sqlite`.

### Fase 4 — Seeders y datos

- Ejecutar `seed_experiments()` **después** de `alembic upgrade head`. Es idempotente
  (upsert) y su fuente de verdad es `app/catalog/experiments.json` → **no requiere ETL**.
- **Baseline limpio** (supuesto por defecto): no se portan datos de negocio ni checkpoints.
- *(Opcional, si se decide preservar datos)*: sub-fase ETL `app.db` → Postgres para
  `users/projects/blueprints`, normalizando `created_at` a `timestamptz` y validando UUIDs.
  Los checkpoints de LangGraph **no** se portan (formato interno distinto entre backends).

#### Estado esperado
- ✅ `seed_experiments()` corre tras `alembic upgrade head` sin errores.
- ✅ La tabla `experiments` tiene las 44 filas del catálogo.
- ✅ Re-ejecutar el seeder no duplica filas (idempotente).
- ✅ El catálogo coincide con `app/catalog/experiments.json`.

### Fase 5 — Validación completa sobre PostgreSQL (SQLite aún disponible como respaldo)

> **Puerta de calidad.** PostgreSQL debe funcionar de extremo a extremo **mientras SQLite
> permanece disponible como mecanismo de respaldo**. No se elimina nada de SQLite hasta que
> **toda** esta validación sea exitosa. Si algo falla, se puede volver a SQLite cambiando
> únicamente la configuración (`DATABASE_URL` / `LANGGRAPH_DATABASE_URL`), sin haber perdido
> capacidad de rollback.

Condición de entrada: el código de las fases 1–4 está aplicado, pero la ruta SQLite
(config, `init_graph_sqlite`, dependencias) **sigue presente**.

Checklist mínima de validación (todas deben pasar):

- [ ] **Inicio de FastAPI**: la app arranca sin errores apuntando a PostgreSQL.
- [ ] **Conexión a PostgreSQL**: el engine conecta (verificable con `pool_pre_ping` / `SELECT 1`).
- [ ] **Tablas vía Alembic**: `alembic upgrade head` crea **todas** las tablas de negocio en
      `public`; `alembic_version` presente. (No se usa `create_all` en esta ruta.)
- [ ] **CRUD completo**: create/read/update/delete sobre `users`, `projects`, `blueprints`
      funcionan contra PostgreSQL.
- [ ] **Registro y autenticación**: `register` + `login` emiten y validan JWT correctamente.
- [ ] **Creación de proyectos**: endpoint de projects persiste en `public.projects`.
- [ ] **Generación de blueprints**: se genera un blueprint y se persiste en `public.blueprints`.
- [ ] **PostgresSaver operativo**: el checkpointer inicializa contra PostgreSQL con
      `search_path=langgraph`.
- [ ] **Checkpoints, writes y blobs**: tras ejecutar el grafo, existen filas en
      `langgraph.checkpoints`, `langgraph.checkpoint_writes` y `langgraph.checkpoint_blobs`.
- [ ] **Flujo completo de LangGraph**: **generar → interrupt → resume**, incluyendo reanudar
      tras **reinicio del backend** (prueba de persistencia real del checkpointer).
- [ ] **Health check**: `GET /health` responde OK con la configuración PostgreSQL.
- [ ] **Tests**: la suite completa pasa en verde contra PostgreSQL.
- [ ] **Aislamiento por esquema**: tablas de negocio en `public`, tablas del checkpointer en
      `langgraph` (verificado por inspección directa de la BD).

**Salida de la fase:** solo cuando **todos** los puntos anteriores estén verificados se
autoriza avanzar a la Fase 6.

#### Estado esperado
- ✅ Toda la checklist de validación anterior está en verde.
- ✅ FastAPI opera de extremo a extremo sobre PostgreSQL.
- ✅ El flujo LangGraph generar → interrupt → resume sobrevive a un reinicio.
- ✅ La suite de tests pasa contra PostgreSQL.
- ✅ SQLite sigue disponible como respaldo (aún no se elimina nada).

### Fase 6 — Eliminación definitiva de SQLite

> Se ejecuta **únicamente** tras superar la puerta de calidad de la Fase 5.

- Quitar `checkpoint_db_path` y la ruta SQLite (`init_graph_sqlite`) de la configuración y
  del código de producción.
- Documentar que `aiosqlite`, `langgraph-checkpoint-sqlite` y `sqlite-vec` quedan solo
  como transitivas/dev.
- Actualizar `docs/SETUP.md` (hoy dice "PostgreSQL opcional"; pasará a **requerido**).
- Ajustar la estrategia de tests: o Postgres en integración (contenedor efímero), o
  SQLite solo en unit tests aislados. Fijar `DATABASE_URL` de test para que no colisione
  con uno global de Postgres (ver §5 · Testing).
- Eliminar/archivar los artefactos `app.db` y `checkpoints.sqlite` de la raíz.
- Verificación final: ninguna escritura a `*.sqlite` / `*.db` en la ruta de producción.

#### Estado esperado
- ✅ No quedan referencias a SQLite en la ruta de producción (`config`, `runtime`).
- ✅ La app arranca y funciona sin ningún archivo `*.sqlite` / `*.db`.
- ✅ `docs/SETUP.md` indica PostgreSQL como requerido.
- ✅ La suite de tests pasa con la estrategia de tests final.
- ✅ Los artefactos `app.db` y `checkpoints.sqlite` fueron eliminados/archivados.

---

## 5. Recomendaciones

### 5.1 Alembic
- `include_schemas=True`, `version_table_schema="public"`, `compare_type=True`.
- **Naming convention** en `Base.metadata` para que autogenerate produzca nombres estables
  de constraints/índices.
- Una revisión por cambio; escribir `downgrade` real (no `pass`).
- Excluir del autogenerate las tablas del esquema `langgraph` (las gestiona `PostgresSaver`),
  p. ej. con `include_object`/`include_name` filtrando por esquema.

### 5.2 Transacciones
- Mantener `get_db()` con commit explícito por request (patrón actual).
- Considerar un patrón unit-of-work por request si crece la lógica.
- El SQLAlchemy síncrono es adecuado dado que el grafo se ejecuta en thread worker.

### 5.3 Seeders
- `seed_experiments()` es idempotente → seguro re-ejecutar tras cada `upgrade head`.
- Integrarlo como paso post-migración en despliegue (no dentro de la migración Alembic).

### 5.4 Pool de conexiones
- App (SQLAlchemy): `pool_size=5–10`, `max_overflow=10`, `pool_pre_ping=True`,
  `pool_recycle=1800`.
- Checkpointer (`PostgresSaver`): usa su propio `psycopg-pool`; dimensionarlo aparte y
  contar sus conexiones dentro del límite `max_connections` de Postgres.
- Con Postgres gestionado detrás de un pooler (p. ej. PgBouncer en modo transaction),
  evitar prepared statements conflictivos (configurar psycopg acorde).

### 5.5 Backups
- `pg_dump` programado de la base `blueprint` (incluye ambos esquemas).
- Política de retención + prueba periódica de restore.
- En gestionado, activar snapshots automáticos + PITR si está disponible.

### 5.6 Configuración y seguridad
- Un único DSN base por entorno; derivar el DSN del checkpointer añadiendo `search_path`.
- **Rotar** los secretos hoy expuestos en `.env` y sacar `.env` de git.
- Secretos de producción vía gestor de secretos / variables de entorno del orquestador,
  no en archivos versionados.

---

## 6. Checklist de implementación y validación

### Implementación
- [ ] Instancia PostgreSQL 16 provisionada (local o gestionada; sin Docker en el repo).
- [ ] Base `blueprint` + esquemas `public` y `langgraph` creados.
- [ ] `.env.example` actualizado (`DATABASE_URL`, `LANGGRAPH_PG_DSN` con `search_path`);
      `.env` real se actualiza en una fase posterior.
- [ ] `.gitignore` con `*.sqlite` (`.env` y `*.db` ya cubiertos); rotación de secretos
      fuera de alcance (decisión del usuario).
- [ ] `session.py`: pool configurado.
- [ ] `models.py`: `UUID`, `JSONB`, `timestamptz`, `__table_args__` (checks/índices), naming convention.
- [ ] Alembic inicializado; `env.py` cableado (`include_schemas`, `version_table_schema`).
- [ ] Revisión inicial autogenerada y revisada.
- [ ] `create_all` retirado de la ruta de producción.
- [ ] `init_graph_persistent()` reescrito (Postgres-first, fallback memoria).
- [ ] `search_path=langgraph` efectivo para el saver.
- [ ] `seed_experiments()` como paso post-`upgrade head`.
- [ ] `docs/SETUP.md` actualizado (Postgres requerido).
- [ ] Estrategia de tests ajustada.

### Validación
- [ ] `alembic upgrade head` sin errores; `alembic_version` en `public`.
- [ ] Tablas de negocio en `public`; tablas del checkpointer en `langgraph`.
- [ ] `GET /health` OK.
- [ ] Flujo register → login → project → blueprint → interrupt → resume OK.
- [ ] Reinicio del backend: blueprint pausado se reanuda (persistencia del checkpointer).
- [ ] Catálogo con 44 experimentos sembrados.
- [ ] Suite de tests en verde.
- [ ] Confirmado: ninguna escritura a `app.db` / `checkpoints.sqlite` en producción.

---

## 7. Apéndice — Archivos clave

| Archivo | Rol en la migración |
|---|---|
| `app/core/config.py` | Fuente de `database_url` y `langgraph_pg_dsn`. |
| `app/db/session.py` | Engine, sesión, pool; hoy con `create_all`. |
| `app/db/models.py` | Modelos ORM a migrar a tipos nativos. |
| `app/graph/runtime.py` | Selección del checkpointer (`init_graph_persistent`). |
| `app/main.py` | Lifespan: `init_db` + seed + `init_graph_persistent`. |
| `app/catalog/seed.py` | Seeder idempotente del catálogo. |
| `.env` / `.env.example` | Configuración de entorno (SQLite → Postgres). |
| `docs/SETUP.md` | Documentación de instalación a actualizar. |
| `requirements.txt` | Dependencias (ya incluye todo lo de Postgres). |
