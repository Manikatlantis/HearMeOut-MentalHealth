import os
import anthropic
from dotenv import load_dotenv

load_dotenv(override=True)


def _get_client():
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not set.")
    return anthropic.Anthropic(api_key=api_key)


def generate_lyrics(context):
    """Generate song lyrics from narrative and musical features using Claude."""
    client = _get_client()
    features = context.musical_features.to_dict()

    prompt = f"""You are a professional songwriter. Based on the story/narrative and musical features below,
write song lyrics with exactly this structure:

[Verse]
(2-4 lines)

[Chorus]
(2-4 lines)

The lyrics should:
- Match the mood ({features['mood']}), genre ({features['genre']}), and energy of the music
- Tell the story from the narrative in a poetic, singable way
- Be concise and catchy — suitable for a {features['duration']}s song
- Use natural phrasing that works with {features['tempo']} BPM tempo

Narrative/Story:
{context.narrative}

Return ONLY the lyrics with [Verse] and [Chorus] section markers. No other text."""

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )
    context.lyrics = response.content[0].text.strip()
    print(f"  Generated lyrics:\n{context.lyrics}")
    return context
