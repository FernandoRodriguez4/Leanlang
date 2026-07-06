# Análisis: Mecanismos de RAG y Contexto en el Backend

## ✅ SÍ HAY mecanismos anti-alucinación, pero NO es RAG tradicional

### 1. Estado Persistente Global (BlueprintState)
- **Archivo:** `app/schemas/state.py`
- El backend mantiene un **estado compartido completo** que fluye entre todos los nodos/agentes
- Cada agente recibe TODO el contexto acumulado de agentes anteriores (problema, segmento, valor, hipótesis, riesgos, experimentos, etc.)
- El estado se **persiste en PostgreSQL** via LangGraph checkpointing
- Esto previene alucinaciones porque el contexto no se olvida entre pasos

### 2. Checkpointing en PostgreSQL (LangGraph)
- **Archivo:** `app/graph/runtime.py`
- Usa `PostgresSaver` para guardar el estado completo entre nodos
- Base de datos: `blueprint` schema con tablas: 
  - `checkpoint`
  - `checkpoint_blobs`
  - `checkpoint_writes`
  - `checkpoint_migrations`
- El grafo compilado persiste el estado automáticamente

### 3. Recuperación de Datos de Base de Datos (Catálogo)
- **Archivo:** `app/catalog/service.py`
- El **Experiment Design Agent** consulta un catálogo de 44 experimentos reales
- Método: `query_experiments()` filtra por:
  - Tipo de riesgo (desirability, feasibility, viability)
  - Etapa (discovery, validation)
  - Restricciones de costo y tiempo
  - Ordenado por: evidencia fuerte → costo menor → tiempo menor
- Esto es un **anclaje a datos reales** (no alucinación, sino recuperación determinista)
- Usados por:
  - `experiment_design_node()` para construir el pool permitido
  - `plan_estimate_node()` para calcular costos totales

### 4. Validación Estructurada de Salidas
- **Archivo:** `app/core/llm.py` líneas 37-50
- Usa `get_structured_model()` con validación contra Pydantic schemas
- Método: function-calling (compatible con OpenAI/Anthropic/DeepSeek)
- Incluye **retry logic** (`with_retry(stop_after_attempt=3)`)
- Si el LLM devuelve JSON vacío o malformado, reintenta automáticamente
- Evita que respuestas inválidas causen errores en cascada

### 5. Prompts Altamente Contextualizados
- **Archivo:** `app/agents/prompts/__init__.py`
- Cada agente recibe instrucciones que incluyen:
  - El artefacto anterior completo (ej: Problem Agent → Customer Segment Agent)
  - Restricciones explícitas
    - "SOLO puedes recomendar experimentos del catálogo, NUNCA inventes"
    - "Si algo no se infiere, deja la lista vacía en vez de alucinar"
  - Reglas anti-sesgo (genera contra-hipótesis, evita confirmación)
  - Criterios específicos de validación
- Ejemplos de instrucciones anti-alucinación:
  - Problem Agent: "Se concreto; si algo no se infiere, deja la lista vacia"
  - Experiment Design Agent: "NUNCA inventes experimentos ni ids"
  - Business Model Agent: "Si algo no se infiere razonablemente, deja la lista vacia"

### 6. Observabilidad con LangSmith
- **Archivo:** `app/core/config.py` líneas 36-42
- Instrumentación de llamadas (`@traceable`) para auditar cada step
- Permite revisar qué contexto vio cada agente
- Rastreo en: `https://api.smith.langchain.com`
- Proyecto por defecto: `validation-blueprint-dev`

---

## ❌ NO implementa:
- ❌ **RAG (Retrieval Augmented Generation):** No hay búsqueda semántica en documentos
- ❌ **Embeddings:** No hay vector database (Chroma, Pinecone, Weaviate, etc.)
- ❌ **Memory Buffer adicional:** El BlueprintState es suficiente
- ❌ **Búsqueda semántica:** Solo recuperación determinista (filtros de catálogo)
- ❌ **Conexión a APIs externas:** Solo catálogo interno y PostgreSQL

### Dependencias instaladas (requirements.txt):
```
langchain==1.3.11
langchain-anthropic==1.4.8
langchain-core==1.4.8
langchain-openai==1.3.3
langchain-protocol==0.0.18
```
**Nota:** NO hay `langchain-text-splitters`, `pinecone`, `chroma`, `weaviate` ni otras librerías de embeddings/RAG.

---

## 🎯 El Enfoque del Backend: "Context-Carryover"

### Flujo:
1. Cada agente recibe el **BlueprintState completo** del paso anterior
2. Enriquece ese estado (ej: agrega hipótesis validadas)
3. Pasa el estado mejorado al siguiente agente via `return {"field": value}`
4. El flujo garantiza que **no hay contexto perdido**

### Arquitectura en LangGraph:
```
START 
  → supervisor (triaje)
    → problem → customer_segment → value_proposition → business_model
    → hypotheses → human_hypotheses → risk → human_prioritization
    → experiment_design → metrics → success_criteria → decision
    → sequencing → plan_estimate → critic
    → (loop si hay cambios) O report → human_approval → END
```

Cada flecha es una transición de estado. El estado acumula información.

---

## ✅ Ventajas del enfoque actual:
- **Reproducible:** El estado es determinista, sin aleatoriedad en el contexto
- **Auditables:** LangSmith puede revisar qué vio cada agente en cada step
- **Escalable:** No depende de un vector DB externo, solo PostgreSQL
- **Validado:** Schemas Pydantic + retry logic evita datos inválidos
- **Controlable:** Cada agente sabe exactamente qué contexto tiene

---

## ⚠️ Limitaciones:
- **Crecimiento lineal del contexto:** Cuando hayas 20 hipótesis probadas, cada agente futuro las ve todas
- **Sin búsqueda semántica:** Si necesitaras encontrar "experimentos similares a X" basados en significado, no hay
- **Sin recuperación de documentos externos:** No puede leer papers, estudios de mercado, o contenido dinámico de APIs externas
- **Token context limited:** Si el estado crece demasiado, puede exceder límites de contexto del LLM

---

## 💡 Recomendaciones Futuras (si necesitaras RAG):

### Escenario 1: Búsqueda en documentos internos
Si en el futuro necesitas que los agentes consulten documentos externos (papers, estudios de mercado, etc.):
1. Agregar embeddings: `langchain-text-splitters` + modelo (ej: OpenAI embeddings)
2. Usar vector DB: Postgres con extensión `pgvector` (sin dependencias externas)
3. Integrar búsqueda semántica en los prompts del agente relevante

### Escenario 2: Contexto dinámico sin alucinación
Si el BlueprintState crece demasiado:
1. Implementar resumen automático de contexto anterior (ej: critic resume artefactos intermedios)
2. Agregar "context pruning" para mantener solo información relevante
3. Usar sliding window de últimos N pasos

### Escenario 3: Conexión a APIs de datos externas
Si necesitas datos real-time (precios, tendencias, competencia):
1. Integrar tool-calling a APIs externas en prompts específicos
2. Mantener caché de respuestas en BlueprintState
3. Agregar "retrieval flags" para controlar cuándo buscar vs. reutilizar

---

## 📝 Resumen Ejecutivo:

**¿Hay RAG?** No, pero sí hay un mecanismo robusto de **recuperación de contexto persistente**.

**¿Alucinaciones?** Minimizadas por:
- Estado compartido completo entre nodos
- Validación estructurada (Pydantic + retry)
- Instrucciones explícitas anti-alucinación
- Anclaje a catálogo real de experimentos

**Tipo:** Sistema "stateful multi-agent" con checkpointing, no "retrieval-augmented".

**Stack:** LangGraph + PostgreSQL + LangChain (sin embeddings).
