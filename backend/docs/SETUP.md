# Backend — Guía de instalación y ejecución

## Requisitos previos

- Python 3.11 o superior
- PostgreSQL 16+ (requerido — BD de negocio y checkpointer de LangGraph; ver §4)
- Git

## 1. Clonar el repositorio

```bash
git clone https://github.com/FernandoRodriguez4/Leanlang.git
cd Leanlang/backend
```

## 2. Crear y activar el entorno virtual

**Windows (PowerShell)**
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

**macOS / Linux**
```bash
python3 -m venv venv
source venv/bin/activate
```

## 3. Instalar dependencias

```bash
pip install --upgrade pip
pip install -r requirements.txt
pip install -e .
```

> La última línea instala el paquete local (`validation-blueprint-backend`) en modo editable.

## 4. Configurar variables de entorno

Copia el ejemplo y edita el archivo con tus valores reales:

```bash
cp .env.example .env
```

Variables críticas a configurar en `.env`:

| Variable | Descripción |
|---|---|
| `ANTHROPIC_API_KEY` | Clave de API de Anthropic (requerida para el agente) |
| `OPENAI_API_KEY` | Clave de OpenAI (opcional, si usas `LLM_PROVIDER=openai`) |
| `DATABASE_URL` | Cadena de conexión PostgreSQL (requerida — BD de negocio) |
| `LANGGRAPH_PG_DSN` | DSN de PostgreSQL para el checkpointer de LangGraph (requerida) |
| `JWT_SECRET` | Secreto largo y aleatorio para firmar tokens JWT |

> PostgreSQL es la única tecnología de persistencia del proyecto (Fase 6). Sin `DATABASE_URL`
> alcanzable, los endpoints de auth/proyectos/blueprints fallarán. Si `LANGGRAPH_PG_DSN` no
> es alcanzable, el grafo cae a un checkpointer en memoria (no persiste entre reinicios) en
> vez de fallar el arranque — ver `app/graph/runtime.py`.

## 5. Ejecutar el servidor

**Modo desarrollo (con hot-reload)**
```powershell
.\venv\Scripts\uvicorn.exe app.main:app --host 0.0.0.0 --port 8000 --reload
```

**macOS / Linux**
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

El servidor queda disponible en `http://localhost:8000`.

## 6. Verificar que funciona

```bash
curl http://localhost:8000/health
```

Respuesta esperada:
```json
{"status": "ok", "llm_provider": "anthropic", "llm_model": "claude-sonnet-4-5"}
```

Documentación interactiva: `http://localhost:8000/docs`

## 7. Migraciones con Alembic (requerido)

Antes del primer arranque, aplica el esquema de negocio en `public`:

```bash
alembic upgrade head
```

`alembic_version` queda en `public`; el esquema `langgraph` (checkpoints) lo gestiona
`PostgresSaver.setup()` al arrancar la app, no Alembic.

## Notas

- El archivo `.env` nunca debe commitearse (ya está en `.gitignore`).
- Sin `ANTHROPIC_API_KEY` válida, las rutas de agentes devolverán errores 500.
- Los checkpoints de LangGraph persisten en PostgreSQL (esquema `langgraph`), no en archivos locales.
