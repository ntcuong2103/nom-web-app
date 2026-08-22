from datetime import datetime

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
    status: str = "active"


class AnnotationCreate(AnnotationBase):
    pass


class AnnotationUpdate(BaseModel):
    x: float | None = None
    y: float | None = None
    w: float | None = Field(default=None, gt=0)
    h: float | None = Field(default=None, gt=0)
    label: str | None = Field(default=None, min_length=1, max_length=255)
    status: str | None = None


class AnnotationRead(AnnotationBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    image_id: int
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


class ExportRead(BaseModel):
    filename: str
    download_url: str
