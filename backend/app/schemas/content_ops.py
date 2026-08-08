from pydantic import BaseModel


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
