from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    app_name: str = "Nom Web App API"
    database_url: str = "sqlite:///./nom_v1.db"
    jwt_secret: str = "change-me-in-local-env"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 60 * 12
    storage_root: Path = Path("../storage")

    @property
    def upload_dir(self) -> Path:
        return self.storage_root / "uploads"

    @property
    def export_dir(self) -> Path:
        return self.storage_root / "exports"


settings = Settings()

