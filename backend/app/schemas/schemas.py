from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(LoginRequest):
    pass


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    role: str
    created_at: datetime


class DatasetCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None


class DatasetUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None


class DatasetRead(DatasetCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_by: int
    created_at: datetime


class ImageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    dataset_id: int
    filename: str
    source_folder: str | None = None
    width: int
    height: int
    uploaded_by: int
    created_at: datetime


class AnnotationBase(BaseModel):
    x: float
    y: float
    w: float = Field(gt=0)
    h: float = Field(gt=0)
    label: str = Field(min_length=1, max_length=255)
    status: Literal["active", "review", "deleted"] = "active"


class AnnotationCreate(AnnotationBase):
    pass


class AnnotationUpdate(BaseModel):
    x: float | None = None
    y: float | None = None
    w: float | None = Field(default=None, gt=0)
    h: float | None = Field(default=None, gt=0)
    label: str | None = Field(default=None, min_length=1, max_length=255)
    status: Literal["active", "review", "deleted"] | None = None


class AnnotationRead(AnnotationBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    image_id: int
    confidence: float | None = None
    created_by: int
    updated_by: int
    created_at: datetime
    updated_at: datetime


class AnnotationEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    annotation_id: int
    actor_user_id: int
    actor_username: str
    event_type: str
    old_value_json: dict | None
    new_value_json: dict | None
    created_at: datetime


class ImportRead(BaseModel):
    images_imported: int
    annotations_imported: int
    errors: list[str] = []


class FolderImportRequest(BaseModel):
    image_root: str
    label_root: str


class ExportRead(BaseModel):
    filename: str
    download_url: str


class ReviewItemRead(BaseModel):
    id: int
    image_id: int
    x: float
    y: float
    w: float
    h: float
    label: str
    status: Literal["active", "review", "deleted"]
    confidence: float | None
    image_filename: str
    source_folder: str | None


class ReviewListRead(BaseModel):
    items: list[ReviewItemRead]
    total: int


class ReviewFilter(BaseModel):
    label: str | None = None
    folder: str | None = None
    status: Literal["active", "review", "deleted"] | None = None


class ReviewTarget(BaseModel):
    ids: list[int] | None = None
    all_matching: ReviewFilter | None = None


class BulkReviewRequest(BaseModel):
    action: Literal["approve", "reject", "relabel"]
    new_label: str | None = Field(default=None, min_length=1, max_length=255)
    target: ReviewTarget


class ReviewPreviousState(BaseModel):
    id: int
    status: str
    label: str


class BulkReviewResult(BaseModel):
    updated: int
    previous: list[ReviewPreviousState]


class ReviewRestoreItem(BaseModel):
    id: int
    status: Literal["active", "review", "deleted"]
    label: str = Field(min_length=1, max_length=255)


class ReviewRestoreRequest(BaseModel):
    items: list[ReviewRestoreItem]


class RestoreResult(BaseModel):
    updated: int
