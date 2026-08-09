from pydantic import BaseModel


class DisclosureItem(BaseModel):
    title: str
    date: str
    receipt_no: str
    url: str
