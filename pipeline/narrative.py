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

    # Build therapy context if available
    therapy_guidance = ""
    if context.therapy_profile:
        tp = context.therapy_profile
        therapy_guidance = f"""

IMPORTANT — Therapy Context (from the user's mental health check-in):
- Emotional state: {tp.get('emotional_state', 'unknown')}
- Main concern: {tp.get('concern', 'unknown')}
- What they need: {tp.get('therapeutic_goal', 'unknown')}
- Preferred intensity: {tp.get('intensity', 'moderate')}
- Mood guidance: {tp.get('mood_hint', '')}
- Lyric direction: {tp.get('lyric_direction', '')}

Shape the narrative to serve their therapeutic need. If they want distraction, create an
escapist narrative that avoids their concern. If they want comfort, make the narrative warm
and reassuring. If they want release, lean into raw emotion. Match the intensity they chose."""

    if context.iteration == 0:
        prompt = f"""You are a creative music storyteller. The user wants to generate music
based on the following description. Expand this into a rich, evocative narrative
that captures the emotional landscape, atmosphere, and sonic qualities implied
by the description. Focus on sensory details that can translate into musical elements.

Keep the narrative to 2-3 paragraphs.
{therapy_guidance}
User input: {context.original_input}"""

        ep = context.emotional_profile
        if ep and ep.get('emotional_domain'):
            # Rich emotional profile available — use detailed guidance
            prompt += f"""

EMOTIONAL CONTEXT (use this to shape the narrative accurately):
- Relationship type: {ep.get('relationship_type', 'unknown')}
- Relationship details: {ep.get('relationship_details', '')}
- Trigger event: {ep.get('trigger_event', '')}
- Emotional domain: {ep.get('emotional_domain', '')}
- Primary emotion: {ep.get('primary_emotion', '')}
- Secondary emotions: {', '.join(ep.get('secondary_emotions', []))}
- Recurring pattern: {ep.get('recurring_pattern', 'none identified')}
- Core wound: {ep.get('core_wound', '')}
- Feared future: {ep.get('feared_future', '')}
- Concrete images from their story: {', '.join(ep.get('concrete_images', []))}

CRITICAL NARRATIVE RULES:
1. This is about a {ep.get('relationship_type', '')} relationship — use ONLY imagery appropriate
   to this relationship type. Do NOT default to romantic imagery unless the relationship IS romantic.
2. Reference the SPECIFIC trigger event: {ep.get('trigger_event', '')}
3. Use concrete images from their story: {', '.join(ep.get('concrete_images', []))}
   Do NOT invent details they didn't share.
4. The narrative arc should move from {ep.get('primary_emotion', 'their current feeling')} toward
   {ep.get('therapeutic_need', 'emotional resolution')}.
5. AVOID anything that sounds like: {ep.get('what_would_hurt', 'dismissive platitudes')}
6. The narrative should feel like it UNDERSTANDS their specific situation, not a generic version of sadness.

Shape the narrative as a journey — starting from where they are emotionally (acknowledging
{ep.get('primary_emotion', 'their pain')} and the reality of {ep.get('trigger_event', 'what happened')}),
then moving toward {ep.get('what_would_help', 'genuine understanding and hope')}.
Do NOT mention diagnoses or clinical terms. Keep it poetic and musical."""
        elif ep:
            # Legacy therapeutic_context format — basic guidance
            prompt += f"""

THERAPEUTIC GUIDANCE:
The user is experiencing {ep.get('concern', 'emotional difficulty')}, with themes of {', '.join(ep.get('themes', []))}.
Their primary therapeutic need is {ep.get('therapeutic_need', 'support')}.
Shape the narrative to acknowledge these feelings authentically, then gently guide toward
{ep.get('therapeutic_need', 'healing')}. The narrative should feel like a journey — starting from where
the user is emotionally, and moving toward a sense of resolution or hope by the end.
Do NOT mention diagnoses or clinical terms. Keep it poetic and musical."""
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
