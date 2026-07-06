# 🛠️ Skills de Desarrollo para Claude Code (Backend & Frontend)

Colección curada de **82 skills de desarrollo** (Agent Skills) para usar con **Claude Code**, Codex, Cursor, Gemini CLI y otros agentes compatibles con el estándar [Agent Skills](https://code.claude.com/docs/en/skills). El área de **frontend está ampliada a 28 skills** con el *top recomendado* de la web (Vercel Labs, Google/shadcn, wshobson, freshtechbro).

Cada skill es una carpeta autocontenida con un archivo `SKILL.md` (instrucciones + metadatos) y, opcionalmente, `scripts/` y `references/`. Las skills se cargan dinámicamente: Claude lee la descripción y activa la skill solo cuando la tarea lo requiere.

> Descargadas el **2026-06-17** desde los repos oficiales y comunitarios listados en [Fuentes y licencias](#-fuentes-y-licencias).

---

## 📂 Estructura

```
D:\skills\
├── frontend\            UI, React/Next, Tailwind, shadcn, diseño, accesibilidad (28 skills)
│   ├── animation-3d\    Motion, GSAP, Three.js, Lottie, anime.js, scroll FX
│   └── ui-design\       Fundamentos visuales, interacción, design systems
├── backend\             APIs, servicios, MCP, secretos, pagos
├── fullstack\           Arquitectura end-to-end, evaluación de stack
├── database\            Diseño de esquemas, SQL, modelado de datos
├── devops-cloud\        CI/CD, Docker, K8s, Terraform, AWS/Azure/GCP, SRE
├── qa-testing\          Testing E2E, TDD, Playwright, code review
├── ai-llm\              API de Claude, RAG, prompt/ML engineering
├── performance\         Profiling y auditoría de dependencias
├── productivity-tools\  Onboarding, monorepos, git worktrees, changelogs
├── documents\           Generación de DOCX / PDF / PPTX / XLSX (backend)
├── security\            Seguridad de aplicaciones y SecOps
├── LICENSES\            Licencias de los repos de origen
└── README.md            (este archivo)
```

---

## 📖 Catálogo completo

### 🎨 frontend (28)

**⭐ Top 10 recomendado** (las más instaladas/recomendadas en la web, 2026):
| # | Skill | Origen | Para qué sirve |
|---|---|---|---|
| 1 | `react-best-practices` | Vercel Labs | 60+ reglas de rendimiento React/Next (re-renders, waterfalls, imports). La más instalada (~149k). |
| 2 | `web-design-guidelines` | Vercel Labs | Audita UI: tipografía, espaciado, color, responsive y accesibilidad. |
| 3 | `composition-patterns` | Vercel Labs | Componentes compuestos y composición escalable (evita prop drilling). |
| 4 | `shadcn-ui` | capraidev | Construir UIs Next.js con shadcn/ui + Radix + Tailwind correctamente. |
| 5 | `tailwind-design-system` | wshobson | Design systems con tokens y variantes de componentes en Tailwind. |
| 6 | `nextjs-app-router-patterns` | wshobson | Patrones de Next.js App Router (Server vs Client Components). |
| 7 | `react-state-management` | wshobson | Gestión de estado: hooks, context, stores. |
| 8 | `responsive-design` | wshobson | Diseño responsive, breakpoints y mobile-first. |
| 9 | `modern-web-design` | freshtechbro | Sistemas de diseño y mejores prácticas de UI moderna. |
| 10 | `react-view-transitions` | Vercel Labs | Transiciones de vista nativas en React para navegación fluida. |

**Base (oficial Anthropic + senior):**
| Skill | Para qué sirve |
|---|---|
| `frontend-design` | Dirección visual: paleta, tipografía y layout con identidad propia (oficial Anthropic). |
| `senior-frontend` | Patrones React/Vue, estado, rendimiento y arquitectura de UI. |
| `web-artifacts-builder` | Construir apps/artefactos web interactivos React+Tailwind+shadcn (oficial Anthropic). |
| `theme-factory` | Sistemas de temas y design tokens (oficial Anthropic). |
| `canvas-design` | Diseño en canvas y composición visual (oficial Anthropic). |
| `a11y-audit` | Auditoría de accesibilidad (WCAG, ARIA, contraste). |

**📁 `frontend/animation-3d/` — animación e interactividad (freshtechbro):**
| Skill | Para qué sirve |
|---|---|
| `motion-framer` | Animaciones declarativas con Motion / Framer Motion (React). |
| `gsap-scrolltrigger` | Animaciones basadas en scroll con GSAP ScrollTrigger. |
| `react-three-fiber` | 3D en React (abstracción de Three.js). |
| `threejs-webgl` | Gráficos 3D WebGL con Three.js. |
| `react-spring-physics` | Animaciones físicas para React (react-spring). |
| `lottie-animations` | Reproducción de animaciones vectoriales Lottie. |
| `scroll-reveal-libraries` | Efectos "animate on scroll" (AOS). |
| `animejs` | Motor de animación JavaScript anime.js. |

**📁 `frontend/ui-design/` — fundamentos de diseño UI (wshobson):**
| Skill | Para qué sirve |
|---|---|
| `visual-design-foundations` | Fundamentos de diseño visual (jerarquía, color, tipografía). |
| `interaction-design` | Diseño de interacción y microinteracciones. |
| `web-component-design` | Diseño de componentes web reutilizables. |
| `design-system-patterns` | Patrones para construir y mantener design systems. |

### ⚙️ backend (9)
| Skill | Para qué sirve |
|---|---|
| `senior-backend` | REST/GraphQL, microservicios, auth, hardening (Node/Express/Fastify, PostgreSQL). |
| `api-design-reviewer` | Revisión de diseño de API REST: linting, breaking changes, scorecards. |
| `api-test-suite-builder` | Genera suites de pruebas de API automatizadas. |
| `mcp-builder` | Construir servidores MCP (Model Context Protocol) (oficial Anthropic). |
| `migration-architect` | Planificación de migraciones de datos/servicios sin downtime. |
| `feature-flags-architect` | Diseño de feature flags y rollouts progresivos. |
| `stripe-integration-expert` | Integración de pagos con Stripe. |
| `env-secrets-manager` | Gestión de variables de entorno y secretos. |
| `secrets-vault-manager` | Manejo de bóvedas de secretos (Vault, etc.). |

### 🧩 fullstack (3)
| Skill | Para qué sirve |
|---|---|
| `senior-fullstack` | Desarrollo end-to-end integrando frontend + backend. |
| `senior-architect` | Diseño de sistemas y decisiones arquitectónicas. |
| `tech-stack-evaluator` | Evaluación y comparación de stacks tecnológicos. |

### 🗄️ database (3)
| Skill | Para qué sirve |
|---|---|
| `database-designer` | Diseño de bases de datos relacionales y NoSQL. |
| `database-schema-designer` | Modelado detallado de esquemas y relaciones. |
| `sql-database-assistant` | Escritura/optimización de consultas SQL. |

### ☁️ devops-cloud (12)
| Skill | Para qué sirve |
|---|---|
| `senior-devops` | Prácticas DevOps, automatización y pipelines. |
| `ci-cd-pipeline-builder` | Construcción de pipelines CI/CD. |
| `docker-development` | Contenedores Docker y buenas prácticas. |
| `kubernetes-operator` | Operación y manifiestos de Kubernetes. |
| `helm-chart-builder` | Creación de Helm Charts. |
| `terraform-patterns` | Patrones de IaC con Terraform. |
| `observability-designer` | Logs, métricas y tracing (observabilidad). |
| `slo-architect` | Definición de SLO/SLI y error budgets. |
| `chaos-engineering` | Ingeniería del caos y pruebas de resiliencia. |
| `aws-solution-architect` | Arquitectura de soluciones en AWS. |
| `azure-cloud-architect` | Arquitectura de soluciones en Azure. |
| `gcp-cloud-architect` | Arquitectura de soluciones en GCP. |

### ✅ qa-testing (7 + suite)
| Skill | Para qué sirve |
|---|---|
| `senior-qa` | Estrategias de testing y automatización de QA. |
| `tdd-guide` | Desarrollo guiado por pruebas (TDD). |
| `webapp-testing` | Pruebas de aplicaciones web (oficial Anthropic). |
| `browser-automation` | Automatización de navegador para E2E. |
| `code-reviewer` | Revisión de código con buenas prácticas. |
| `pr-review-expert` | Revisión experta de Pull Requests. |
| `playwright-pro` | Suite completa de Playwright (10 sub-skills: generate, fix, coverage, review, report, migrate, init, pw, browserstack, testrail). |

### 🤖 ai-llm (4)
| Skill | Para qué sirve |
|---|---|
| `claude-api` | Uso de la API de Claude/Anthropic (oficial, multi-lenguaje). |
| `rag-architect` | Diseño de sistemas RAG (Retrieval-Augmented Generation). |
| `senior-prompt-engineer` | Ingeniería de prompts avanzada. |
| `senior-ml-engineer` | Ingeniería de Machine Learning. |

### ⚡ performance (2)
| Skill | Para qué sirve |
|---|---|
| `performance-profiler` | Profiling y optimización de rendimiento. |
| `dependency-auditor` | Auditoría de dependencias y compatibilidad de licencias. |

### 🧰 productivity-tools (8)
| Skill | Para qué sirve |
|---|---|
| `skill-creator` | Crear tus propias skills (oficial Anthropic). |
| `spec-driven-workflow` | Flujo de trabajo guiado por especificaciones. |
| `monorepo-navigator` | Navegación y gestión de monorepos. |
| `codebase-onboarding` | Onboarding rápido a una base de código. |
| `git-worktree-manager` | Gestión de git worktrees. |
| `changelog-generator` | Generación de changelogs. |
| `tech-debt-tracker` | Seguimiento de deuda técnica. |
| `runbook-generator` | Generación de runbooks operativos. |

### 📄 documents (4)
| Skill | Para qué sirve |
|---|---|
| `docx` | Crear/editar documentos Word (oficial Anthropic). |
| `pdf` | Manipular PDFs (oficial Anthropic). |
| `pptx` | Generar presentaciones PowerPoint (oficial Anthropic). |
| `xlsx` | Manejar hojas de cálculo Excel (oficial Anthropic). |

### 🔒 security (2)
| Skill | Para qué sirve |
|---|---|
| `senior-security` | Seguridad de aplicaciones y hardening. |
| `senior-secops` | Operaciones de seguridad (SecOps). |

---

## 🚀 Cómo usar estas skills en Claude Code

Las skills se descubren automáticamente desde carpetas específicas. Tienes tres opciones:

**Opción A — A nivel de usuario (disponibles en todos tus proyectos):**
Copia las carpetas de skills que quieras a `~/.claude/skills/` (en Windows: `C:\Users\arley\.claude\skills\`). Cada skill debe quedar como `…/.claude/skills/<nombre-skill>/SKILL.md`.

```powershell
# Ejemplo: instalar la skill senior-backend a nivel de usuario
Copy-Item -Recurse "D:\skills\backend\senior-backend" "$env:USERPROFILE\.claude\skills\senior-backend"
```

**Opción B — A nivel de proyecto (solo para un repo):**
Copia la carpeta de la skill a `<tu-proyecto>\.claude\skills\<nombre-skill>\`.

**Opción C — Apuntar Claude Code a esta carpeta:**
Puedes pedirle a Claude Code que lea una skill concreta indicando su ruta, p. ej. `D:\skills\backend\senior-backend\SKILL.md`.

> ℹ️ Las subcarpetas por categoría (`frontend/`, `backend/`, …) son solo para organizar. Claude Code espera que cada **skill individual** (la carpeta con `SKILL.md`) esté directamente bajo `.claude/skills/`. Al instalar, copia la carpeta de la skill, no la de la categoría.

Tras instalarlas, reinicia Claude Code y verifica con el comando `/skills` o pídele que liste las skills disponibles.

---

## 📜 Fuentes y licencias

| Origen | Skills | Licencia |
|---|---|---|
| [anthropics/skills](https://github.com/anthropics/skills) (oficial Anthropic) | frontend-design, web-artifacts-builder, theme-factory, canvas-design, mcp-builder, webapp-testing, claude-api, skill-creator, docx, pdf, pptx, xlsx | `LICENSE.txt` incluido dentro de cada skill |
| [alirezarezvani/claude-skills](https://github.com/alirezarezvani/claude-skills) | la mayoría de backend/devops/qa/db/etc. | MIT — `LICENSES/MIT-alirezarezvani-claude-skills.txt` |
| [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | react-best-practices, web-design-guidelines, composition-patterns, react-view-transitions | MIT — `LICENSES/MIT-vercel-labs-agent-skills.txt` |
| [wshobson/agents](https://github.com/wshobson/agents) | tailwind-design-system, nextjs-app-router-patterns, react-state-management, responsive-design, y `ui-design/*` | MIT — `LICENSES/MIT-wshobson-agents.txt` |
| [freshtechbro/claudedesignskills](https://github.com/freshtechbro/claudedesignskills) | modern-web-design y todo `animation-3d/*` | MIT — `LICENSES/MIT-freshtechbro-claudedesignskills.txt` |
| [capraidev/shadcn-claude-skill](https://github.com/capraidev/shadcn-claude-skill) | shadcn-ui | ver `LICENSES/LICENSE-capraidev-shadcn-claude-skill.txt` |

Las skills oficiales de Anthropic conservan su `LICENSE.txt` dentro de cada carpeta. Respeta los términos de cada licencia al redistribuir o modificar.

### Rankings consultados para el "top" de frontend
- [AgenticSkills — Best Frontend Skills 2026](https://agenticskills.io/learn/best-frontend-skills) (ranking Core 5 + design system).
- [Snyk — Top Claude Skills for UI/UX Engineers](https://snyk.io/articles/top-claude-skills-ui-ux-engineers/).
- [Claude blog — Improving frontend design through Skills](https://claude.com/blog/improving-frontend-design-through-skills).
- [Vercel — Introducing React Best Practices](https://vercel.com/blog/introducing-react-best-practices).

### Otras colecciones útiles (no descargadas)
- [VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills) — 1000+ skills.
- [masonjames/Shadcnblocks-Skill](https://github.com/masonjames/Shadcnblocks-Skill) — 2.500+ bloques shadcn/ui.
- [travisvn/awesome-claude-skills](https://github.com/travisvn/awesome-claude-skills) — lista curada.
- [Claude-Plugins.dev](https://claude-plugins.dev/skills) — buscador de skills.
