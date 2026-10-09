"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, qs } from "@/lib/api";
import type {
  Analytics, AssessmentPayload, AssessmentRow, Career, Dashboard, MasteryRow, MlMetrics, Profile, Recommendations,
  ResourceView, Roadmap, SubmitResult, Topic,
} from "@/lib/types";

const forever = { staleTime: Infinity, gcTime: Infinity };

export const useCareers = () => useQuery({ queryKey: ["careers"], queryFn: () => api<Career[]>("/api/catalog/careers", { auth: false }), ...forever });
export const useTopics = () => useQuery({ queryKey: ["topics"], queryFn: () => api<Topic[]>("/api/catalog/topics", { auth: false }), ...forever });
export const useMetrics = () => useQuery({ queryKey: ["ml-metrics"], queryFn: () => api<MlMetrics>("/api/ml/metrics", { auth: false }), ...forever });

export const useProfile = (enabled = true) => useQuery({ queryKey: ["profile"], queryFn: () => api<Profile>("/api/me/profile"), enabled });
/** The learner's IANA time zone, so streaks and "this week" follow their own calendar. */
const tz = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
};

export const useDashboard = () => useQuery({ queryKey: ["dashboard"], queryFn: () => api<Dashboard>(`/api/me/dashboard${qs({ tz: tz() })}`) });
export const useMastery = () => useQuery({ queryKey: ["mastery"], queryFn: () => api<MasteryRow[]>("/api/me/mastery") });
export const useAnalytics = () => useQuery({ queryKey: ["analytics"], queryFn: () => api<Analytics>(`/api/me/analytics${qs({ tz: tz() })}`) });
export const useMyResources = () => useQuery({ queryKey: ["my-resources"], queryFn: () => api<(ResourceView & { topic_name: string })[]>("/api/me/resources") });
export const useAssessments = () => useQuery({ queryKey: ["assessments"], queryFn: () => api<AssessmentRow[]>("/api/assessments?limit=200") });

export const useRoadmap = (enabled = true) =>
  useQuery({ queryKey: ["roadmap"], queryFn: () => api<Roadmap>("/api/me/roadmap"), enabled, retry: (n, e) => (e as { status?: number }).status !== 409 && n < 2 });

export function useRecommendations(filters: { format?: string[]; level?: string[]; cost?: string[]; topic?: string | null; limit?: number }) {
  return useQuery({
    queryKey: ["recommendations", filters],
    queryFn: () => api<Recommendations>(`/api/me/recommendations${qs({
      format: filters.format, level: filters.level, cost: filters.cost, topic: filters.topic, limit: filters.limit ?? 12,
    })}`),
    retry: (n, e) => ![404, 409].includes((e as { status?: number }).status ?? 0) && n < 2,
  });
}

export const useAssessment = (id: string) =>
  useQuery({ queryKey: ["assessment", id], queryFn: () => api<AssessmentPayload>(`/api/assessments/${id}`) });

/** Everything that depends on learner state is invalidated together after any write. */
export function useInvalidateLearner() {
  const qc = useQueryClient();
  return () => Promise.all(["profile", "dashboard", "mastery", "analytics", "roadmap", "recommendations", "assessments", "my-resources"]
    .map((k) => qc.invalidateQueries({ queryKey: [k] })));
}

export function useUpdateProfile() {
  const invalidate = useInvalidateLearner();
  return useMutation({
    mutationFn: (body: Partial<Pick<Profile, "display_name" | "target_career_id" | "weekly_hours" | "preferred_formats" | "preferred_level" | "learning_goal">>) =>
      api<Profile>("/api/me/profile", { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: invalidate,
  });
}

/** Saves only the appearance fields; avoids refetching the whole learner state. */
export function useSaveTheme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { theme: string; theme_accent: string | null }) =>
      api<Profile>("/api/me/profile", { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: (p) => qc.setQueryData(["profile"], p),
  });
}

export function useStartAssessment() {
  return useMutation({
    mutationFn: (topic_id: string) => api<AssessmentPayload>("/api/assessments", { method: "POST", body: JSON.stringify({ topic_id }) }),
  });
}

export function useSubmitAssessment(id: string) {
  const invalidate = useInvalidateLearner();
  return useMutation({
    mutationFn: (responses: { question_id: string; selected_index: number; confidence: number; time_ms: number }[]) =>
      api<SubmitResult>(`/api/assessments/${id}/submit`, { method: "POST", body: JSON.stringify({ responses }) }),
    onSuccess: invalidate,
  });
}

export function useSetProgress() {
  const invalidate = useInvalidateLearner();
  return useMutation({
    mutationFn: ({ id, status, rating }: { id: string; status: "saved" | "in_progress" | "completed" | null; rating?: number | null }) =>
      status === null
        ? api<void>(`/api/me/resources/${id}/progress`, { method: "DELETE" })
        : api(`/api/me/resources/${id}/progress`, { method: "PUT", body: JSON.stringify(rating ? { status, rating } : { status }) }),
    onSuccess: invalidate,
  });
}
