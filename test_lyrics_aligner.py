"""Test script for lyrics_aligner.py — exercises all three alignment tiers."""

import json
import sys

SAMPLE_LYRICS = """[Verse 1]
Walking through the rain tonight
Searching for a guiding light
Every step feels like a mile
But I keep walking with a smile

[Chorus]
Hold on, hold on to the dream
Nothing's ever what it seems
We'll find our way through the dark
Guided by a single spark

[Verse 2]
Shadows dance along the wall
Whispered voices start to call
Reaching out for something real
Learning how to truly feel

[Bridge]
And when the morning comes around
We'll plant our feet upon the ground

[Chorus]
Hold on, hold on to the dream
Nothing's ever what it seems
We'll find our way through the dark
Guided by a single spark
"""

SAMPLE_SECTIONS = [
    {"section_name": "Intro", "duration_ms": 7200, "lines": []},
    {"section_name": "Verse 1", "duration_ms": 19800, "lines": [
        "Walking through the rain tonight",
        "Searching for a guiding light",
        "Every step feels like a mile",
        "But I keep walking with a smile",
    ]},
    {"section_name": "Chorus", "duration_ms": 18000, "lines": [
        "Hold on, hold on to the dream",
        "Nothing's ever what it seems",
        "We'll find our way through the dark",
        "Guided by a single spark",
    ]},
    {"section_name": "Verse 2", "duration_ms": 19800, "lines": [
        "Shadows dance along the wall",
        "Whispered voices start to call",
        "Reaching out for something real",
        "Learning how to truly feel",
    ]},
    {"section_name": "Bridge", "duration_ms": 14400, "lines": [
        "And when the morning comes around",
        "We'll plant our feet upon the ground",
    ]},
    {"section_name": "Final Chorus", "duration_ms": 18000, "lines": [
        "Hold on, hold on to the dream",
        "Nothing's ever what it seems",
        "We'll find our way through the dark",
        "Guided by a single spark",
    ]},
    {"section_name": "Outro", "duration_ms": 6300, "lines": []},
]


def test_tier3_estimate():
    """Tier 3: heuristic estimate (no audio, no sections)."""
    from lyrics_aligner import align_lyrics

    result = align_lyrics(
        audio_path=None,
        lyrics_text=SAMPLE_LYRICS,
        composition_sections=None,
        total_duration=90,
    )

    assert result is not None, "Tier 3 returned None"
    assert result["source"] == "estimate", f"Expected source 'estimate', got '{result['source']}'"
    assert len(result["lines"]) > 0, "No lines in result"

    # Check all lines have timestamps
    for i, line in enumerate(result["lines"]):
        assert line["start"] is not None, f"Line {i} missing start"
        assert line["end"] is not None, f"Line {i} missing end"
        assert line["start"] < line["end"], f"Line {i} start >= end"
        assert len(line["words"]) > 0, f"Line {i} has no words"
        for j, w in enumerate(line["words"]):
            assert w["start"] is not None, f"Line {i} word {j} missing start"
            assert w["end"] is not None, f"Line {i} word {j} missing end"

    # Check timing is within expected range (25% to 90% of duration)
    first_start = result["lines"][0]["start"]
    last_end = result["lines"][-1]["end"]
    assert first_start >= 90 * 0.24, f"First line starts too early: {first_start}"
    assert last_end <= 90 * 0.91, f"Last line ends too late: {last_end}"

    # Check lines are ordered
    for i in range(1, len(result["lines"])):
        assert result["lines"][i]["start"] >= result["lines"][i-1]["start"], \
            f"Lines not ordered at index {i}"

    print(f"  PASS: {len(result['lines'])} lines, {first_start:.1f}s - {last_end:.1f}s")
    return result


def test_tier2_sections():
    """Tier 2: composition section-based alignment."""
    from lyrics_aligner import align_lyrics

    result = align_lyrics(
        audio_path=None,
        lyrics_text=SAMPLE_LYRICS,
        composition_sections=SAMPLE_SECTIONS,
        total_duration=90,
    )

    assert result is not None, "Tier 2 returned None"
    assert result["source"] == "sections", f"Expected source 'sections', got '{result['source']}'"
    assert len(result["lines"]) > 0, "No lines in result"

    # Verify lines have word-level data
    for i, line in enumerate(result["lines"]):
        assert line["words"], f"Line {i} has no words"
        for j, w in enumerate(line["words"]):
            assert w["start"] is not None, f"Line {i} word {j} missing start"

    # Verify lines are sorted by start time
    for i in range(1, len(result["lines"])):
        assert result["lines"][i]["start"] >= result["lines"][i-1]["start"], \
            f"Lines not sorted at index {i}"

    first_start = result["lines"][0]["start"]
    last_end = result["lines"][-1]["end"]
    print(f"  PASS: {len(result['lines'])} lines, {first_start:.1f}s - {last_end:.1f}s")
    return result


def test_tier1_whisper():
    """Tier 1: Whisper-based alignment (requires an actual audio file)."""
    import os
    from glob import glob

    # Look for any generated audio in output/
    audio_files = glob("output/music_v*.mp3")
    if not audio_files:
        print("  SKIP: No audio files found in output/. Generate a song first to test Whisper alignment.")
        return None

    audio_path = audio_files[-1]  # use latest
    print(f"  Using audio: {audio_path}")

    from lyrics_aligner import align_lyrics

    result = align_lyrics(
        audio_path=audio_path,
        lyrics_text=SAMPLE_LYRICS,
        composition_sections=SAMPLE_SECTIONS,
        total_duration=90,
    )

    assert result is not None, "Tier 1 returned None"
    # Could be whisper or sections depending on whether whisper matched anything
    print(f"  Source: {result['source']}")
    assert len(result["lines"]) > 0, "No lines in result"

    if result["source"] == "whisper":
        # Check that at least some words have real timestamps
        words_with_times = sum(
            1 for line in result["lines"]
            for w in line["words"]
            if w["start"] is not None
        )
        total_words = sum(len(line["words"]) for line in result["lines"])
        print(f"  Words with timestamps: {words_with_times}/{total_words}")

    first_start = result["lines"][0]["start"]
    last_end = result["lines"][-1]["end"]
    print(f"  PASS: {len(result['lines'])} lines, {first_start:.1f}s - {last_end:.1f}s")
    return result


def test_empty_lyrics():
    """Edge case: empty or no lyrics."""
    from lyrics_aligner import align_lyrics

    assert align_lyrics(None, "", None, 90) is None
    assert align_lyrics(None, "   \n\n  ", None, 90) is None
    assert align_lyrics(None, "[Verse 1]\n\n[Chorus]\n", None, 90) is None
    print("  PASS: empty lyrics handled correctly")


def test_context_integration():
    """Test that PipelineContext has the new fields."""
    from context import PipelineContext

    ctx = PipelineContext("test input")
    assert hasattr(ctx, "word_alignment"), "PipelineContext missing word_alignment"
    assert hasattr(ctx, "composition_sections"), "PipelineContext missing composition_sections"
    assert ctx.word_alignment is None
    assert ctx.composition_sections is None
    print("  PASS: PipelineContext fields present")


def compare_tiers(tier2_result, tier3_result):
    """Show how tier 2 vs tier 3 timing differs."""
    if not tier2_result or not tier3_result:
        return

    print("\n  Tier 2 (sections) vs Tier 3 (estimate) — first 4 lines:")
    for i in range(min(4, len(tier2_result["lines"]), len(tier3_result["lines"]))):
        t2 = tier2_result["lines"][i]
        t3 = tier3_result["lines"][i]
        print(f"    \"{t2['text'][:40]}...\"")
        print(f"      Tier 2: {t2['start']:6.1f}s - {t2['end']:6.1f}s")
        print(f"      Tier 3: {t3['start']:6.1f}s - {t3['end']:6.1f}s")


if __name__ == "__main__":
    print("\n=== Lyrics Aligner Tests ===\n")

    print("1. Context integration:")
    test_context_integration()

    print("\n2. Edge cases (empty lyrics):")
    test_empty_lyrics()

    print("\n3. Tier 3 — Heuristic estimate:")
    tier3 = test_tier3_estimate()

    print("\n4. Tier 2 — Composition sections:")
    tier2 = test_tier2_sections()

    compare_tiers(tier2, tier3)

    print("\n5. Tier 1 — Whisper (if audio available):")
    test_tier1_whisper()

    print("\n=== All tests passed ===\n")

    # Print sample JSON output for frontend debugging
    if "--json" in sys.argv:
        print("Sample alignment JSON (Tier 2):")
        print(json.dumps(tier2, indent=2)[:2000])
