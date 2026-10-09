"use client";

import { useRouter } from "next/navigation";

import { ProfileForm } from "@/components/profile-form";
import { PageHeader } from "@/components/ui/primitives";

export default function OnboardingPage() {
  const router = useRouter();
  return (
    <div className="max-w-4xl">
      <PageHeader title="Set your direction"
        description="Pick where you're headed and how much time you have. Your first roadmap is built from this; assessments refine it." />
      <ProfileForm submitLabel="Build my roadmap" onSaved={() => router.push("/dashboard")} />
    </div>
  );
}
