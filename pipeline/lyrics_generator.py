import json
import os
import anthropic
from dotenv import load_dotenv

load_dotenv(override=True)

# Domain-specific imagery palettes and anti-patterns
DOMAIN_GUIDELINES = {
    "friendship_loss": {
        "imagery": "texts, inside jokes, empty seats, saved voice messages, the chair they always sat in",
        "avoid": "romantic imagery, breakup language, cohabitation references",
        "toxic_patterns": ["You'll make new friends", "They're not really leaving you", "True friends stay no matter what"],
    },
    "romantic_breakup": {
        "imagery": "keys, empty bed, two cups now one, shared spaces, songs that were 'ours'",
        "avoid": "platonic friendship framing, minimizing the intimacy",
        "toxic_patterns": ["You'll find someone better", "Plenty of fish", "It wasn't meant to be"],
    },
    "grief": {
        "imagery": "seasons, empty chairs, photographs, hands, their favorite things",
        "avoid": "forced happiness, rushed resolution, implying they should move on",
        "toxic_patterns": ["They're in a better place", "Everything happens for a reason", "At least they're not suffering"],
    },
    "family_conflict": {
        "imagery": "dinner tables, phone calls, holidays, childhood rooms, front doors",
        "avoid": "implying family is always right, guilt-tripping",
        "toxic_patterns": ["But they're your family", "You only get one mother/father", "They did their best"],
    },
    "abandonment": {
        "imagery": "doors, windows, roads, waving, phone screens, waiting",
        "avoid": "implying the user caused the abandonment, romanticizing the pain",
        "toxic_patterns": ["They didn't really leave", "If they loved you they'd stay", "You need to let go"],
    },
    "loneliness": {
        "imagery": "empty rooms, echoes, one plate, silence, crowded places where you're still alone",
        "avoid": "implying loneliness is a choice, suggesting they try harder socially",
        "toxic_patterns": ["Just get out more", "You need to put yourself out there", "Everyone feels lonely sometimes"],
    },
    "self_blame": {
        "imagery": "mirrors, gardens, hands, trying, mending, measuring up",
        "avoid": "dismissing the self-blame without addressing the pattern",
        "toxic_patterns": ["It's not your fault", "Stop being so hard on yourself", "Just love yourself"],
    },
    "anxiety": {
        "imagery": "weather, horizons, clocks, breathing, racing thoughts, tight chest",
        "avoid": "implying anxiety is irrational, forced calm",
        "toxic_patterns": ["Don't worry", "Just relax", "It's all in your head", "You're overthinking it"],
    },
    "shame": {
        "imagery": "shadows, masks, hiding, light, exposure, rebuilding",
        "avoid": "minimizing what happened, forced positivity about the event",
        "toxic_patterns": ["It's not a big deal", "No one even remembers", "You have nothing to be ashamed of"],
    },
    "burnout": {
        "imagery": "machines, empty wells, weight, crumbling foundations, rest",
        "avoid": "implying they should push through, hustle culture language",
        "toxic_patterns": ["Just push through", "Take a vacation", "Other people have it worse"],
    },
    "rejection": {
        "imagery": "doors closing, circles, outside looking in, glass walls",
        "avoid": "implying they need to change to be accepted",
        "toxic_patterns": ["Their loss", "You're better off without them", "Just be yourself"],
    },
    "estrangement": {
        "imagery": "dinner tables, phone calls, holidays, childhood rooms, distances",
        "avoid": "guilt about the estrangement, forced reconciliation",
        "toxic_patterns": ["But they're your family", "Life is short", "You'll regret this"],
    },
    "heartbreak": {
        "imagery": "keys, empty bed, songs that were 'ours', morning routines, silence where laughter was",
        "avoid": "rushing to 'you'll be fine', minimizing the bond",
        "toxic_patterns": ["You'll find someone better", "Time heals all wounds", "They weren't the one"],
    },
    "overwhelm": {
        "imagery": "waves, weight, too many hands pulling, noise, small quiet spaces",
        "avoid": "adding more pressure, implying they can't handle it",
        "toxic_patterns": ["Just prioritize", "Other people manage", "You need to be stronger"],
    },
    "invisibility": {
        "imagery": "glass, echoes, crowds, whispers, being passed by",
        "avoid": "implying they should speak up more, blaming them",
        "toxic_patterns": ["Speak up more", "Make yourself heard", "You need to be more assertive"],
    },
    "inadequacy": {
        "imagery": "measuring, containers, edges, scales, never reaching",
        "avoid": "empty affirmations without acknowledging the feeling",
        "toxic_patterns": ["Just be yourself", "You're enough", "Stop comparing yourself"],
    },
    "hopelessness": {
        "imagery": "fog, weight, gray, stillness, the smallest light",
        "avoid": "demanding joy, forced optimism, implying they're choosing despair",
        "toxic_patterns": ["Things will get better", "Choose happiness", "Look on the bright side"],
    },
}


def _get_client():
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not set.")
    return anthropic.Anthropic(api_key=api_key)


def generate_lyrics(context):
    """Generate song lyrics from narrative and musical features using Claude."""
    client = _get_client()
    features = context.musical_features.to_dict()

    ep = context.emotional_profile

    # Build therapy-informed lyric direction (from quiz)
    therapy_lyric_guidance = ""
    if context.therapy_profile:
        tp = context.therapy_profile
        therapy_lyric_guidance = f"""

CRITICAL — Therapeutic Direction (from mental health quiz):
The listener is feeling {tp.get('emotional_state', 'unknown')} and dealing with {tp.get('concern', 'unknown')}.
They want: {tp.get('therapeutic_goal', 'comfort')}.
{tp.get('lyric_direction', '')}
Intensity: {tp.get('intensity', 'moderate')} — {'keep imagery soft and gentle' if tp.get('intensity') == 'gentle' else 'go deep emotionally' if tp.get('intensity') == 'deep' else 'balance depth with accessibility'}.
"""

    if ep and ep.get('emotional_domain'):
        # Rich emotional profile — use domain-aware therapeutic lyrics prompt
        domain = ep.get('emotional_domain', '')
        domain_guide = DOMAIN_GUIDELINES.get(domain, {})

        prompt = f"""You are a songwriter creating a deeply personal therapeutic song. You have access
to a detailed emotional profile extracted from a real conversation with the listener.

MUSICAL CONTEXT:
- Mood: {features['mood']}, Genre: {features['genre']}, Tempo: {features['tempo']} BPM
- Duration: {features['duration']}s, Dynamics: {features['dynamics']}

EMOTIONAL PROFILE:
- Relationship type: {ep.get('relationship_type', 'unknown')}
- Relationship details: {ep.get('relationship_details', '')}
- Trigger event: {ep.get('trigger_event', '')}
- Emotional domain: {domain}
- Primary emotion: {ep.get('primary_emotion', '')}
- Secondary emotions: {', '.join(ep.get('secondary_emotions', []))}
- Recurring pattern: {ep.get('recurring_pattern', 'none')}
- Self-attribution: {ep.get('self_attribution', 'none')}
- Core wound: {ep.get('core_wound', '')}
- Feared future: {ep.get('feared_future', '')}
- What would help: {ep.get('what_would_help', '')}
- Concrete images: {', '.join(ep.get('concrete_images', []))}

NARRATIVE:
{context.narrative}

CRITICAL RULES:
1. NEVER invent details the user didn't share. Use only imagery from the emotional profile
   and concrete_images list.
2. NEVER use imagery from the wrong emotional domain. This is about {domain} —
   ensure ALL imagery reflects a {ep.get('relationship_type', '')} relationship.
3. The relationship type is {ep.get('relationship_type', '')} — if this is a friendship,
   do NOT use romantic breakup imagery (no "hallways we called home", "suitcases by the door",
   "empty bed", etc.). If this IS romantic, use romantic imagery.
4. Use concrete images from the profile: {', '.join(ep.get('concrete_images', []))}
5. NEVER include lines that match these unhelpful patterns: {ep.get('what_would_hurt', '')}
6. Domain-specific imagery to draw from: {domain_guide.get('imagery', '')}
7. Domain-specific patterns to AVOID: {', '.join(domain_guide.get('toxic_patterns', []))}

SECTION ROLES:
- [Verse 1] (3-4 lines): Mirror the user's SPECIFIC experience. Reference the trigger event:
  "{ep.get('trigger_event', '')}". Convey {ep.get('primary_emotion', 'their feeling')}.
  Use their concrete images. The listener should think "this song knows my story."
- [Chorus] (3-4 lines): Address the core wound: "{ep.get('core_wound', '')}".
  Deliver: {ep.get('what_would_help', '')}. Make it memorable and singable.
  This is the emotional turning point — validate AND gently reframe.
- [Verse 2] (3-4 lines): Acknowledge the pattern: "{ep.get('recurring_pattern', 'none')}".
  Address self-attribution: "{ep.get('self_attribution', 'none')}".
  Show deep understanding without trying to fix. Deepen the emotional connection.
- [Bridge] (2-3 lines): The genuine shift — not toxic positivity, but a real reframe.
  Something the user hasn't considered that honors their pain while opening a door.
  NOT "it'll be fine" but something earned and honest.

BALANCE: Each section must have specificity (their story), beauty (poetic and singable),
and validation (their pain is real). Only the chorus and bridge should gently reframe.
{therapy_lyric_guidance}
Return ONLY the lyrics with [Verse 1], [Chorus], [Verse 2], [Bridge] section markers. No other text."""

    elif ep:
        # Legacy therapeutic_context format
        concern = ep.get('concern', 'emotional difficulty')
        therapeutic_need = ep.get('therapeutic_need', 'support')
        themes = ', '.join(ep.get('themes', []))

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

THERAPEUTIC LYRIC GUIDANCE:
The listener is experiencing {concern} (themes: {themes}). Their therapeutic need is {therapeutic_need}.
Write lyrics that serve as emotional medicine:
- Verse 1: Validate their experience — show you understand what they're going through.
- Chorus: Deliver the therapeutic message — {therapeutic_need}. Make it memorable and singable.
- Verse 2: Offer perspective and gentle reframing — acknowledge the struggle while showing a path forward.
- Bridge: The breakthrough moment — a shift in perspective, a moment of clarity, strength, or acceptance.
Keep lyrics authentic and poetic — never preachy, clinical, or generic.
{therapy_lyric_guidance}
Return ONLY the lyrics with [Verse 1], [Chorus], [Verse 2], [Bridge] section markers. No other text."""

    else:
        # No therapeutic context — standard lyrics generation
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
{therapy_lyric_guidance}
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


def check_lyric_fidelity(context):
    """Run a therapeutic fidelity check on generated lyrics against the emotional profile.

    If the check fails, regenerate lyrics with corrections appended to the prompt.
    """
    ep = context.emotional_profile
    if not ep or not ep.get('emotional_domain'):
        return context

    client = _get_client()
    domain = ep.get('emotional_domain', '')
    domain_guide = DOMAIN_GUIDELINES.get(domain, {})

    check_prompt = f"""You are a therapeutic fidelity reviewer for song lyrics. Your job is to evaluate
whether lyrics accurately reflect a listener's emotional profile WITHOUT hallucinating details,
misclassifying the relationship, or using dismissive language.

EMOTIONAL PROFILE:
- Relationship type: {ep.get('relationship_type', '')}
- Trigger event: {ep.get('trigger_event', '')}
- Emotional domain: {domain}
- Primary emotion: {ep.get('primary_emotion', '')}
- Core wound: {ep.get('core_wound', '')}
- Concrete images from their story: {', '.join(ep.get('concrete_images', []))}
- What would help: {ep.get('what_would_help', '')}
- What would hurt: {ep.get('what_would_hurt', '')}
- Domain-specific toxic patterns to avoid: {', '.join(domain_guide.get('toxic_patterns', []))}

LYRICS TO EVALUATE:
{context.lyrics}

EVALUATE against these criteria (answer each with PASS or FAIL + explanation):

1. RELATIONSHIP ACCURACY: Does the song address the correct relationship type
   ({ep.get('relationship_type', '')})? Does it avoid imagery from the wrong relationship archetype?
2. STORY FIDELITY: Are key elements from trigger_event and concrete_images present?
   Are there hallucinated details (things never mentioned in the profile)?
3. EMOTIONAL DOMAIN: Are the lyrics in the correct emotional territory ({domain})?
   Do they avoid collapsing into an adjacent but wrong domain?
4. CORE WOUND: Does the chorus speak to the core wound ("{ep.get('core_wound', '')}")?
   Or does it offer only generic emotional validation?
5. ANTI-TOXIC POSITIVITY: Is the resolution earned and honest? Are there any lines
   that match patterns from what_would_hurt?
6. SPECIFICITY: Do at least 2 lines reference specific details from the profile?
   Could these lyrics be about anyone's sadness, or are they specific to this person?
7. AVOID LIST: Do any lines match the domain's toxic patterns?

Return a JSON object:
{{
    "overall": "PASS" or "FAIL",
    "criteria": {{
        "relationship_accuracy": {{"result": "PASS/FAIL", "explanation": "..."}},
        "story_fidelity": {{"result": "PASS/FAIL", "explanation": "..."}},
        "emotional_domain": {{"result": "PASS/FAIL", "explanation": "..."}},
        "core_wound": {{"result": "PASS/FAIL", "explanation": "..."}},
        "anti_toxic_positivity": {{"result": "PASS/FAIL", "explanation": "..."}},
        "specificity": {{"result": "PASS/FAIL", "explanation": "..."}},
        "avoid_list": {{"result": "PASS/FAIL", "explanation": "..."}}
    }},
    "corrections": ["list of specific corrections needed if FAIL, empty if PASS"]
}}

Return ONLY the JSON object, no other text."""

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        messages=[{"role": "user", "content": check_prompt}],
    )

    result_text = response.content[0].text.strip()
    if result_text.startswith("```"):
        result_text = result_text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

    try:
        result = json.loads(result_text)
    except json.JSONDecodeError:
        print("  Fidelity check: could not parse response, skipping")
        return context

    print(f"  Fidelity check result: {result.get('overall', 'UNKNOWN')}")

    if result.get("overall") == "PASS":
        return context

    # Fidelity check failed — regenerate with corrections
    corrections = result.get("corrections", [])
    if not corrections:
        return context

    corrections_text = "\n".join(f"- {c}" for c in corrections)
    print(f"  Fidelity check FAILED. Corrections:\n{corrections_text}")
    print("  Regenerating lyrics with corrections...")

    # Store original lyrics for comparison
    original_lyrics = context.lyrics

    # Regenerate with corrections appended
    features = context.musical_features.to_dict()
    domain_guide = DOMAIN_GUIDELINES.get(domain, {})

    regen_prompt = f"""You are a songwriter creating a deeply personal therapeutic song. A previous version
of these lyrics was reviewed and found to have issues. Please write NEW lyrics that fix these problems.

MUSICAL CONTEXT:
- Mood: {features['mood']}, Genre: {features['genre']}, Tempo: {features['tempo']} BPM

EMOTIONAL PROFILE:
- Relationship type: {ep.get('relationship_type', '')}
- Trigger event: {ep.get('trigger_event', '')}
- Emotional domain: {domain}
- Primary emotion: {ep.get('primary_emotion', '')}
- Core wound: {ep.get('core_wound', '')}
- Concrete images: {', '.join(ep.get('concrete_images', []))}
- What would help: {ep.get('what_would_help', '')}
- What would hurt: {ep.get('what_would_hurt', '')}

NARRATIVE:
{context.narrative}

PREVIOUS LYRICS (DO NOT COPY — these had problems):
{original_lyrics}

SPECIFIC CORRECTIONS REQUIRED:
{corrections_text}

Write completely new lyrics in this structure:
[Verse 1] (3-4 lines)
[Chorus] (3-4 lines)
[Verse 2] (3-4 lines)
[Bridge] (2-3 lines)

The relationship type is {ep.get('relationship_type', '')} — use ONLY appropriate imagery.
Use concrete images from the profile: {', '.join(ep.get('concrete_images', []))}
Do NOT invent details. Do NOT use imagery from: {domain_guide.get('avoid', '')}
Avoid these patterns: {', '.join(domain_guide.get('toxic_patterns', []))}

Return ONLY the lyrics with section markers. No other text."""

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        messages=[{"role": "user", "content": regen_prompt}],
    )
    context.lyrics = response.content[0].text.strip()
    print(f"  Regenerated lyrics:\n{context.lyrics}")
    return context
