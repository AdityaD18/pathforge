"""Request and response models. Requests are strict so bad input fails with a clear 422."""
from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

Format = Literal["video", "article", "course", "interactive", "book", "documentation"]
Level = Literal["beginner", "intermediate", "advanced"]
ProgressStatus = Literal["saved", "in_progress", "completed"]
# Appearance themes (frontend/src/lib/themes.ts defines the palettes). "system" follows the device's light/dark setting.
Theme = Literal["system", "midnight", "aurora", "nebula", "ocean", "ember", "forest", "cyberpunk", "slate", "mono",
                "paper", "sky", "sakura", "mint", "sunset", "contrast", "custom"]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


# --- profile -----------------------------------------------------------------------------------
class ProfileUpdate(StrictModel):
    display_name: str | None = Field(None, max_length=80)
    target_career_id: str | None = Field(None, max_length=64, pattern=r"^[a-z0-9-]+$")
    weekly_hours: int | None = Field(None, ge=1, le=60)
    preferred_formats: list[Format] | None = Field(None, max_length=6)
    preferred_level: Level | None = None
    learning_goal: str | None = Field(None, max_length=500)
    theme: Theme | None = None
    theme_accent: str | None = Field(None, pattern=r"^#[0-9a-fA-F]{6}$")

    @field_validator("theme_accent")
    @classmethod
    def _lower(cls, v):
        return v.lower() if v else v

    @field_validator("preferred_formats")
    @classmethod
    def _dedupe(cls, v):
        return list(dict.fromkeys(v)) if v is not None else v


class Profile(BaseModel):
    id: UUID
    display_name: str | None
    target_career_id: str | None
    weekly_hours: int
    preferred_formats: list[str]
    preferred_level: str | None
    learning_goal: str | None
    theme: str = "system"
    theme_accent: str | None = None
    onboarded_at: datetime | None
    created_at: datetime
    updated_at: datetime


# --- assessments -------------------------------------------------------------------------------
class StartAssessment(StrictModel):
    topic_id: str = Field(..., max_length=64, pattern=r"^[a-z0-9-]+$")


class ResponseIn(StrictModel):
    question_id: str = Field(..., max_length=32)
    selected_index: int = Field(..., ge=0, le=3)
    confidence: int = Field(..., ge=1, le=3, description="1 = guess, 2 = unsure, 3 = sure")
    time_ms: int = Field(..., ge=0, le=3_600_000)


class SubmitAssessment(StrictModel):
    responses: list[ResponseIn] = Field(..., min_length=1, max_length=20)

    @field_validator("responses")
    @classmethod
    def _unique_questions(cls, v):
        ids = [r.question_id for r in v]
        if len(ids) != len(set(ids)):
            raise ValueError("Each question may be answered only once")
        return v


class QuestionOut(BaseModel):
    id: str
    difficulty: str
    prompt: str
    options: list[str]
    expected_seconds: int


# --- progress ---------------------------------------------------------------------------------
class ResourceProgressUpdate(StrictModel):
    status: ProgressStatus
    rating: int | None = Field(None, ge=1, le=5)
