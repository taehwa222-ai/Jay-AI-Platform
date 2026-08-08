from pydantic import BaseModel


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


class YoutubeProjectDetail(BaseModel):
    slug: str
    date: str
    research: str | None
    ideas: str | None
    qa: str | None
    script: str | None
    production: str | None
    review: str | None
