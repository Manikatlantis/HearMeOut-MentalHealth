import json
import os
import anthropic
from elevenlabs.client import ElevenLabs
from dotenv import load_dotenv

load_dotenv(override=True)


def _get_eleven_client():
    api_key = os.environ.get("ELEVENLABS_API_KEY")
    if not api_key:
        raise RuntimeError("ELEVENLABS_API_KEY not set.")
    return ElevenLabs(api_key=api_key)


def _get_claude_client():
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not set.")
    return anthropic.Anthropic(api_key=api_key)


def _parse_lyrics(lyrics_text):
    """Parse lyrics text into section-based line lists."""
    sections = {}
    current_section = None

    for raw_line in lyrics_text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        lower = line.lower()
        if lower.startswith("[") and lower.endswith("]"):
            label = lower.strip("[]").strip()
            # Normalize section names
            if label in ("verse", "verse 1"):
                current_section = "verse1"
            elif label == "verse 2":
                current_section = "verse2"
            elif label == "chorus":
                current_section = "chorus"
            elif label == "bridge":
                current_section = "bridge"
            elif label == "outro":
                current_section = "outro"
            else:
                current_section = label
            if current_section not in sections:
                sections[current_section] = []
            continue
        if current_section and current_section in sections:
            sections[current_section].append(line)

    # Backwards compatibility: return verse_lines, chorus_lines, and full sections dict
    verse_lines = sections.get("verse1", [])
    chorus_lines = sections.get("chorus", [])
    return verse_lines, chorus_lines, sections


def _build_composition_plan(context):
    """Use Claude to build an ElevenLabs composition plan with vocals."""
    client = _get_claude_client()
    features = context.musical_features.to_dict()

    verse_lines, chorus_lines, all_sections = _parse_lyrics(context.lyrics)
    verse2_lines = all_sections.get("verse2", [])
    bridge_lines = all_sections.get("bridge", [])
    has_lyrics = bool(verse_lines and chorus_lines)

    # Calculate section durations for full song structure:
    # Intro → Verse 1 → Chorus → Verse 2 → Bridge → Chorus → Outro
    total_ms = features["duration"] * 1000
    if has_lyrics:
        intro_ms = int(total_ms * 0.08)   # ~8% intro
        outro_ms = int(total_ms * 0.07)   # ~7% outro
        remaining = total_ms - intro_ms - outro_ms
        # Distribute remaining across vocal sections
        verse1_ms = int(remaining * 0.22)
        chorus1_ms = int(remaining * 0.20)
        verse2_ms = int(remaining * 0.22)
        bridge_ms = int(remaining * 0.16)
        chorus2_ms = remaining - verse1_ms - chorus1_ms - verse2_ms - bridge_ms
    else:
        intro_ms = total_ms
        verse1_ms = verse2_ms = chorus1_ms = chorus2_ms = bridge_ms = outro_ms = 0

    # Get the full lyrics text for context
    lyrics_preview = context.lyrics[:200] if context.lyrics else ""

    prompt = f"""You are a music producer. Create style descriptors for the ElevenLabs Music Composition API.

This is a VOCAL song with SUNG LYRICS. Return a JSON object with exactly two arrays.

Here are the lyrics that will be sung:
{lyrics_preview}

Musical features: {features['genre']}, {features['mood']}, {features['tempo']} BPM, instruments: {', '.join(features['instruments'])}

Narrative excerpt: {context.narrative[:200]}

Return this JSON structure:
{{
    "positive_global_styles": [
        "<gender> vocalist with clear melodic singing tone",
        "<genre> vocal delivery style",
        "catchy vocal melody",
        "<list instruments>",
        "{features['tempo']} BPM",
        "<mood> energy",
        "polished studio production",
        "<1 more relevant style>"
    ],
    "negative_global_styles": [
        "instrumental only",
        "no vocals",
        "a cappella",
        "<2 more things to avoid for this genre>"
    ]
}}

RULES:
- The FIRST style MUST describe the vocalist gender and singing quality
- The SECOND style MUST describe the vocal delivery style for this genre
- Include "catchy vocal melody" always
- Return ONLY valid JSON, no other text."""

    ep = context.emotional_profile
    if ep:
        domain = ep.get('emotional_domain', ep.get('concern', ''))
        therapeutic_need = ep.get('therapeutic_need', '')
        primary_emotion = ep.get('primary_emotion', '')

        prompt += f"""

THERAPEUTIC PRODUCTION NOTES:
This song addresses {domain}. The listener's primary emotion is {primary_emotion}.
Their therapeutic need is {therapeutic_need}.
Relationship type: {ep.get('relationship_type', 'unknown')} — ensure vocal delivery matches this context.
Ensure the vocal delivery feels warm, genuine, and emotionally safe.
The production should support the therapeutic journey — starting where the listener is
emotionally ({primary_emotion}) and building toward {ep.get('what_would_help', 'genuine emotional resolution')}
by the chorus and final sections.
AVOID any vocal delivery that sounds dismissive, preachy, or artificially cheerful."""

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )
    text = response.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

    styles = json.loads(text)

    # Build sections — full song structure: Intro → V1 → C → V2 → Bridge → C → Outro
    sections = []
    is_female = "female" in str(styles.get("positive_global_styles", "")).lower()
    vocal_start = "female lead vocals clearly begin here" if is_female else "male lead vocals clearly begin here"

    sections.append({
        "section_name": "Intro",
        "positive_local_styles": [
            "instrumental intro",
            "build anticipation",
            "establish the groove",
        ],
        "negative_local_styles": ["lead vocals", "rap", "harsh singing"],
        "duration_ms": intro_ms,
        "lines": [],
    })

    if has_lyrics:
        sections.append({
            "section_name": "Verse 1",
            "positive_local_styles": [
                vocal_start,
                "vocalist clearly sings these exact lyrics",
                "melodic and expressive singing",
                "clear vocal diction",
            ],
            "negative_local_styles": [
                "instrumental only", "humming", "spoken word", "no vocals",
            ],
            "duration_ms": verse1_ms,
            "lines": verse_lines,
        })
        sections.append({
            "section_name": "Chorus",
            "positive_local_styles": [
                "big catchy chorus",
                "strong memorable vocal hook",
                "vocalist sings chorus lyrics with power and emotion",
                "vocals front and center in the mix",
            ],
            "negative_local_styles": [
                "instrumental only", "humming", "no singing", "low energy",
            ],
            "duration_ms": chorus1_ms,
            "lines": chorus_lines,
        })
        sections.append({
            "section_name": "Verse 2",
            "positive_local_styles": [
                "vocalist sings with deeper emotional intensity",
                "builds on verse 1 energy",
                "clear vocal diction",
                "melodic variation from verse 1",
            ],
            "negative_local_styles": [
                "instrumental only", "humming", "spoken word", "no vocals",
            ],
            "duration_ms": verse2_ms,
            "lines": verse2_lines if verse2_lines else verse_lines,
        })
        sections.append({
            "section_name": "Bridge",
            "positive_local_styles": [
                "emotional pivot moment",
                "contrasting vocal delivery",
                "stripped back or intensified arrangement",
                "builds tension toward final chorus",
            ],
            "negative_local_styles": [
                "same as verse", "monotone", "no vocals",
            ],
            "duration_ms": bridge_ms,
            "lines": bridge_lines if bridge_lines else chorus_lines[:2],
        })
        sections.append({
            "section_name": "Final Chorus",
            "positive_local_styles": [
                "powerful final chorus",
                "full arrangement peak energy",
                "vocalist delivers with maximum emotion",
                "anthemic and memorable",
            ],
            "negative_local_styles": [
                "instrumental only", "quiet", "fading energy",
            ],
            "duration_ms": chorus2_ms,
            "lines": chorus_lines,
        })
        sections.append({
            "section_name": "Outro",
            "positive_local_styles": [
                "gentle instrumental fade",
                "resolution and closure",
                "echoing the main melody",
            ],
            "negative_local_styles": ["abrupt ending", "new vocals", "loud"],
            "duration_ms": outro_ms,
            "lines": [],
        })

    styles["sections"] = sections
    return styles


def generate_music_eleven(context):
    """Generate music with vocals using ElevenLabs Music API."""
    os.makedirs("output", exist_ok=True)

    print("  Building ElevenLabs composition plan with lyrics...")
    composition_plan = _build_composition_plan(context)
    context.composition_sections = composition_plan.get("sections", [])
    print(f"  Styles: {composition_plan.get('positive_global_styles', [])}")
    print(f"  Sections: {[s['section_name'] for s in composition_plan['sections']]}")
    for s in composition_plan["sections"]:
        print(f"    {s['section_name']}: {len(s.get('lines', []))} lines, {s['duration_ms']}ms")

    print("  Generating music + vocals with ElevenLabs...")
    eleven_client = _get_eleven_client()
    track = eleven_client.music.compose(composition_plan=composition_plan)

    output_path = f"output/music_v{context.iteration}.mp3"
    with open(output_path, "wb") as f:
        for chunk in track:
            f.write(chunk)

    print(f"  Saved: {output_path}")
    context.audio_file = output_path
    return context
