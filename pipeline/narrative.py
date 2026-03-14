import os
import anthropic
from dotenv import load_dotenv

load_dotenv(override=True)


def _get_client():
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError(
            "ANTHROPIC_API_KEY not set. Add it to your .env file or export it as an environment variable."
        )
    return anthropic.Anthropic(api_key=api_key)


def expand_narrative(context):
    """Expand user input into a rich narrative context using Claude.

    On the first iteration, creates a narrative from the original input.
    On subsequent iterations, refines the narrative based on accumulated feedback.
    """
    client = _get_client()

    if context.iteration == 0:
        prompt = f"""You are a creative music storyteller. The user wants to generate music
based on the following description. Expand this into a rich, evocative narrative
that captures the emotional landscape, atmosphere, and sonic qualities implied
by the description. Focus on sensory details that can translate into musical elements.

Keep the narrative to 2-3 paragraphs.

User input: {context.original_input}"""
    else:
        prompt = f"""You are a creative music storyteller refining a musical narrative.

{context.get_accumulated_context()}

The user has provided new feedback. Revise the narrative to incorporate their
direction while preserving the core creative intent. Keep it to 2-3 paragraphs.

Feedback: {context.history[-1].get("feedback", "")}"""

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )
    context.narrative = response.content[0].text
    return context
