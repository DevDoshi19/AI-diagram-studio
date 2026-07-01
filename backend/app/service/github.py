import json
import hashlib
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
    Uses a hash of the prompt as the filename — same prompt always maps
    to the same file path, so duplicates are naturally skipped.
    Returns the file URL or None if failed.
    """
    try:
        g = get_github_client()
        repo = g.get_repo(f"{settings.github_repo_owner}/{settings.github_repo_name}")

        # Organize by user email each user gets their own folder
        safe_email = user_email.replace("@", "_").replace(".", "_")

        # Hash the prompt so the same query always maps to the same file
        prompt_hash = hashlib.sha256(prompt.strip().lower().encode()).hexdigest()[:16]
        file_path = f"diagrams/{safe_email}/{prompt_hash}.json"

        github_url = f"https://github.com/{settings.github_repo_owner}/{settings.github_repo_name}/blob/main/{file_path}"

        # Check if this prompt's file already exists — if so, skip (dedup)
        try:
            repo.get_contents(file_path)
            print(f"GitHub: file already exists for this prompt, skipping push → {file_path}")
            return github_url
        except Exception:
            pass  # File doesn't exist yet — safe to create

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

        print(f"GitHub: new file created → {file_path}")
        return github_url

    except Exception as e:
        print(f"GitHub push failed: {e}")
        return None