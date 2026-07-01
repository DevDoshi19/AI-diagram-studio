from openai import AsyncOpenAI
from app.core.config import settings

def get_llm_client()->AsyncOpenAI:
    return AsyncOpenAI(
        api_key=settings.openai_api_key,
    )

def get_model() -> str:
    return settings.openai_model

MERMAID_SYSTEM_PROMPT = """You are a senior software architect generating system architecture diagrams.

Return ONLY valid Mermaid flowchart syntax. No markdown fences, no explanation, no extra text.

Rules:
- Start with: flowchart TD
- Use 6-12 nodes depending on the complexity of the system described
- Use descriptive labels with the technology name: A[Frontend - React]
- Use proper Mermaid node shapes:
    [Text]      → regular service/component
    [(Text)]    → database
    {{Text}}    → message queue / cache
    ([Text])    → external service / API
    >Text]      → load balancer / gateway
- Use --> for normal connections, -.-> for async/event-based connections
- Add labels on important edges: A -->|HTTP| B
- Group related services using subgraphs when the system has distinct layers:
    subgraph Frontend
        A[React App]
    end
    subgraph Backend
        B[FastAPI]
        C[Auth Service]
    end
- Think about what a REAL production system for this use case would include:
    - client/frontend layer
    - API gateway or load balancer if relevant
    - backend services (split into multiple if the domain suggests it)
    - database(s) — pick the right type (SQL, NoSQL, cache)
    - message queue if there's async work
    - external APIs/third-party services if relevant
    - monitoring/logging if it's an infra-heavy prompt

Example output:
flowchart TD
    subgraph Client
        A[React Frontend]
    end
    subgraph Backend
        B>API Gateway]
        C[Auth Service]
        D[Core API - FastAPI]
    end
    subgraph Data
        E[(PostgreSQL)]
        F{{Redis Cache}}
    end
    A -->|HTTPS| B
    B --> C
    B --> D
    D --> E
    D -.->|cache lookup| F
    C --> E

Return ONLY the mermaid code. Nothing else. Make it detailed and realistic, not oversimplified."""

async def generate_mermaid(prompt: str) -> tuple[str, str, int]:
    """
    Returns: (mermaid_code, model_used, tokens_used)
    """
    client = get_llm_client()
    model = get_model()

    response = await client.chat.completions.create(
        model=model,
        temperature=0.3,
        max_tokens=1536,
        messages=[
            {"role": "system", "content": MERMAID_SYSTEM_PROMPT},
            {"role": "user", "content": f"Create a diagram for: {prompt}"}
        ]
    )

    raw = response.choices[0].message.content.strip()
    tokens = response.usage.total_tokens

    # strip markdown fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("mermaid"):
            raw = raw[7:]
        raw = raw.strip()

    return raw, model, tokens

async def stream_mermaid(prompt: str):
    client = get_llm_client()
    model = get_model()

    stream = await client.chat.completions.create(
        model=model,
        temperature=0.3,
        max_tokens=1536,
        stream=True,
        messages=[
            {"role": "system", "content": MERMAID_SYSTEM_PROMPT},
            {"role": "user", "content": f"Create a diagram for: {prompt}"}
        ]
    )

    async for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta

    yield "[DONE]"