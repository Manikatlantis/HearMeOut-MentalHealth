import os
from pipeline import Orchestrator


def display_results(context):
    print("\n" + "=" * 60)
    print(f"  Iteration {context.iteration}")
    print("=" * 60)

    print("\n-- Narrative --")
    print(context.narrative[:500] + ("..." if len(context.narrative) > 500 else ""))

    print("\n-- Musical Features --")
    features = context.musical_features.to_dict()
    for key, value in features.items():
        print(f"  {key}: {value}")

    print(f"\n-- Output --")
    if context.audio_file:
        print(f"  Audio: {context.audio_file}")
    if context.pdf_file:
        print(f"  Document: {context.pdf_file}")
    print()


def main():
    print("=" * 60)
    print("  AI Music Storytelling Pipeline")
    print("=" * 60)
    print()

    user_input = input("Describe your musical vision: ").strip()
    if not user_input:
        print("No input provided. Exiting.")
        return

    generator = os.environ.get("MUSIC_GENERATOR", "eleven")
    orchestrator = Orchestrator(user_input, generator=generator)

    print("\nGenerating initial composition...")
    context = orchestrator.run_full_cycle()
    display_results(context)

    while True:
        print("Options:")
        print("  [f] Provide feedback to refine the music")
        print("  [s] Show current state")
        print("  [q] Quit")
        print()

        choice = input("> ").strip().lower()

        if choice == "q":
            print("Done.")
            break
        elif choice == "s":
            display_results(context)
        elif choice == "f":
            feedback = input("Describe how the music should change: ").strip()
            if feedback:
                print("\nRefining composition...")
                context = orchestrator.refine(feedback)
                display_results(context)
            else:
                print("No feedback provided.")
        else:
            print("Unknown option. Try f, s, or q.")


if __name__ == "__main__":
    main()
