export type Level = "beginner" | "intermediate" | "advanced";
export type Format = "video" | "article" | "course" | "interactive" | "book" | "documentation";
export type Difficulty = "easy" | "medium" | "hard";
export type MasteryState = "not_assessed" | "beginning" | "developing" | "mastered";
export type StepStatus = "ready" | "in_progress" | "locked" | "mastered";

export interface Career {
  id: string;
  title: string;
  icon: string;
  description: string;
  topics: { topic_id: string; name: string; weight: number }[];
}

export interface Topic {
  id: string;
  name: string;
  domain: string;
  description: string;
  est_hours: number;
  prerequisites: string[];
  depth: number;
  question_count: number;
  resource_count: number;
}

export interface Profile {
  id: string;
  display_name: string | null;
  target_career_id: string | null;
  weekly_hours: number;
  preferred_formats: Format[];
  preferred_level: Level | null;
  learning_goal: string | null;
  onboarded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RoadmapStep {
  order: number;
  topic_id: string;
  name: string;
  domain: string;
  status: Exclude<StepStatus, "mastered">;
  mastery_score: number | null;
  state: MasteryState;
  career_weight: number;
  is_goal: boolean;
  prerequisites: string[];
  unmet_prerequisites: string[];
  unlocks: string[];
  est_hours_remaining: number;
  start_week: number;
  end_week: number;
  priority: number;
  reason: string;
}

export interface RoadmapNode {
  topic_id: string;
  name: string;
  domain: string;
  depth: number;
  mastery_score: number | null;
  state: MasteryState;
  status: StepStatus;
  order: number | null;
  is_goal: boolean;
  career_weight: number;
}

export interface RoadmapSummary {
  required_topics: number;
  mastered: number;
  remaining: number;
  ready_now: number;
  total_hours_remaining: number;
  estimated_weeks: number;
  progress: number;
}

export interface Roadmap {
  career_id: string;
  career_title: string;
  weekly_hours: number;
  steps: RoadmapStep[];
  graph: { nodes: RoadmapNode[]; edges: { source: string; target: string }[] };
  summary: RoadmapSummary;
}

export interface ResourceView {
  id: string;
  topic_id: string;
  title: string;
  provider: string;
  url: string;
  format: Format;
  difficulty: Level;
  est_minutes: number;
  description: string;
  tags: string[];
  progress: { status: "saved" | "in_progress" | "completed"; rating: number | null } | null;
}

export interface Recommendation {
  resource_id: string;
  topic_id: string;
  topic_name: string;
  score: number;
  cosine_similarity: number;
  components: { name: string; weight: number; value: number; contribution: number }[];
  target_level: Level;
  matched_terms: { term: string; share: number }[];
  reasons: string[];
  resource: ResourceView;
}

export interface Recommendations {
  items: Recommendation[];
  focus_topics: { topic_id: string; name: string; order: number | null; mastery_score: number | null }[];
  empty_reason: "no_career" | "roadmap_complete" | "filters_exclude_all" | null;
}

export interface AdaptationEvent {
  id: string;
  trigger: "assessment" | "profile" | "progress";
  assessment_id: string | null;
  summary: string;
  changes: {
    topic?: { id: string; name: string; previous_level: Level | null; previous_score: number | null; new_level: Level; new_score: number };
    newly_mastered?: { id: string; name: string }[];
    unlocked?: { id: string; name: string }[];
    roadmap?: { remaining_before: number | null; remaining_after: number | null; weeks_before: number | null; weeks_after: number | null; next_step_before: string | null; next_step_after: string | null };
    recommendations?: { added: string[]; removed: string[] };
  };
  created_at: string;
}

export interface AssessmentRow {
  id: string;
  topic_id: string;
  topic_name?: string;
  status: "in_progress" | "submitted";
  question_ids: string[];
  predicted_level: Level | null;
  mastery_score: number | null;
  probabilities: Record<Level, number> | null;
  accuracy: number | null;
  model_version: string | null;
  counted: boolean;
  excluded_reason: string | null;
  started_at: string;
  submitted_at: string | null;
}

export interface PublicQuestion {
  id: string;
  difficulty: Difficulty;
  prompt: string;
  options: string[];
  expected_seconds: number;
}

export interface ReviewItem extends PublicQuestion {
  correct_index: number;
  explanation: string;
  selected_index: number | null;
  is_correct: boolean | null;
  confidence: number | null;
  time_ms: number | null;
}

export interface Evidence {
  correct: number;
  total: number;
  by_difficulty: { difficulty: Difficulty; correct: number; total: number }[];
  median_seconds: number | null;
  rapid_answers: number;
  sure_answers: number;
  sure_but_wrong: number;
}

export interface AssessmentPayload {
  assessment: AssessmentRow;
  topic: { id: string; name: string; domain: string; description: string };
  questions?: PublicQuestion[];
  review?: ReviewItem[];
  evidence?: Evidence;
  resumed?: boolean;
}

export interface SubmitResult extends AssessmentPayload {
  counted: boolean;
  excluded_reason: string | null;
  estimate: { level: Level; mastery_score: number; confidence: number; probabilities: Record<Level, number>; model_version: string; features: Record<string, number | null> } | null;
  previous: { level: Level; mastery_score: number } | null;
  evidence: Evidence;
  review: ReviewItem[];
  adaptation: AdaptationEvent;
}

export interface MasteryRow {
  topic_id: string;
  topic_name: string;
  level: Level;
  mastery_score: number;
  confidence: number;
  accuracy: number;
  state: MasteryState;
  updated_at: string;
}

export interface Dashboard {
  profile: Profile;
  career: { id: string; title: string; icon: string; description: string } | null;
  roadmap_summary: RoadmapSummary | null;
  next_steps: RoadmapStep[];
  radar: { topic_id: string; name: string; weight: number; mastery_score: number | null; assessed: boolean }[];
  recommendations: Recommendations;
  recent_events: AdaptationEvent[];
  stats: { assessments_taken: number; topics_assessed: number; average_mastery: number | null; resources_completed: number; resources_in_progress: number };
}

export interface Analytics {
  totals: { assessments: number; topics_assessed: number; answers: number; overall_accuracy: number | null; resources_completed: number; hours_completed: number };
  timeline: { assessment_id: string; topic_id: string; topic_name: string; level: Level; mastery_score: number; accuracy: number; submitted_at: string }[];
  heatmap: { difficulties: Difficulty[]; rows: { topic_id: string; topic_name: string; mastery_score: number | null; cells: { difficulty: Difficulty; correct: number; total: number; accuracy: number | null }[] }[] };
  confidence_calibration: { confidence: number; label: string; answers: number; accuracy: number | null }[];
  pace: { difficulty: Difficulty; answers: number; median_seconds: number | null; expected_seconds: number }[];
  activity: { week_start: string; assessments: number; resources_completed: number }[];
  resources: { by_status: Record<"saved" | "in_progress" | "completed", number>; completed_by_format: Record<string, number> };
}

export interface MetricsRow {
  key: string;
  name: string;
  kind: "model" | "baseline";
  selected: boolean;
  accuracy: number;
  macro_f1: number;
  balanced_accuracy: number;
  quadratic_kappa: number;
  log_loss: number | null;
  brier: number | null;
}

export interface MlMetrics {
  generated_at: string;
  model_version: string;
  data: {
    synthetic: boolean; description: string; seed: number; n_learners: number; n_attempts: number; n_train: number; n_test: number;
    n_train_learners: number; n_test_learners: number; split: string; class_balance: Record<Level, number>;
    label_thresholds: { beginner_below_theta: number; advanced_above_theta: number }; catalog_fingerprint: string;
  };
  features: { name: string; description: string }[];
  model_selection: { criterion: string; selected: string; cv: { key: string; name: string; log_loss_mean: number; log_loss_std: number; macro_f1_mean: number; macro_f1_std: number }[] };
  test: {
    comparison: MetricsRow[];
    selected_model: string;
    per_class: { level: Level; precision: number; recall: number; f1: number; support: number }[];
    confusion_matrix: { labels: Level[]; matrix: number[][] };
    baseline_confusion_matrix: { labels: Level[]; matrix: number[][] };
    calibration: { bins: { bin_start: number; bin_end: number; mean_confidence: number; observed_accuracy: number; count: number }[]; expected_calibration_error: number };
    macro_f1_gain_vs_thresholds: { mean: number; ci_low: number; ci_high: number; n_boot: number };
    score_validity_spearman: { model_mastery_score: number; raw_accuracy: number; difficulty_weighted_score: number };
    feature_importance: { feature: string; description: string; importance_mean: number; importance_std: number }[];
    behavioural_checks: { case: string; expected: string | null; predicted: Level; counted: boolean; mastery_score: number; passed: boolean }[];
  };
  system_checks: {
    roadmap: { roadmaps_checked: number; steps_checked: number; prerequisite_violations: number };
    recommender: { task: string; k: number; queries: number; corpus_size: number; tfidf: { precision_at_k: number; mrr: number }; random: { precision_at_k: number; mrr: number } };
  };
  environment: Record<string, string>;
  serving: { model_version: string; model_name: string; classes: string[]; matches_metrics: boolean };
  policy: { mastered_threshold: number; developing_threshold: number; ranking_weights: Record<string, number>; mastery_score_formula: string };
}
