import json
import copy
from dataclasses import dataclass, field


@dataclass
class MusicalFeatures:
    tempo: int = 90
    genre: str = "ambient"
    mood: str = "calm"
    instruments: list = field(default_factory=lambda: ["piano"])
    scale: str = "C major"
    chord_progression: list = field(default_factory=lambda: ["C", "Am", "F", "G"])
    energy: float = 0.4
    dynamics: str = "soft"
    duration: int = 90

    def to_dict(self):
        return {
            "tempo": self.tempo,
            "genre": self.genre,
            "mood": self.mood,
            "instruments": self.instruments,
            "scale": self.scale,
            "chord_progression": self.chord_progression,
            "energy": self.energy,
            "dynamics": self.dynamics,
            "duration": self.duration,
        }

    @classmethod
    def from_dict(cls, d):
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})

    def to_json(self):
        return json.dumps(self.to_dict(), indent=2)


class PipelineContext:
    """Central artifact that flows through and evolves across pipeline iterations."""

    def __init__(self, user_input: str):
        self.original_input = user_input
        self.narrative = ""
        self.musical_features = MusicalFeatures()
        self.lyrics = ""
        self.audio_file = None
        self.pdf_file = None
        self.iteration = 0
        self.history = []

    def snapshot(self):
        """Capture current state for history tracking."""
        return {
            "iteration": self.iteration,
            "narrative": self.narrative,
            "musical_features": self.musical_features.to_dict(),
            "lyrics": self.lyrics,
            "audio_file": self.audio_file,
        }

    def save_to_history(self):
        self.history.append(self.snapshot())

    def apply_feedback(self, feedback: str):
        """Record feedback and advance iteration."""
        self.save_to_history()
        self.iteration += 1
        self.history[-1]["feedback"] = feedback

    def get_accumulated_context(self):
        """Build a summary of all context for AI prompts."""
        parts = [f"Original request: {self.original_input}"]
        if self.narrative:
            parts.append(f"Current narrative:\n{self.narrative}")
        parts.append(f"Current musical features:\n{self.musical_features.to_json()}")
        if self.history:
            feedback_items = [
                h["feedback"] for h in self.history if "feedback" in h
            ]
            if feedback_items:
                parts.append("User feedback history:\n" + "\n".join(
                    f"  - Round {i+1}: {fb}" for i, fb in enumerate(feedback_items)
                ))
        return "\n\n".join(parts)
