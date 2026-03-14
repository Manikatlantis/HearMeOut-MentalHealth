"""Compatibility wrapper. The orchestrator is now the primary entry point."""

from pipeline.orchestrator import Orchestrator


def run_pipeline(prompt):
    orchestrator = Orchestrator(prompt)
    context = orchestrator.run_full_cycle()
    return context.audio_file
