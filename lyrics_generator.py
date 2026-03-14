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

[Verse 1]
(3-4 lines)

[Chorus]
(3-4 lines)

[Verse 2]
(3-4 lines)

[Bridge]
(2-3 lines)

The lyrics should:
- Match the mood ({features['mood']}), genre ({features['genre']}), and energy of the music
- Tell the story from the narrative in a poetic, singable way
- Be suitable for a {features['duration']}s song with full verse/chorus/bridge structure
- Use natural phrasing that works with {features['tempo']} BPM tempo
- Verse 1: introduce the story/emotion
- Chorus: the emotional core, catchy and memorable
- Verse 2: deepen the story, add new perspective
- Bridge: emotional pivot or revelation

Narrative/Story:
{context.narrative}

Return ONLY the lyrics with [Verse 1], [Chorus], [Verse 2], [Bridge] section markers. No other text."""

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )
    context.lyrics = response.content[0].text.strip()
    print(f"  Generated lyrics:\n{context.lyrics}")
    return context
