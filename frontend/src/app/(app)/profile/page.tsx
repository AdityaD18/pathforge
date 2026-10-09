"use client";

import { ProfileForm } from "@/components/profile-form";
import { PageHeader } from "@/components/ui/primitives";

export default function ProfilePage() {
  return (
    <div className="max-w-4xl">
      <PageHeader title="Profile and preferences"
        description="Changing your career or weekly hours rebuilds your roadmap. The change is logged on your dashboard." />
      <ProfileForm submitLabel="Save changes" />
    </div>
  );
}
