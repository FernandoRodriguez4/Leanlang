# Decisión Arquitectónica — Habilitación de pgvector sobre PostgreSQL Local

> **Tipo de documento:** registro de decisión arquitectónica (ADR). **No forma parte del roadmap
> de implementación.**
> **Fecha:** 2026-07-05
> **Propósito:** preservar el razonamiento técnico completo detrás de la decisión de mantener
> PostgreSQL local como única fuente de verdad e instalar `pgvector` sobre esa misma instancia,
> para evitar reabrir esta misma discusión en el futuro.

---

## 1. Contexto

**Objetivo inicial de la Fase 3:** formalizar `app/catalog/service.py` como Knowledge Service con
interfaz dual (`query_experiments` exacto, conservado; `semantic_search` como contrato para la
Fase 4) y habilitar la extensión `pgvector` en PostgreSQL, dejando la infraestructura lista para
RAG sin implementar embeddings ni tabla de conocimiento todavía (ver
`docs/audits/backend_architecture_evolution_validation.md` §7 y
`docs/audits/phase3_architecture_changes.md`).

**Restricciones aprobadas para la Fase 3** (acumuladas a lo largo de la revisión del contrato):
sin dimensión de vector fija, sin tabla de conocimiento, sin modelo ORM de conocimiento, sin
paquete Python `pgvector`, migración reducida a `CREATE EXTENSION IF NOT EXISTS vector;`,
`semantic_search` como `Protocol` de tipado sin cuerpo ejecutable.

**PostgreSQL local como fuente de verdad:** el proyecto usa una única instancia PostgreSQL 17
(distribución EDB para Windows) en `localhost:5432`, con datos reales de desarrollo (`blueprint`:
`users`, `projects`, `blueprints`, `experiments`; esquema `langgraph` para el checkpointer de
LangGraph). Esa instancia nunca formó parte del alcance a rediseñar.

**Motivo por el cual apareció el problema de pgvector:** al ejecutar la migración de la Fase 3
(`CREATE EXTENSION IF NOT EXISTS vector;`) contra esa instancia real, la operación falló. Esto no
era anticipable desde el código: es una propiedad del binario de PostgreSQL instalado, no de la
migración en sí (la migración es sintácticamente correcta, verificado con
`alembic upgrade ... --sql`).

---

## 2. Problema encontrado

- **PostgreSQL EDB 17 para Windows no distribuye `pgvector`.** Verificado directamente contra la
  instancia real: `SELECT name, default_version FROM pg_available_extensions WHERE name = 'vector';`
  devolvió `(0 rows)`. A nivel de archivos, `C:\Program Files\PostgreSQL\17\share\extension\` no
  contiene ningún `vector.control` ni `vector--*.sql`.
- **Stack Builder (la herramienta de complementos de EDB) tampoco lo ofrece** como paquete
  instalable para esta distribución.
- **Alembic falla en consecuencia:** `CREATE EXTENSION IF NOT EXISTS vector;` produce
  `psycopg.errors.FeatureNotSupported: la extensión «vector» no está disponible — DETAIL: No se
  pudo abrir el archivo de control de extensión
  «C:/Program Files/PostgreSQL/17/share/extension/vector.control»: No such file or directory.`
  Esto detiene el `alembic upgrade head` que corre el fixture de sesión de `tests/conftest.py`, y
  por tanto bloquea el 100% de la suite de tests (no por una regresión de código, sino por el fallo
  de esta única migración en el `setup`).
- **Conclusión del diagnóstico:** el problema es exclusivamente de **infraestructura del entorno
  local** (binario de PostgreSQL sin la extensión compilada), no de código de la aplicación, de
  Alembic, de SQLAlchemy ni del contrato de la Fase 3. La migración, el `Protocol` de
  `semantic_search` y los settings de configuración añadidos en la Fase 3 quedaron verificados
  como correctos de forma estática antes de intentar aplicarlos contra una base real.

---

## 3. Alternativas evaluadas

### Alternativa 1 — Compilar `pgvector` sobre PostgreSQL local

Build desde código fuente contra el mismo binario ya instalado (`C:\Program Files\PostgreSQL\17\`),
usando el método oficial de pgvector para Windows (`nmake` + MSVC).

- **Ventajas:** cambio puramente aditivo — se agregan `vector.dll` + `vector.control` +
  `vector--*.sql` al directorio de extensiones ya existente. Cero migración de datos, cero cambio
  de DSN, cero segunda instancia.
- **Desventajas:** requiere instalar Visual Studio Build Tools (workload "Desktop development with
  C++"), una descarga de varios cientos de MB. Requiere ejecutar el build/install **como
  Administrador** (escribe en `Program Files`).
- **Riesgos:** mínimos sobre los datos — no se toca `pg_data`, no se reinicia el motor con cambios
  de configuración (`pgvector` no usa `shared_preload_libraries`). El único riesgo real es que la
  compilación falle (riesgo de proceso, no de datos).
- **Compatibilidad:** total con Alembic (la migración ya está escrita para este escenario) y con
  SQLAlchemy (mismo `DATABASE_URL`/engine de siempre).
- **Mantenimiento:** bajo; solo requeriría recompilar ante una futura actualización de versión
  mayor de Postgres (17→18), evento poco frecuente.
- **Resultado de la evaluación:** identificada como la única alternativa que satisface
  simultáneamente todas las restricciones aprobadas (misma instancia, mismos datos, mismo DSN, sin
  migración). **Es la alternativa recomendada y aprobada** (ver §5).

### Alternativa 2 — Nueva instancia PostgreSQL (Docker o WSL2)

Reemplazar o complementar la instancia local con una nueva instancia PostgreSQL que ya incluya
`pgvector` (imagen oficial `pgvector/pgvector:pg17` en Docker, o PostgreSQL dentro de WSL2 vía el
repositorio oficial PGDG).

- **Ventajas:** no requiere compilar nada; en el caso de Docker, imagen oficial versionada y
  reproducible entre máquinas/CI/producción; en el caso de WSL2, paquetes oficiales del proyecto
  PostgreSQL (`postgresql-17-pgvector`) sin binarios de terceros.
- **Desventajas:** en ambos casos (Docker o WSL2) se trata de **una instancia de PostgreSQL
  distinta** de la que corre hoy en Windows nativo. Eso implica migrar los datos reales
  (`pg_dump`/`pg_restore`) de `blueprint` (incluido el esquema `langgraph`) a la instancia nueva, y
  decidir qué hacer con la instancia original.
- **Impacto arquitectónico:** alto — introduce una segunda fuente de verdad temporal durante la
  transición, o exige decomisionar la instancia nativa (una migración completa del entorno de
  desarrollo). En el caso Docker, aunque el `DATABASE_URL`/`LANGGRAPH_PG_DSN` podían mantenerse
  textualmente iguales (publicando el contenedor en el mismo `localhost:5432`), esto generó en la
  práctica un **conflicto de puertos IPv4/IPv6** (ver §4) que hizo la conexión no determinista.
- **Motivo del rechazo:** el objetivo original nunca fue cambiar el servidor principal de la
  aplicación. La fuente de verdad debía seguir siendo el PostgreSQL local existente, con sus datos
  reales de desarrollo. Migrar a una segunda instancia (con o sin contenedor) contradice
  directamente esa restricción, independientemente de que técnicamente fuera viable.

### Alternativa 3A — Binarios de terceros precompilados para Windows

Usar un `vector.dll` ya compilado, publicado por algún repositorio de la comunidad (no oficial del
proyecto pgvector, que no distribuye binarios para Windows).

- **Riesgos de seguridad:** una librería nativa no verificada se cargaría **dentro del proceso del
  servidor de PostgreSQL**, con acceso completo a todos los datos de `blueprint`. Es una cadena de
  suministro de confianza no auditada para un componente que corre con los privilegios del propio
  motor de base de datos.
- **Riesgos de compatibilidad:** alto riesgo de incompatibilidad exacta de versión/build (ABI) con
  la build específica 17.9 de EDB, pudiendo causar fallos silenciosos o crashes del servidor.
- **Motivo del rechazo:** el riesgo de seguridad y de compatibilidad no auditable no se justifica
  frente al costo, moderado y acotado, de la Alternativa 1 (instalar Visual Studio Build Tools y
  compilar desde la fuente oficial).

### Alternativa 3B — Validar únicamente en CI

No tocar la instancia local; aceptar que el desarrollo local no puede ejercitar la migración de
`pgvector`, y validar exclusivamente en un pipeline de CI (Linux, donde
`apt install postgresql-17-pgvector` es trivial y oficial).

- **Ventajas:** riesgo cero para datos y para el entorno local; no requiere instalar nada nuevo de
  inmediato.
- **Limitaciones:** el repositorio no tiene hoy un pipeline de CI configurado; no permite
  desarrollar ni depurar localmente ninguna funcionalidad de la Fase 4 que dependa de `pgvector`.
- **Motivo por el cual no resuelve el problema:** solo lo pospone. El objetivo de la Fase 3 —dejar
  la infraestructura lista y verificada para RAG— no se cumple si la migración nunca se valida
  contra un entorno real accesible para quien desarrolla.

---

## 4. Experimento Docker

- **Por qué se realizó:** ante el bloqueo de compilar `pgvector` localmente (sin Visual Studio
  Build Tools disponibles en ese momento), se evaluó como alternativa una instancia PostgreSQL
  oficial con `pgvector` preinstalado, corriendo en Docker (`pgvector/pgvector:pg17`), publicada en
  el mismo `localhost:5432` para no requerir cambios de `DATABASE_URL`/`LANGGRAPH_PG_DSN`.
- **Qué permitió comprobar:** que la imagen oficial funciona correctamente — dentro del contenedor,
  `pgvector 0.8.4` quedó disponible y verificado (`SELECT name, default_version FROM
  pg_available_extensions WHERE name = 'vector';` → `vector | 0.8.4`). El contrato de
  infraestructura (`docker-compose.yml` de un solo servicio, volumen nombrado, script de init para
  `blueprint_test`, imagen fijada sin `latest`) se implementó y funcionó como se diseñó a nivel de
  contenedor.
- **Conflicto de puertos encontrado:** al publicar el contenedor en `5432:5432` mientras el
  servicio nativo de Windows (`postgresql-x64-17`) seguía corriendo, Windows permitió que **ambos
  procesos escucharan simultáneamente en el puerto 5432, en familias de direcciones distintas**:
  `com.docker.backend.exe` en `::` (IPv6) y `postgres.exe` (nativo) en `0.0.0.0` (IPv4). Una
  conexión a `localhost:5432` resultaba ambigua según qué familia de direcciones resolviera
  primero el cliente — en la práctica, `psql.exe` resolvió hacia el Postgres nativo (sin
  `pgvector`), no hacia el contenedor. Detener el servicio nativo para eliminar la ambigüedad
  requería privilegios de administrador no disponibles en la sesión.
- **Por qué finalmente se descartó:** más allá de resolverse el conflicto de puertos, la revisión
  arquitectónica posterior determinó que el enfoque completo era incorrecto para el objetivo real:
  el contenedor representaba una **segunda instancia de PostgreSQL, completamente independiente y
  vacía**, distinta de la instancia local con los datos reales de desarrollo. Usarla como fuente de
  verdad habría exigido una migración completa del entorno de desarrollo, algo que nunca formó
  parte del alcance aprobado.

**Este experimento fue una exploración técnica puntual, no un cambio de arquitectura.** No se
aprobó en ningún momento como la solución definitiva; todo el trabajo de infraestructura generado
(`docker-compose.yml`, script de init, bloque de variables en `.env.example`) fue revertido en su
totalidad tras la decisión final (ver §6).

---

## 5. Decisión arquitectónica final (aprobada)

- **PostgreSQL local (EDB PostgreSQL 17.x) permanece como única fuente de verdad** de la
  aplicación.
- **No se migra la aplicación** a una instancia nueva, contenedorizada o no.
- **No se modifica `DATABASE_URL`.**
- **No se modifica `LANGGRAPH_PG_DSN`.**
- **Docker queda descartado** como estrategia de infraestructura para esta fase.
- **`pgvector` deberá instalarse sobre la instancia PostgreSQL local existente**, compilándolo
  desde la fuente oficial del proyecto contra el binario EDB 17 ya instalado (Alternativa 1, §3),
  una vez se disponga de Visual Studio Build Tools y privilegios de administrador para completar la
  instalación.

---

## 6. Limpieza realizada

Tras la decisión de descartar Docker, se revirtió por completo el trabajo del experimento:

- `docker-compose.yml` (raíz) — eliminado.
- Carpeta `docker/` (incluido `docker/initdb/01-create-test-db.sh`) — eliminada por completo.
- `docs/audits/infrastructure_pgvector_docker_contract.md` — eliminado (documentación específica
  del experimento descartado).
- Bloque de variables `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB`/`POSTGRES_PORT` agregado a
  `.env.example` — revertido; el archivo quedó restaurado línea por línea a su estado previo al
  experimento.
- Búsqueda de referencias residuales (`docker`, `pgvector/pgvector`) en todo el repositorio: sin
  coincidencias nuevas; las únicas menciones de "docker" restantes son preexistentes y no
  relacionadas (`POSTGRESQL_MIGRATION_PLAN.md`, que ya establecía no usar Docker; una mención de
  `docker stats` como ejemplo de monitor de SO en la validación de la Fase 0).
- **Repositorio restaurado** al estado previo al experimento Docker en todos los archivos de
  código, configuración y documentación de arquitectura.
- **Pendiente únicamente:** la limpieza manual del contenedor/volumen/red locales
  (`backend-db-1`, `backend_pgdata`, `backend_default`) cuando Docker Desktop esté disponible de
  nuevo, ya que el motor no estaba accesible en el momento del rollback. No afecta al repositorio ni
  al código del proyecto — es limpieza de recursos locales de Docker, fuera del control de
  versiones.

---

## 7. Lecciones aprendidas

- **No introducir cambios de infraestructura para resolver un problema localizado.** El bloqueo
  era específico de un binario de PostgreSQL en un entorno de desarrollo Windows; la respuesta
  correcta era resolverlo en ese mismo nivel (compilar la extensión), no rediseñar dónde vive la
  base de datos del proyecto.
- **Mantener siempre una única fuente de verdad.** Cualquier alternativa que implicara una segunda
  instancia de PostgreSQL —contenedorizada o no— reintroducía el mismo riesgo de fondo (datos
  duplicados, ambigüedad de cuál instancia es la autoritativa), independientemente de qué tan
  "moderna" o "reproducible" pareciera la alternativa.
- **Validar primero las restricciones del entorno antes de modificar la arquitectura.** El
  conflicto de puertos IPv4/IPv6 del experimento Docker es un ejemplo concreto de un riesgo
  operativo que solo se hizo evidente al ejecutar, no al diseñar — reforzando la importancia de
  verificar contra el entorno real antes de comprometerse con un enfoque.
- **Preferir decisiones arquitectónicas conservadoras cuando existen datos reales en juego.** Con
  datos de desarrollo reales ya presentes en la instancia local, el criterio correcto fue minimizar
  el blast radius de la solución (una extensión más sobre el mismo servidor) en vez de maximizar
  reproducibilidad teórica a costa de una migración innecesaria.

---

## 8. Estado final

**La arquitectura del proyecto permanece idéntica a la original. El único trabajo pendiente es
instalar pgvector sobre PostgreSQL local para continuar la Fase 3.**

---

*Documento de decisión arquitectónica (ADR). No forma parte del roadmap de implementación; su
propósito es exclusivamente preservar el razonamiento técnico de esta decisión para evitar
reabrir la misma discusión en el futuro. No se modificó código durante su redacción.*
