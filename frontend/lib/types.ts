// Tipos del dominio (espejo de los schemas Pydantic del backend)

export type RiskType = "desirability" | "feasibility" | "viability";
export type RiskLevel = "high" | "medium" | "low";
export type Stage = "discovery" | "validation";
export type Quadrant = "test_now" | "keep_evidence" | "deprioritize" | "park";

// — Lean Agents (Value Proposition Canvas distribuido) —
export interface Problem {
  statement: string;
  context: string;
  context_summary?: string;
  root_causes: string[];
  customer_jobs: string[];
  pains: string[];
}
export interface CustomerSegment {
  name: string;
  description: string;
  description_summary?: string;
  characteristics: string[];
  gains: string[];
  early_adopters: string;
  early_adopters_summary?: string;
}
export interface ValueProposition {
  statement: string;
  products_services: string[];
  pain_relievers: string[];
  gain_creators: string[];
  differentiator: string;
  differentiator_summary?: string;
}
export interface BusinessModel {
  channels: string[];
  customer_relationships: string[];
  revenue_streams: string[];
  key_resources: string[];
  key_activities: string[];
  key_partners: string[];
  cost_structure: string[];
}
export type DecisionType = "persevere" | "pivot" | "kill";
export interface DecisionRule {
  hypothesis_id: string;
  experiment_id: string;
  if_validated: string;
  if_invalidated: string;
  recommended_decision: DecisionType;
}
export interface RoadmapPhase {
  name: string;
  stage: Stage;
  goal: string;
  experiment_ids: string[];
  duration_estimate: string;
}
export interface ValidationRoadmap {
  phases: RoadmapPhase[];
  rationale: string;
}
export interface PlanEstimate {
  experiment_count: number;
  total_cost_points: number;
  total_effort_points: number;
  max_cost: number;
  required_capabilities: string[];
  within_budget: boolean;
  within_time: boolean;
  warnings: string[];
}
export interface MetricSpec {
  hypothesis_id: string;
  experiment_id: string;
  metric: string;
  data_source: string;
  rationale: string;
}
export interface SuccessCriterion {
  hypothesis_id: string;
  experiment_id: string;
  criterion: string;
  threshold: string;
  expected_evidence_strength: number;
}
export interface Report {
  executive_summary: string;
  problem_summary: string;
  value_proposition_summary: string;
  riskiest_hypotheses: string[];
  recommended_sequence: string[];
  success_definition: string;
  next_steps: string[];
}

export interface Constraints {
  budget_level: "very_low" | "low" | "medium" | "high";
  time_horizon: "days" | "weeks" | "months";
  stage: Stage;
}

export interface Project {
  id: string;
  name: string;
  raw_idea: string;
  constraints: Constraints;
  created_at: string;
}

export interface Hypothesis {
  id: string;
  statement: string;
  source_block: string;
  is_counter_hypothesis: boolean;
}

export interface Classification {
  hypothesis_id: string;
  risk_type: RiskType;
  risk_level?: RiskLevel;
  bmc_block: string;
  rationale: string;
}

export interface Prioritization {
  hypothesis_id: string;
  importance: number;
  evidence: number;
  quadrant: Quadrant;
  is_riskiest: boolean;
  rationale: string;
}

export interface ExperimentRec {
  hypothesis_id: string;
  experiment_id: string;
  experiment_name: string;
  sequence_order: number;
  stage: Stage;
  rationale: string;
  design_detail?: string;
  expected_evidence_strength: number;
  cost: number;
}

export interface TestCard {
  hypothesis_id: string;
  experiment_id: string;
  hypothesis_statement: string;
  test_description: string;
  metric: string;
  success_criteria: string;
  expected_evidence_strength: number;
  cost: number;
  duration_estimate: string;
}

export interface CriticIssue {
  pitfall: string;
  severity: string;
  detail: string;
  suggestion: string;
}

export interface CriticReview {
  quality_score: number;
  passed: boolean;
  issues: CriticIssue[];
  summary: string;
}

// — Agente Investigador (Tavily) —
export interface Source {
  title: string;
  url: string;
  snippet: string;
}

export interface Competitor {
  name: string;
  description: string;
  url?: string | null;
}

export interface ResearchReport {
  status: string;
  confidence: string;
  generated_at: string;
  queries: string[];
  market_summary: string;
  competitors: Competitor[];
  trends: string[];
  benchmarks: string[];
  regulations: string[];
  studies: string[];
  sources: Source[];
}

export interface Blueprint {
  problem?: Problem;
  customer_segment?: CustomerSegment;
  value_proposition?: ValueProposition;
  business_model?: BusinessModel;
  hypotheses?: Hypothesis[];
  classifications?: Classification[];
  prioritization?: Prioritization[];
  recommendations?: ExperimentRec[];
  metric_specs?: MetricSpec[];
  success_criteria?: SuccessCriterion[];
  decisions?: DecisionRule[];
  validation_roadmap?: ValidationRoadmap;
  plan_estimate?: PlanEstimate;
  test_cards?: TestCard[];
  critic_review?: CriticReview;
  report?: Report;
  research?: ResearchReport;
}

// Eventos SSE
export type SSEEvent =
  | { event: "started"; blueprint_id: string }
  | { event: "agent_update"; node: string; trace?: string; artifacts?: Partial<Blueprint> }
  | { event: "interrupt"; type: string; payload: any }
  | { event: "awaiting_input"; blueprint: Blueprint }
  | { event: "done"; blueprint: Blueprint }
  | { event: "error"; message: string };
