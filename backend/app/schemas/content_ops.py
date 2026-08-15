from pydantic import BaseModel, Field


class ReviewMetrics(BaseModel):
    view_count: str | None
    ctr: str | None
    avg_watch_time: str | None
    subscriber_delta: str | None
    engagement: str | None
    top_traffic_source: str | None


class YoutubeProjectSummary(BaseModel):
    slug: str
    date: str
    has_research: bool
    has_ideas: bool
    has_qa: bool
    has_script: bool
    has_production: bool
    has_review: bool
    updated_at: str
    view_count: str | None = None


class YoutubeProjectDetail(BaseModel):
    slug: str
    date: str
    research: str | None
    ideas: str | None
    qa: str | None
    script: str | None
    production: str | None
    review: str | None
    review_metrics: ReviewMetrics | None = None


class EmoticonSetSummary(BaseModel):
    set_key: str
    has_set_doc: bool
    has_submission_checklist: bool
    has_submission_copy: bool


class EmoticonProjectSummary(BaseModel):
    slug: str
    has_character: bool
    has_research: bool
    has_qa: bool
    has_friends: bool
    has_review: bool
    sets: list[EmoticonSetSummary]
    updated_at: str


class EmoticonSetDetail(BaseModel):
    set_key: str
    set_doc: str | None
    submission_checklist: str | None
    submission_copy: str | None


class EmoticonProjectDetail(BaseModel):
    slug: str
    character: str | None
    research: str | None
    qa: str | None
    friends: str | None
    review: str | None
    sets: list[EmoticonSetDetail]


class ContentDocument(BaseModel):
    filename: str
    content: str
    updated_at: str


class ContentDocumentUpdate(BaseModel):
    content: str = Field(max_length=500_000)
