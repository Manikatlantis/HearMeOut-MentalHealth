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

    # Include therapy hints if available
    therapy_hint = ""
    if context.therapy_profile:
        tp = context.therapy_profile
        therapy_hint = f"""
Therapeutic context — use this to guide your musical choices:
- The listener needs: {tp.get('therapeutic_goal', 'comfort')}
- Suggested mood: {tp.get('mood_hint', '')}
- Suggested energy level: {tp.get('energy_hint', '')}
- Intensity preference: {tp.get('intensity', 'moderate')}
Weight the therapeutic needs heavily when choosing tempo, mood, energy, and dynamics.
"""

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
- duration (integer, 60-120 seconds. Standard songs: 60-90s, epic/atmospheric: 90-120s)
{therapy_hint}
Narrative:
{context.narrative}

Current musical features for reference (adjust based on narrative):
{context.musical_features.to_json()}

Return ONLY the JSON object, no other text."""

    ep = context.emotional_profile
    if ep:
        # Map emotional_domain to music therapy guidelines
        domain = ep.get('emotional_domain', ep.get('concern', ''))
        therapeutic_need = ep.get('therapeutic_need', '')

        therapy_guidelines = {
            'anxiety': 'Prefer 60-80 BPM, major keys, soft dynamics, legato instruments (piano, strings, acoustic guitar). Avoid abrupt changes or aggressive sounds.',
            'depression': 'Start at a matching low energy (70-85 BPM, minor key) then subtly build toward warmth. Use warm timbres (cello, piano, gentle vocals). Aim for a hopeful, uplifting quality by the chorus.',
            'grief': 'Allow space for sadness — 65-80 BPM, minor or modal scales, piano and strings. Build gently toward acceptance and warmth, not forced happiness.',
            'stress': 'Calming: 60-75 BPM, major keys, ambient textures, nature-like sounds. Prioritize steady rhythms and predictable harmonic progressions.',
            'loneliness': 'Warm, enveloping sounds — 75-90 BPM, rich harmonies, layered instruments. Use sounds that feel like companionship (duets, harmonized vocals, full arrangements).',
            'trauma': 'Grounding and safe: 65-80 BPM, predictable structure, warm low-frequency instruments. Avoid sudden loud dynamics or dissonant chords.',
            'anger': 'Start with moderate energy that validates the feeling (90-110 BPM), then gradually shift toward release and resolution. Channel intensity constructively.',
            'burnout': 'Restorative: 65-80 BPM, gentle dynamics, acoustic instruments, open spacious arrangements. Music should feel like rest and renewal.',
            'low_self_esteem': 'Empowering: 85-100 BPM, major keys, confident dynamics that build. Use anthemic qualities — strong chorus, uplifting progression.',
            'inadequacy': 'Empowering: 85-100 BPM, major keys, confident dynamics that build. Use anthemic qualities — strong chorus, uplifting progression.',
            'overwhelm': 'Simplify: 60-75 BPM, minimal arrangement, one or two lead instruments. Create space and breathing room in the music.',
            'friendship_loss': 'Warm, nostalgic: 70-85 BPM, acoustic instruments (guitar, piano), tender dynamics. Build from aching to warm acceptance.',
            'romantic_breakup': 'Raw, honest: 75-90 BPM, minor keys, piano/guitar-driven. Allow emotional intensity, build toward resilience.',
            'heartbreak': 'Raw, honest: 75-90 BPM, minor keys, piano/guitar-driven. Allow emotional intensity, build toward resilience.',
            'abandonment': 'Tender, aching: 70-80 BPM, minor to major shift at bridge, warm acoustic instruments. Build from fear to self-worth.',
            'self_blame': 'Gentle, affirming: 75-85 BPM, warm timbres, building dynamics. Start reflective, build toward self-compassion.',
            'shame': 'Tender, non-judgmental: 70-80 BPM, soft dynamics building gradually, warm enveloping arrangement.',
            'rejection': 'Compassionate: 75-85 BPM, warm harmonies, building arrangement. Start intimate, build toward belonging.',
            'estrangement': 'Complex, honest: 70-85 BPM, mixed modes, layered arrangement. Allow ambiguity, honor grief for what should have been.',
            'family_conflict': 'Complex, honest: 70-85 BPM, mixed modes, layered arrangement. Allow ambiguity, honor grief for what should have been.',
            'invisibility': 'Affirming, warm: 80-90 BPM, building dynamics, rich harmonies. Start quiet, build to being heard.',
            'hopelessness': 'Patient, present: 60-75 BPM, gentle steady rhythm, warm low instruments. Do not demand joy — offer the smallest light.',
        }

        guideline = therapy_guidelines.get(domain, '')
        # Fall back to concern field for legacy profiles
        if not guideline and ep.get('concern'):
            guideline = therapy_guidelines.get(ep['concern'], '')

        prompt += f"""

MUSIC THERAPY GUIDELINES (use as preferences, balance with the narrative's natural genre):
Emotional domain: {domain}
Primary emotion: {ep.get('primary_emotion', '')}
Therapeutic need: {therapeutic_need}
{guideline}
These are evidence-based suggestions — adapt them to fit the genre naturally rather than overriding it."""

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
    return context
