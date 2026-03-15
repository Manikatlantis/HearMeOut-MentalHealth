import json
import os
import anthropic
from dotenv import load_dotenv
from pipeline.context import MusicalFeatures

load_dotenv(override=True)


def _get_client():
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError(
            "ANTHROPIC_API_KEY not set. Add it to your .env file or export it as an environment variable."
        )
    return anthropic.Anthropic(api_key=api_key)


def extract_musical_features(context):
    """Analyze narrative context and extract structured musical parameters using Claude."""
    client = _get_client()

    prompt = f"""Analyze the following narrative and extract musical parameters.
Return ONLY a valid JSON object with these fields:
- tempo (integer, 40-200 BPM)
- genre (string)
- mood (string)
- instruments (list of strings)
- scale (string, e.g. "C minor", "D major")
- chord_progression (list of chord strings, 4-8 chords)
- energy (float 0.0-1.0, where 0 is very calm and 1 is very intense)
- dynamics (string: "whisper", "soft", "moderate", "loud", "explosive")
- duration (integer, always 15 seconds exactly)

Narrative:
{context.narrative}

Current musical features for reference (adjust based on narrative):
{context.musical_features.to_json()}

Return ONLY the JSON object, no other text."""

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )
    text = response.content[0].text.strip()

    # Strip markdown code fences if present
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

    features_dict = json.loads(text)
    context.musical_features = MusicalFeatures.from_dict(features_dict)
    context.musical_features.duration = 60  # 60s for proper vocals while saving credits
    return context
