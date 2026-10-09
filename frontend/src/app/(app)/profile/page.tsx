"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { Palette, SlidersHorizontal, UserRound } from "lucide-react";

import { ProfileForm } from "@/components/profile-form";
import { ThemeGallery } from "@/components/theme-picker";
import { PageHeader } from "@/components/ui/primitives";

export default function ProfilePage() {
  return (
    <div className="max-w-5xl">
      <PageHeader icon={UserRound} title="Profile" description="Your goals, pace and how PathForge looks." />
      <Tabs.Root defaultValue="learning">
        <Tabs.List className="mb-6 inline-flex rounded-full border border-line p-1" aria-label="Profile sections">
          <Tabs.Trigger value="learning" className="flex items-center gap-2 rounded-full px-5 py-2 text-[15px] text-mist data-[state=active]:bg-electric data-[state=active]:text-on-accent">
            <SlidersHorizontal className="size-4" /> Learning
          </Tabs.Trigger>
          <Tabs.Trigger value="appearance" className="flex items-center gap-2 rounded-full px-5 py-2 text-[15px] text-mist data-[state=active]:bg-electric data-[state=active]:text-on-accent">
            <Palette className="size-4" /> Appearance
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="learning"><ProfileForm submitLabel="Save changes" /></Tabs.Content>
        <Tabs.Content value="appearance"><ThemeGallery signedIn /></Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
