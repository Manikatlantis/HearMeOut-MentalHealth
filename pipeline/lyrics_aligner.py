"""Whisper-based lyrics-audio alignment with multi-tier fallback."""

import difflib
import re

# Module-level Whisper model cache
_whisper_model = None


def _get_whisper_model():
    """Load and cache the faster-whisper model."""
    global _whisper_model
    if _whisper_model is None:
        from faster_whisper import WhisperModel
        _whisper_model = WhisperModel("base", compute_type="int8")
    return _whisper_model


def _parse_lyrics_lines(lyrics_text):
    """Parse lyrics into list of (section, line_text) tuples."""
    lines = []
    current_section = None
    for raw in lyrics_text.splitlines():
        stripped = raw.strip()
        if not stripped:
            continue
        if stripped.startswith("[") and stripped.endswith("]"):
            current_section = stripped.strip("[]").strip()
            continue
        lines.append((current_section, stripped))
    return lines


def _align_with_whisper(audio_path, lyrics_lines):
    """Tier 1: Use Whisper to transcribe and fuzzy-match to original lyrics."""
    model = _get_whisper_model()
    segments, _info = model.transcribe(audio_path, word_timestamps=True)

    # Collect all whisper words with timestamps
    whisper_words = []
    for segment in segments:
        if segment.words:
            for w in segment.words:
                whisper_words.append({
                    "word": w.word.strip(),
                    "start": round(w.start, 3),
                    "end": round(w.end, 3),
                })

    if not whisper_words:
        return None

    # Build flat list of original lyric words per line
    original_lines = []
    for section, text in lyrics_lines:
        words = text.split()
        original_lines.append({
            "section": section,
            "text": text,
            "words": words,
        })

    # Flatten all original words for sequence matching
    all_original_words = []
    word_to_line = []  # maps flat index -> (line_idx, word_idx_in_line)
    for li, line in enumerate(original_lines):
        for wi, w in enumerate(line["words"]):
            all_original_words.append(w.lower())
            word_to_line.append((li, wi))

    # Flatten whisper words
    whisper_texts = [w["word"].lower() for w in whisper_words]

    # Fuzzy match using SequenceMatcher
    matcher = difflib.SequenceMatcher(None, all_original_words, whisper_texts)
    matches = matcher.get_matching_blocks()

    # Build mapping: original word index -> whisper word index
    orig_to_whisper = {}
    for match in matches:
        for offset in range(match.size):
            orig_to_whisper[match.a + offset] = match.b + offset

    # Assign timestamps to lines
    result_lines = []
    flat_idx = 0
    for li, line in enumerate(original_lines):
        line_words = []
        line_start = None
        line_end = None

        for wi, word_text in enumerate(line["words"]):
            widx = orig_to_whisper.get(flat_idx)
            if widx is not None and widx < len(whisper_words):
                wdata = whisper_words[widx]
                word_entry = {
                    "word": word_text,
                    "start": wdata["start"],
                    "end": wdata["end"],
                }
                if line_start is None:
                    line_start = wdata["start"]
                line_end = wdata["end"]
            else:
                word_entry = {"word": word_text, "start": None, "end": None}
            line_words.append(word_entry)
            flat_idx += 1

        # Interpolate missing word timestamps within a line
        _interpolate_word_times(line_words, line_start, line_end)

        result_lines.append({
            "text": line["text"],
            "section": line["section"],
            "start": line_start,
            "end": line_end,
            "words": line_words,
        })

    # Interpolate missing line timestamps
    _interpolate_line_times(result_lines)

    return {"lines": result_lines, "source": "whisper"}


def _interpolate_word_times(words, line_start, line_end):
    """Fill in None timestamps by interpolating between known values."""
    if line_start is None or line_end is None:
        return
    n = len(words)
    if n == 0:
        return

    # Forward fill then backward fill, then interpolate gaps
    for i, w in enumerate(words):
        if w["start"] is None:
            # Find nearest known before and after
            before_end = line_start
            after_start = line_end
            for j in range(i - 1, -1, -1):
                if words[j]["end"] is not None:
                    before_end = words[j]["end"]
                    break
            for j in range(i + 1, n):
                if words[j]["start"] is not None:
                    after_start = words[j]["start"]
                    break
            # Count gap size
            gap_count = 1
            for j in range(i + 1, n):
                if words[j]["start"] is None:
                    gap_count += 1
                else:
                    break
            gap_pos = 0
            for j in range(i - 1, -1, -1):
                if words[j]["start"] is None:
                    gap_pos += 1
                else:
                    break
            total_gap = gap_pos + gap_count
            frac = (gap_pos + 1) / (total_gap + 1)
            w["start"] = round(before_end + (after_start - before_end) * (frac - 0.5 / total_gap), 3)
            w["end"] = round(before_end + (after_start - before_end) * (frac + 0.5 / total_gap), 3)


def _interpolate_line_times(lines):
    """Fill in lines with no timestamp data by interpolating neighbors."""
    n = len(lines)
    for i, line in enumerate(lines):
        if line["start"] is not None:
            continue
        # Find previous and next lines with timestamps
        prev_end = 0
        next_start = None
        for j in range(i - 1, -1, -1):
            if lines[j]["end"] is not None:
                prev_end = lines[j]["end"]
                break
        for j in range(i + 1, n):
            if lines[j]["start"] is not None:
                next_start = lines[j]["start"]
                break
        if next_start is None:
            next_start = prev_end + 3.0  # fallback: 3 seconds per line

        gap_lines = 1
        for j in range(i + 1, n):
            if lines[j]["start"] is None:
                gap_lines += 1
            else:
                break
        dur = (next_start - prev_end) / gap_lines
        offset = 0
        for j in range(i - 1, -1, -1):
            if lines[j]["start"] is None:
                offset += 1
            else:
                break
        line["start"] = round(prev_end + dur * offset, 3)
        line["end"] = round(prev_end + dur * (offset + 1), 3)

        # Also set word times
        if line.get("words"):
            word_dur = dur / len(line["words"])
            for wi, w in enumerate(line["words"]):
                w["start"] = round(line["start"] + wi * word_dur, 3)
                w["end"] = round(line["start"] + (wi + 1) * word_dur, 3)


def _align_with_sections(lyrics_lines, composition_sections, total_duration):
    """Tier 2: Use ElevenLabs composition section durations for alignment."""
    if not composition_sections:
        return None

    # Map section names to their start times and durations
    section_map = {}
    current_time = 0.0
    for sec in composition_sections:
        name = sec.get("section_name", "").lower()
        dur_ms = sec.get("duration_ms", 0)
        dur_s = dur_ms / 1000.0
        section_map[name] = {"start": current_time, "duration": dur_s}
        current_time += dur_s

    # Map lyrics sections to composition sections
    section_aliases = {
        "verse": "verse 1", "verse 1": "verse 1",
        "verse 2": "verse 2",
        "chorus": "chorus", "final chorus": "final chorus",
        "bridge": "bridge",
        "outro": "outro", "intro": "intro",
    }

    result_lines = []
    # Group lyrics lines by section
    section_groups = {}
    for section, text in lyrics_lines:
        key = (section or "").lower()
        if key not in section_groups:
            section_groups[key] = []
        section_groups[key].append(text)

    for section_name, texts in section_groups.items():
        alias = section_aliases.get(section_name, section_name)
        sec_info = section_map.get(alias)
        if not sec_info:
            # Try partial match
            for key in section_map:
                if section_name in key or key in section_name:
                    sec_info = section_map[key]
                    break
        if not sec_info:
            continue

        n_lines = len(texts)
        if n_lines == 0:
            continue
        time_per_line = sec_info["duration"] / n_lines
        for i, text in enumerate(texts):
            start = sec_info["start"] + i * time_per_line
            end = start + time_per_line
            words = text.split()
            word_dur = time_per_line / max(len(words), 1)
            result_lines.append({
                "text": text,
                "section": section_name.title() if section_name else None,
                "start": round(start, 3),
                "end": round(end, 3),
                "words": [
                    {
                        "word": w,
                        "start": round(start + j * word_dur, 3),
                        "end": round(start + (j + 1) * word_dur, 3),
                    }
                    for j, w in enumerate(words)
                ],
            })

    if not result_lines:
        return None

    # Sort by start time
    result_lines.sort(key=lambda l: l["start"])
    return {"lines": result_lines, "source": "sections"}


def _align_with_estimate(lyrics_lines, total_duration):
    """Tier 3: Reproduce the 25%/65% heuristic server-side."""
    start_offset = total_duration * 0.25
    available = total_duration * 0.65
    n_lines = len(lyrics_lines)
    if n_lines == 0:
        return {"lines": [], "source": "estimate"}

    time_per_line = available / n_lines
    result_lines = []
    for i, (section, text) in enumerate(lyrics_lines):
        start = start_offset + i * time_per_line
        end = start + time_per_line
        words = text.split()
        word_dur = time_per_line / max(len(words), 1)
        result_lines.append({
            "text": text,
            "section": section.title() if section else None,
            "start": round(start, 3),
            "end": round(end, 3),
            "words": [
                {
                    "word": w,
                    "start": round(start + j * word_dur, 3),
                    "end": round(start + (j + 1) * word_dur, 3),
                }
                for j, w in enumerate(words)
            ],
        })

    return {"lines": result_lines, "source": "estimate"}


def align_lyrics(audio_path, lyrics_text, composition_sections=None, total_duration=None):
    """Align lyrics to audio with three-tier fallback.

    Returns dict with 'lines' (list of aligned line objects) and 'source' indicator.
    """
    if not lyrics_text or not lyrics_text.strip():
        return None

    lyrics_lines = _parse_lyrics_lines(lyrics_text)
    if not lyrics_lines:
        return None

    # Determine total duration if not provided
    if total_duration is None:
        total_duration = 90  # default

    # Tier 1: Whisper transcription
    if audio_path:
        try:
            result = _align_with_whisper(audio_path, lyrics_lines)
            if result:
                print(f"  Lyrics alignment: Whisper (matched {len(result['lines'])} lines)")
                return result
        except Exception as e:
            print(f"  Whisper alignment failed: {e}, falling back...")

    # Tier 2: Composition section durations
    try:
        result = _align_with_sections(lyrics_lines, composition_sections, total_duration)
        if result:
            print(f"  Lyrics alignment: composition sections ({len(result['lines'])} lines)")
            return result
    except Exception as e:
        print(f"  Section alignment failed: {e}, falling back to estimates...")

    # Tier 3: Heuristic estimate
    result = _align_with_estimate(lyrics_lines, total_duration)
    print(f"  Lyrics alignment: estimate ({len(result['lines'])} lines)")
    return result
