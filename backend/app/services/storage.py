import shutil
import uuid
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

from fastapi import UploadFile
from PIL import Image as PILImage
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.models import Annotation, Dataset, Image


def ensure_storage() -> None:
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    settings.export_dir.mkdir(parents=True, exist_ok=True)


def save_upload(upload: UploadFile) -> tuple[str, int, int]:
    ensure_storage()
    suffix = Path(upload.filename or "image").suffix.lower()
    storage_key = f"{uuid.uuid4().hex}{suffix}"
    destination = settings.upload_dir / storage_key
    with destination.open("wb") as file:
        shutil.copyfileobj(upload.file, file)
    with PILImage.open(destination) as image:
        width, height = image.size
    return storage_key, width, height


def image_path(image: Image) -> Path:
    return settings.upload_dir / image.storage_key


def build_yolo_export(db: Session, dataset: Dataset) -> str:
    ensure_storage()
    zip_name = f"dataset-{dataset.id}-yolo.zip"
    zip_path = settings.export_dir / zip_name
    images = db.query(Image).filter(Image.dataset_id == dataset.id).order_by(Image.id).all()
    labels = sorted(
        {
            annotation.label
            for image in images
            for annotation in db.query(Annotation).filter(Annotation.image_id == image.id).all()
        }
    )
    label_index = {label: index for index, label in enumerate(labels)}

    with ZipFile(zip_path, "w", ZIP_DEFLATED) as archive:
        archive.writestr("classes.txt", "\n".join(labels) + ("\n" if labels else ""))
        for image in images:
            archive.write(image_path(image), f"images/{image.filename}")
            rows = []
            annotations = db.query(Annotation).filter(
                Annotation.image_id == image.id,
                Annotation.status != "deleted",
            )
            for annotation in annotations:
                x_center = (annotation.x + annotation.w / 2) / image.width
                y_center = (annotation.y + annotation.h / 2) / image.height
                width = annotation.w / image.width
                height = annotation.h / image.height
                rows.append(
                    f"{label_index[annotation.label]} {x_center:.6f} {y_center:.6f} "
                    f"{width:.6f} {height:.6f}"
                )
            archive.writestr(f"labels/{Path(image.filename).stem}.txt", "\n".join(rows))
    return zip_name

