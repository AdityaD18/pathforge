"use client";

import { Compass } from "lucide-react";
import { useRouter } from "next/navigation";

import { ProfileForm } from "@/components/profile-form";
import { PageHeader } from "@/components/ui/primitives";

export default function OnboardingPage() {
  const router = useRouter();
  return (
    <div className="max-w-5xl">
      <PageHeader icon={Compass} eyebrow="Welcome" title="Let's build your roadmap" description="A few quick choices. Change them any time." />
      <ProfileForm submitLabel="Build my roadmap" onSaved={() => router.push("/dashboard")} />
    </div>
  );
}
