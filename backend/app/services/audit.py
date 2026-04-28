from typing import Any

from sqlalchemy.orm import Session

from app.models.models import Annotation, AnnotationEvent, User


def annotation_snapshot(annotation: Annotation) -> dict[str, Any]:
    return {
        "id": annotation.id,
        "image_id": annotation.image_id,
        "x": annotation.x,
        "y": annotation.y,
        "w": annotation.w,
        "h": annotation.h,
        "label": annotation.label,
        "status": annotation.status,
    }


def add_annotation_event(
    db: Session,
    annotation: Annotation,
    actor: User,
    event_type: str,
    old_value: dict[str, Any] | None,
    new_value: dict[str, Any] | None,
) -> None:
    db.add(
        AnnotationEvent(
            annotation_id=annotation.id,
            actor_user_id=actor.id,
            event_type=event_type,
            old_value_json=old_value,
            new_value_json=new_value,
        )
    )


def classify_update(old: dict[str, Any], new: dict[str, Any]) -> str:
    if old.get("label") != new.get("label"):
        return "user_relabeled"
    if old.get("w") != new.get("w") or old.get("h") != new.get("h"):
        return "user_resized"
    if old.get("x") != new.get("x") or old.get("y") != new.get("y"):
        return "user_moved"
    return "user_updated"

