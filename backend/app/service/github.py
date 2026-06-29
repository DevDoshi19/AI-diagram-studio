import json
from github import Github
from app.core.config import settings

def get_github_client():
    return Github(settings.github_token)


async def push_diagram_to_github(
    diagram_id: str,
    prompt: str,
    excalidraw_data: dict,
    user_email: str
) -> str | None:
    """
    Pushes diagram JSON to GitHub repo.
    Returns the file URL or None if failed.
    """
    try:
        g = get_github_client()
        repo = g.get_repo(f"{settings.github_repo_owner}/{settings.github_repo_name}")

        # organize by user email — each user gets their own folder
        safe_email = user_email.replace("@", "_").replace(".", "_")
        file_path = f"diagrams/{safe_email}/{diagram_id}.json"

        content = json.dumps({
            "prompt": prompt,
            "diagram_id": diagram_id,
            "excalidraw_data": excalidraw_data
        }, indent=2)

        repo.create_file(
            path=file_path,
            message=f"Add diagram: {prompt[:50]}",
            content=content
        )

        return f"https://github.com/{settings.github_repo_owner}/{settings.github_repo_name}/blob/main/{file_path}"

    except Exception as e:
        print(f"GitHub push failed: {e}")
        return None