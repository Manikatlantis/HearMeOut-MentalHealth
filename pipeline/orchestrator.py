from pipeline.context import PipelineContext
from pipeline.narrative import expand_narrative
from pipeline.analyzer import extract_musical_features
from pipeline.generator import generate_music
from pipeline.pdf_generator import generate_pdf


class Orchestrator:
    """Central controller managing the iterative generative pipeline.

    Manages transitions between representations:
        user input -> narrative -> musical features (JSON) -> audio (WAV)
    and supports iterative refinement through user feedback.
    """

    STAGES = ["narrative", "analyze", "lyrics", "generate", "document"]

    def __init__(self, user_input: str, generator: str = "eleven",
                 therapeutic_context: dict = None, emotional_profile: dict = None):
        profile = emotional_profile or therapeutic_context
        self.context = PipelineContext(user_input, emotional_profile=profile)
        self.generator = generator

    def run_full_cycle(self):
        """Execute all pipeline stages in sequence."""
        self.expand_narrative()
        self.extract_features()
        self.generate_lyrics()
        self.check_lyric_fidelity()
        self.generate_audio()
        self.align_lyrics()
        self.generate_document()
        return self.context

    def expand_narrative(self):
        expand_narrative(self.context)
        return self

    def extract_features(self):
        extract_musical_features(self.context)
        return self

    def generate_lyrics(self):
        from pipeline.lyrics_generator import generate_lyrics
        generate_lyrics(self.context)
        return self

    def check_lyric_fidelity(self):
        """Run therapeutic fidelity check on generated lyrics; regenerate if failed."""
        if not self.context.emotional_profile:
            return self
        try:
            from pipeline.lyrics_generator import check_lyric_fidelity
            check_lyric_fidelity(self.context)
        except Exception as e:
            print(f"  Lyric fidelity check failed (non-fatal): {e}")
        return self

    def generate_audio(self):
        if self.generator == "eleven":
            from pipeline.eleven_generator import generate_music_eleven
            generate_music_eleven(self.context)
        else:
            generate_music(self.context)
        return self

    def align_lyrics(self):
        try:
            from pipeline.lyrics_aligner import align_lyrics
            self.context.word_alignment = align_lyrics(
                audio_path=self.context.audio_file,
                lyrics_text=self.context.lyrics,
                composition_sections=self.context.composition_sections,
                total_duration=self.context.musical_features.duration,
            )
        except Exception as e:
            print(f"  Lyrics alignment step failed (non-fatal): {e}")
            self.context.word_alignment = None
        return self

    def generate_document(self):
        generate_pdf(self.context)
        return self

    def refine(self, feedback: str):
        """Incorporate user feedback and re-run the pipeline.

        The feedback is recorded in history, then the full cycle runs again
        with the accumulated context informing each stage.
        """
        self.context.apply_feedback(feedback)
        return self.run_full_cycle()

    def get_status(self):
        """Return a summary of the current pipeline state."""
        return {
            "iteration": self.context.iteration,
            "has_narrative": bool(self.context.narrative),
            "musical_features": self.context.musical_features.to_dict(),
            "audio_file": self.context.audio_file,
            "pdf_file": self.context.pdf_file,
            "history_length": len(self.context.history),
        }
