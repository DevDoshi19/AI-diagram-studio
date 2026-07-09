from pydantic_settings import BaseSettings , SettingsConfigDict

class Setting(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore"
    )

    app_name:str = "AI Diagram Studio"
    environment:str= "devlopment"

    llm_provider: str = "openai"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"

    database_url : str = "postgresql+asyncpg://diagram_user:diagram_pass@localhost:5433/diagram_studio"

    secret_key: str = "change-me-in-production"

    redis_url: str = "redis://localhost:6379/0"
    cache_ttl: int = 3600  

    github_token: str = ""
    github_repo_owner: str = ""
    github_repo_name: str = ""

    cors_origins: str = "http://localhost:5173"

settings = Setting()

