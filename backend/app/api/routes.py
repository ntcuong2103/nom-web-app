import io
from pathlib import PurePosixPath
from zipfile import BadZipFile, ZipFile

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from PIL import Image as PILImage
from sqlalchemy.orm import Session, joinedload

from app.api.deps import current_user, ensure_dataset_access, require_roles
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models.models import Annotation, AnnotationEvent, Dataset, Image, User
from app.schemas.schemas import (
    AnnotationCreate,
    AnnotationEventRead,
    AnnotationRead,
    AnnotationUpdate,
    DatasetCreate,
    DatasetRead,
    DatasetUpdate,
    ExportRead,
    ImageRead,
    ImportRead,
    LoginRequest,
    RegisterRequest,
    Token,
    UserRead,
)
from app.services.audit import add_annotation_event, annotation_snapshot, classify_update
from app.services.storage import build_yolo_export, image_path, save_upload, settings

router = APIRouter()

def validate_box(image: Image, x: float, y: float, w: float, h: float) -> None:
    if x < 0 or y < 0 or w <= 0 or h <= 0 or x + w > image.width or y + h > image.height:
        raise HTTPException(status_code=422, detail="Annotation box must fit within image bounds")


@router.post("/auth/register", response_model=Token)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> Token:
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    user = User(email=payload.email, password_hash=hash_password(payload.password), role="annotator")
    db.add(user)
    db.commit()
    db.refresh(user)
    return Token(access_token=create_access_token(user))


@router.post("/auth/login", response_model=Token)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> Token:
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return Token(access_token=create_access_token(user))


@router.get("/me", response_model=UserRead)
def me(user: User = Depends(current_user)) -> User:
    return user


@router.post("/datasets", response_model=DatasetRead)
def create_dataset(
    payload: DatasetCreate, user: User = Depends(require_roles("admin", "annotator")), db: Session = Depends(get_db)
) -> Dataset:
    dataset = Dataset(name=payload.name, description=payload.description, created_by=user.id)
    db.add(dataset)
    db.commit()
    db.refresh(dataset)
    return dataset


@router.get("/datasets", response_model=list[DatasetRead])
def list_datasets(user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[Dataset]:
    query = db.query(Dataset)
    if user.role != "admin":
        query = query.filter(Dataset.created_by == user.id)
    return query.order_by(Dataset.created_at.desc()).all()


@router.get("/datasets/{dataset_id}", response_model=DatasetRead)
def get_dataset(dataset_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    dataset = db.get(Dataset, dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    ensure_dataset_access(user, dataset)
    return dataset


@router.patch("/datasets/{dataset_id}", response_model=DatasetRead)
def update_dataset(
    dataset_id: int,
    payload: DatasetUpdate,
    user: User = Depends(require_roles("admin", "annotator")),

    db: Session = Depends(get_db),
):
    dataset = db.get(Dataset, dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    ensure_dataset_access(user, dataset)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(dataset, key, value)
    db.commit()
    db.refresh(dataset)
    return dataset


@router.post("/datasets/{dataset_id}/images", response_model=ImageRead)
def upload_image(
    dataset_id: int,
    file: UploadFile = File(...),
    user: User = Depends(require_roles("admin", "annotator")),

    db: Session = Depends(get_db),
) -> Image:
    dataset = db.get(Dataset, dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    ensure_dataset_access(user, dataset)
    storage_key, width, height = save_upload(file)
    image = Image(
        dataset_id=dataset_id,
        storage_key=storage_key,
        filename=file.filename or storage_key,
        width=width,
        height=height,
        uploaded_by=user.id,
    )
    db.add(image)
    db.commit()
    db.refresh(image)
    return image


@router.get("/datasets/{dataset_id}/images", response_model=list[ImageRead])
def list_images(
    dataset_id: int,
    filename: str | None = None,
    label: str | None = None,
    status: str | None = None,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[Image]:
    query = db.query(Image).filter(Image.dataset_id == dataset_id)
    if filename:
        query = query.filter(Image.filename.ilike(f"%{filename}%"))
    if label or status:
        query = query.join(Annotation)
        if label:
            query = query.filter(Annotation.label.ilike(f"%{label}%"))
        if status:
            query = query.filter(Annotation.status == status)
    return query.distinct().order_by(Image.created_at.desc()).all()


@router.get("/images/{image_id}", response_model=ImageRead)
def get_image(image_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> Image:
    image = db.get(Image, image_id)
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    return image


@router.get("/images/{image_id}/file")
def get_image_file(image_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    image = db.get(Image, image_id)
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(image_path(image), filename=image.filename)


@router.get("/images/{image_id}/crop")
def crop_image(
    image_id: int,
    x: float,
    y: float,
    w: float,
    h: float,
    size: int = Query(default=128, ge=16, le=512),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    image = db.get(Image, image_id)
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    source = PILImage.open(image_path(image))
    crop = source.crop((x, y, x + w, y + h))
    crop.thumbnail((size, size))
    from io import BytesIO

    buffer = BytesIO()
    crop.save(buffer, "PNG")
    buffer.seek(0)
    return StreamingResponse(buffer, media_type="image/png")


@router.get("/images/{image_id}/annotations", response_model=list[AnnotationRead])
def list_annotations(
    image_id: int,
    label: str | None = None,
    status: str | None = None,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[Annotation]:
    query = db.query(Annotation).filter(Annotation.image_id == image_id)
    if label:
        query = query.filter(Annotation.label.ilike(f"%{label}%"))
    if status:
        query = query.filter(Annotation.status == status)
    return query.order_by(Annotation.created_at.asc()).all()


@router.post("/images/{image_id}/annotations", response_model=AnnotationRead)
def create_annotation(
    image_id: int,
    payload: AnnotationCreate,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> Annotation:
    image = db.get(Image, image_id)
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    validate_box(image, payload.x, payload.y, payload.w, payload.h)
    annotation = Annotation(image_id=image_id, created_by=user.id, updated_by=user.id, **payload.model_dump())
    db.add(annotation)
    db.flush()
    add_annotation_event(db, annotation, user, "user_created", None, annotation_snapshot(annotation))
    db.commit()
    db.refresh(annotation)
    return annotation


@router.patch("/annotations/{annotation_id}", response_model=AnnotationRead)
def update_annotation(
    annotation_id: int,
    payload: AnnotationUpdate,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> Annotation:
    annotation = db.get(Annotation, annotation_id)
    if not annotation:
        raise HTTPException(status_code=404, detail="Annotation not found")
    image = db.get(Image, annotation.image_id)
    values = payload.model_dump(exclude_unset=True)
    validate_box(image, values.get("x", annotation.x), values.get("y", annotation.y), values.get("w", annotation.w), values.get("h", annotation.h))
    old = annotation_snapshot(annotation)
    for key, value in values.items():
        setattr(annotation, key, value)
    annotation.updated_by = user.id
    db.flush()
    new = annotation_snapshot(annotation)
    add_annotation_event(db, annotation, user, classify_update(old, new), old, new)
    db.commit()
    db.refresh(annotation)
    return annotation


@router.delete("/annotations/{annotation_id}", response_model=AnnotationRead)
def delete_annotation(
    annotation_id: int,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> Annotation:
    annotation = db.get(Annotation, annotation_id)
    if not annotation:
        raise HTTPException(status_code=404, detail="Annotation not found")
    old = annotation_snapshot(annotation)
    annotation.status = "deleted"
    annotation.updated_by = user.id
    db.flush()
    add_annotation_event(db, annotation, user, "user_deleted", old, annotation_snapshot(annotation))
    db.commit()
    db.refresh(annotation)
    return annotation


@router.get("/annotations/{annotation_id}/events", response_model=list[AnnotationEventRead])
def annotation_events(
    annotation_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> list[AnnotationEvent]:
    return (
        db.query(AnnotationEvent)
        .options(joinedload(AnnotationEvent.actor))
        .filter(AnnotationEvent.annotation_id == annotation_id)
        .order_by(AnnotationEvent.created_at.desc())
        .all()
    )


@router.get("/images/{image_id}/events", response_model=list[AnnotationEventRead])
def image_events(
    image_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> list[AnnotationEvent]:
    return (
        db.query(AnnotationEvent)
        .options(joinedload(AnnotationEvent.actor))
        .join(Annotation)
        .filter(Annotation.image_id == image_id)
        .order_by(AnnotationEvent.created_at.desc())
        .all()
    )


@router.post("/datasets/{dataset_id}/import/yolo", response_model=ImportRead)
def import_yolo(dataset_id: int, file: UploadFile = File(...), user: User = Depends(require_roles("admin", "annotator")), db: Session = Depends(get_db)) -> ImportRead:
    dataset = db.get(Dataset, dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    ensure_dataset_access(user, dataset)
    try:
        archive = ZipFile(file.file)
    except BadZipFile as exc:
        raise HTTPException(status_code=422, detail="Upload must be a valid ZIP archive") from exc
    names = {PurePosixPath(name).name: name for name in archive.namelist() if not name.endswith("/")}
    classes_name = next((name for name in archive.namelist() if PurePosixPath(name).name == "classes.txt"), None)
    if not classes_name:
        raise HTTPException(status_code=422, detail="Archive must contain classes.txt")
    classes = [line.strip() for line in archive.read(classes_name).decode("utf-8").splitlines() if line.strip()]
    imported_images = 0
    imported_annotations = 0
    errors: list[str] = []
    for name in archive.namelist():
        path = PurePosixPath(name)
        if path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"} or path.name == "classes.txt":
            continue
        try:
            image_bytes = archive.read(name)
            image = PILImage.open(io.BytesIO(image_bytes))
            image.load()
            upload = UploadFile(file=io.BytesIO(image_bytes), filename=path.name)
            storage_key, width, height = save_upload(upload)
            record = Image(dataset_id=dataset.id, storage_key=storage_key, filename=path.name, width=width, height=height, uploaded_by=user.id)
            db.add(record)
            db.flush()
            imported_images += 1
            label_name = path.with_suffix(".txt").name
            label_entry = next((value for key, value in names.items() if PurePosixPath(key).name == label_name), None)
            if not label_entry:
                continue
            for line_number, line in enumerate(archive.read(label_entry).decode("utf-8").splitlines(), 1):
                parts = line.split()
                if len(parts) != 5:
                    errors.append(f"{path.name}:{line_number}: expected 5 YOLO fields")
                    continue
                try:
                    class_id, cx, cy, nw, nh = int(parts[0]), *(float(value) for value in parts[1:])
                    if class_id < 0 or class_id >= len(classes) or not all(0 <= value <= 1 for value in (cx, cy, nw, nh)):
                        raise ValueError
                    box_w, box_h = nw * width, nh * height
                    box_x, box_y = cx * width - box_w / 2, cy * height - box_h / 2
                    annotation = Annotation(image_id=record.id, created_by=user.id, updated_by=user.id, x=box_x, y=box_y, w=box_w, h=box_h, label=classes[class_id], status="active")
                    db.add(annotation)
                    imported_annotations += 1
                except (ValueError, IndexError):
                    errors.append(f"{path.name}:{line_number}: invalid YOLO row")
        except (OSError, ValueError) as exc:
            errors.append(f"{path.name}: {exc}")
    db.commit()
    return ImportRead(images_imported=imported_images, annotations_imported=imported_annotations, errors=errors)


@router.post("/datasets/{dataset_id}/export/yolo", response_model=ExportRead)
def export_yolo(
    dataset_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> ExportRead:
    dataset = db.get(Dataset, dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    filename = build_yolo_export(db, dataset)
    return ExportRead(filename=filename, download_url=f"/exports/{filename}")


@router.get("/exports/{filename}")
def download_export(filename: str, user: User = Depends(current_user)):
    return FileResponse(settings.export_dir / filename, filename=filename)
