from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import user_from_token
from app.db.session import get_db
from app.models.models import Dataset, User

bearer = HTTPBearer()


def current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    user = user_from_token(db, credentials.credentials)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return user


def require_roles(*roles: str):
    def dependency(user: User = Depends(current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return user
    return dependency

def can_access_dataset(user: User, dataset: Dataset) -> bool:
    return user.role == "admin" or dataset.created_by == user.id

def ensure_dataset_access(user: User, dataset: Dataset) -> None:
    if not can_access_dataset(user, dataset):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Dataset access denied")
