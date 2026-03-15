"""Claude meditation script generation + ElevenLabs ambient music."""

import os
import anthropic
from elevenlabs.client import ElevenLabs
from dotenv import load_dotenv

load_dotenv(override=True)


def _get_claude_client():
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not set.")
    return anthropic.Anthropic(api_key=api_key)


def _get_eleven_client():
    api_key = os.environ.get("ELEVENLABS_API_KEY")
    if not api_key:
        raise RuntimeError("ELEVENLABS_API_KEY not set.")
    return ElevenLabs(api_key=api_key)


def generate_meditation_script(story_context: str = None, mode: str = "standalone"):
    """Generate a meditation script using Claude.

    Args:
        story_context: The narrative/story from the user's session (for story-connected mode)
        mode: 'standalone' or 'story-connected'

    Returns:
        dict with 'script' (list of {text, pause_seconds}), 'title', 'duration_estimate'
    """
    client = _get_claude_client()

    if mode == "story-connected" and story_context:
        prompt = f"""You are a meditation guide specializing in music therapy. The user just created a song
based on their personal story. Now guide them through a brief meditation that connects to their emotional experience.

Their story/narrative:
{story_context[:500]}

Create a meditation script as a JSON object:
{{
    "title": "short evocative title for this meditation",
    "segments": [
        {{"text": "meditation instruction or guided imagery text", "pause_seconds": 5}},
        ...
    ]
}}

Guidelines:
- 6-8 segments, each 1-3 sentences
- Pause durations: 3-8 seconds between segments
- Reference themes from their story gently
- Focus on breath, body awareness, and emotional release
- End with gratitude and grounding
- Total guided time ~2-3 minutes
- Tone: warm, gentle, unhurried

Return ONLY valid JSON."""
    else:
        prompt = """You are a meditation guide specializing in music therapy and emotional wellness.
Create a calming, restorative meditation script.

Return a JSON object:
{
    "title": "short evocative title",
    "segments": [
        {"text": "meditation instruction or guided imagery text", "pause_seconds": 5},
        ...
    ]
}

Guidelines:
- 6-8 segments, each 1-3 sentences
- Pause durations: 3-8 seconds between segments
- Themes: breath awareness, sound/silence, inner music, emotional flow
- End with gentle return to awareness
- Total guided time ~2-3 minutes
- Tone: warm, gentle, unhurried

Return ONLY valid JSON."""

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )
    text = response.content[0].text.strip()

    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

    import json
    script_data = json.loads(text)

    total_duration = sum(s.get("pause_seconds", 5) for s in script_data["segments"])
    total_duration += len(script_data["segments"]) * 4  # ~4s reading time per segment

    return {
        "title": script_data.get("title", "Guided Meditation"),
        "segments": script_data["segments"],
        "duration_estimate": total_duration,
    }


def generate_narration(segments: list, session_label: str = "meditation"):
    """Generate spoken narration for meditation segments using ElevenLabs TTS.

    Concatenates all segment texts with pauses and generates a single audio file.

    Returns:
        str: path to the generated MP3 file
    """
    os.makedirs("output", exist_ok=True)
    eleven_client = _get_eleven_client()

    # Build full narration text with pause markers
    # Add "..." between segments to create natural pauses in speech
    full_text = ""
    for i, seg in enumerate(segments):
        full_text += seg["text"] + "\n"
        pause = seg.get("pause_seconds", 5)
        # Add ellipsis and newlines to create pauses in TTS
        full_text += "... " * min(pause, 6) + "\n\n"

    # Rachel voice — calm, warm, suitable for meditation
    VOICE_ID = "21m00Tcm4TlvDq8ikWAM"

    audio = eleven_client.text_to_speech.convert(
        voice_id=VOICE_ID,
        text=full_text,
        model_id="eleven_multilingual_v2",
    )

    output_path = f"output/meditation_{session_label}.mp3"
    with open(output_path, "wb") as f:
        for chunk in audio:
            f.write(chunk)

    print(f"  Meditation narration saved: {output_path}")
    return output_path


def generate_ambient_music(duration_seconds: int = 120, session_label: str = "meditation"):
    """Generate ambient meditation music via ElevenLabs Music API.

    Returns:
        str: path to the generated MP3 file
    """
    os.makedirs("output", exist_ok=True)
    eleven_client = _get_eleven_client()

    composition_plan = {
        "positive_global_styles": [
            "ambient meditation music",
            "gentle pad textures",
            "soft sine tones",
            "calming drone",
            "slow evolving soundscape",
            "nature-inspired ambience",
            "binaural relaxation",
            "60 BPM or slower",
        ],
        "negative_global_styles": [
            "vocals",
            "singing",
            "drums",
            "percussion",
            "loud",
            "aggressive",
            "fast tempo",
        ],
        "sections": [
            {
                "section_name": "Opening",
                "positive_local_styles": [
                    "gentle fade in",
                    "soft pad entry",
                    "quiet and spacious",
                ],
                "negative_local_styles": ["sudden start", "loud"],
                "duration_ms": int(duration_seconds * 0.2 * 1000),
                "lines": [],
            },
            {
                "section_name": "Body",
                "positive_local_styles": [
                    "warm sustained tones",
                    "slowly evolving harmony",
                    "peaceful and steady",
                ],
                "negative_local_styles": ["abrupt changes", "percussion"],
                "duration_ms": int(duration_seconds * 0.6 * 1000),
                "lines": [],
            },
            {
                "section_name": "Closing",
                "positive_local_styles": [
                    "gentle fade out",
                    "dissolving into silence",
                    "soft resolution",
                ],
                "negative_local_styles": ["loud ending", "sudden stop"],
                "duration_ms": int(duration_seconds * 0.2 * 1000),
                "lines": [],
            },
        ],
    }

    track = eleven_client.music.compose(composition_plan=composition_plan)

    output_path = f"output/meditation_{session_label}.mp3"
    with open(output_path, "wb") as f:
        for chunk in track:
            f.write(chunk)

    return output_path
