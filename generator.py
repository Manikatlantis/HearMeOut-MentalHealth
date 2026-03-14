import wave
import struct
import math
import os

# Note name to semitone offset from C
NOTE_OFFSETS = {
    "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3,
    "E": 4, "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8,
    "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11,
}

# Scale intervals (semitones from root)
SCALE_INTERVALS = {
    "major": [0, 2, 4, 5, 7, 9, 11],
    "minor": [0, 2, 3, 5, 7, 8, 10],
}


def _note_to_freq(note_name, octave=4):
    """Convert note name + octave to frequency in Hz."""
    semitone = NOTE_OFFSETS.get(note_name, 0)
    midi = 12 * (octave + 1) + semitone
    return 440.0 * (2 ** ((midi - 69) / 12.0))


def _parse_scale(scale_str):
    """Parse a scale string like 'C minor' into root note and intervals."""
    parts = scale_str.strip().split()
    root = parts[0] if parts else "C"
    mode = parts[1].lower() if len(parts) > 1 else "major"
    intervals = SCALE_INTERVALS.get(mode, SCALE_INTERVALS["major"])
    root_offset = NOTE_OFFSETS.get(root, 0)
    return root, root_offset, intervals


def _get_scale_frequencies(scale_str, octave=4, num_octaves=2):
    """Get frequencies for all notes in a scale across octaves."""
    root, root_offset, intervals = _parse_scale(scale_str)
    freqs = []
    for oct in range(octave, octave + num_octaves):
        for interval in intervals:
            midi = 12 * (oct + 1) + root_offset + interval
            freq = 440.0 * (2 ** ((midi - 69) / 12.0))
            freqs.append(freq)
    return freqs


def _chord_to_freqs(chord_name, octave=3):
    """Convert a chord name to a list of component frequencies."""
    root = chord_name.rstrip("m7dim+aug").strip()
    if not root:
        root = "C"
    root_offset = NOTE_OFFSETS.get(root, 0)

    if "m" in chord_name and chord_name.index("m") > 0:
        intervals = [0, 3, 7]  # minor triad
    else:
        intervals = [0, 4, 7]  # major triad

    if "7" in chord_name:
        intervals.append(10)

    freqs = []
    for interval in intervals:
        midi = 12 * (octave + 1) + root_offset + interval
        freqs.append(440.0 * (2 ** ((midi - 69) / 12.0)))
    return freqs


def _oscillator(freq, t, sample_rate, wave_type="sine"):
    """Generate a single sample for given waveform type."""
    phase = 2 * math.pi * freq * t / sample_rate
    if wave_type == "sine":
        return math.sin(phase)
    elif wave_type == "triangle":
        return 2 * abs(2 * (t * freq / sample_rate - math.floor(t * freq / sample_rate + 0.5))) - 1
    elif wave_type == "square":
        return 1.0 if math.sin(phase) >= 0 else -1.0
    elif wave_type == "sawtooth":
        return 2 * (t * freq / sample_rate - math.floor(t * freq / sample_rate + 0.5))
    return math.sin(phase)


def _envelope(t, duration, attack=0.05, decay=0.1, sustain=0.7, release=0.2):
    """ADSR envelope."""
    if t < attack:
        return t / attack
    elif t < attack + decay:
        return 1.0 - (1.0 - sustain) * (t - attack) / decay
    elif t < duration - release:
        return sustain
    else:
        remaining = duration - t
        return sustain * max(0, remaining / release)


def generate_music(context):
    """Generate a WAV file from the musical features in the pipeline context.

    Produces a multi-layered composition using chord pads and a melodic line
    driven by the extracted musical parameters.
    """
    features = context.musical_features
    output_dir = "output"
    os.makedirs(output_dir, exist_ok=True)
    filename = os.path.join(output_dir, f"music_v{context.iteration}.wav")

    sample_rate = 44100
    duration = 8  # seconds
    total_samples = sample_rate * duration

    # Map energy to amplitude
    base_amplitude = 0.3 + 0.5 * features.energy

    # Choose wave type based on genre/mood
    pad_wave = "sine"
    melody_wave = "sine"
    if features.genre in ("electronic", "synth"):
        pad_wave = "sawtooth"
        melody_wave = "square"
    elif features.genre in ("rock", "metal"):
        pad_wave = "square"
        melody_wave = "sawtooth"
    elif features.genre in ("cinematic", "orchestral"):
        pad_wave = "triangle"
        melody_wave = "sine"

    # Build chord progression timing
    chords = features.chord_progression or ["C", "Am", "F", "G"]
    beats_per_chord = 2
    bps = features.tempo / 60.0
    chord_duration_samples = int(sample_rate * beats_per_chord / bps)

    # Get scale frequencies for melody
    scale_freqs = _get_scale_frequencies(features.scale, octave=4, num_octaves=2)

    # Generate melody pattern from narrative hash (deterministic but varied)
    narrative_seed = sum(ord(c) for c in context.narrative) if context.narrative else 42
    melody_pattern = []
    for i in range(32):
        idx = (narrative_seed * (i + 1) + i * 7) % len(scale_freqs)
        melody_pattern.append(scale_freqs[idx])

    # Note duration for melody
    melody_note_samples = int(sample_rate * 0.5 / bps)

    samples = []
    for i in range(total_samples):
        t = i
        value = 0.0

        # --- Chord pad layer ---
        chord_index = (i // chord_duration_samples) % len(chords)
        chord_freqs = _chord_to_freqs(chords[chord_index])
        chord_t = (i % chord_duration_samples) / sample_rate
        chord_dur = chord_duration_samples / sample_rate
        env = _envelope(chord_t, chord_dur, attack=0.1, decay=0.2, sustain=0.6, release=0.3)
        for freq in chord_freqs:
            value += 0.15 * env * _oscillator(freq, t, sample_rate, pad_wave)

        # --- Melody layer ---
        melody_index = (i // melody_note_samples) % len(melody_pattern)
        melody_freq = melody_pattern[melody_index]
        melody_t = (i % melody_note_samples) / sample_rate
        melody_dur = melody_note_samples / sample_rate
        mel_env = _envelope(melody_t, melody_dur, attack=0.02, decay=0.05, sustain=0.8, release=0.15)
        value += 0.25 * mel_env * _oscillator(melody_freq, t, sample_rate, melody_wave)

        # --- Bass layer ---
        bass_chord_freqs = _chord_to_freqs(chords[chord_index], octave=2)
        bass_env = _envelope(chord_t, chord_dur, attack=0.02, decay=0.1, sustain=0.7, release=0.1)
        value += 0.2 * bass_env * _oscillator(bass_chord_freqs[0], t, sample_rate, "sine")

        # Apply overall amplitude and clamp
        value *= base_amplitude
        value = max(-1.0, min(1.0, value))
        samples.append(int(32767 * value))

    # Write WAV file
    wav_file = wave.open(filename, "w")
    wav_file.setnchannels(1)
    wav_file.setsampwidth(2)
    wav_file.setframerate(sample_rate)
    for s in samples:
        wav_file.writeframesraw(struct.pack('<h', s))
    wav_file.close()

    context.audio_file = filename
    return context
