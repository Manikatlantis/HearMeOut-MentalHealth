# Hear Me Out — AI-Powered Music Therapy

**Transform your emotions into healing music — no musical talent required.**

Mental health expression shouldn't be limited by technical ability. Hear Me Out is an AI-powered music therapy platform that listens to your story, reads your emotions through facial recognition, responds to your gestures, and creates a personalized song that reflects exactly how you feel — adapting in real time to your emotional state.

Whether you're processing grief, celebrating recovery, working through anxiety, or simply need to feel heard, Hear Me Out turns your inner world into music that heals.

---

## Why Music Therapy?

Music therapy is clinically proven to reduce anxiety, alleviate depression, and improve emotional regulation. But traditional music therapy requires trained therapists, musical instruments, and scheduled sessions. **Hear Me Out democratizes therapeutic music** by combining AI composition with computer vision to create an always-available, deeply personal music therapy experience.

- **Emotion-Aware Feedback Loop** — Facial emotion tracking detects your emotional state in real time and feeds it back into the music generation pipeline, creating songs that truly resonate with how you're feeling
- **Gesture-Based Expressive Interaction** — Hand gesture recognition lets you physically interact with the music — adjust tempo, shift mood, control intensity — turning passive listening into active emotional expression
- **Adaptive Musical Response** — The AI doesn't just create music *about* your emotions; it creates music that *responds to* your emotions, evolving as your state changes throughout the session

---

## How It Works

### 1. Share Your Story
Describe what you're feeling, a memory you're processing, or an emotion you want to explore. No musical knowledge needed — just your words.

### 2. AI Understands & Composes
A multi-model AI pipeline transforms your story into a fully produced song:
- **Claude (Anthropic)** expands your words into a rich emotional narrative, extracts therapeutic musical parameters, writes healing lyrics, and designs a complete composition plan
- **ElevenLabs** produces the final song with AI-sung vocals and full instrumentation

### 3. Feel & Interact
As your song plays, the system watches and responds:
- **Facial emotion tracking** reads your expressions via webcam, detecting shifts in mood
- **Hand gestures** let you physically shape the music — raise energy, soften dynamics, shift tempo
- **Audio-reactive visuals** create an immersive 3D environment that breathes with the music

### 4. Iterate & Heal
Refine your song through the Remix panel — adjust tempo, mood, genre, instruments, and dynamics. Each iteration deepens the therapeutic connection between your emotional state and the music.

---

## The AI Pipeline

```
Your Story (text) + Emotional State (CV)
        │
        ▼
   ┌─────────┐
   │ Claude   │  Narrative expansion — transforms feelings into
   │ Sonnet   │  rich emotional prose
   └────┬────┘
        │
        ▼
   ┌─────────┐
   │ Claude   │  Musical analysis — maps emotions to therapeutic
   │ Sonnet   │  musical parameters (tempo, key, mood, dynamics)
   └────┬────┘
        │
        ▼
   ┌─────────┐
   │ Claude   │  Lyrics generation — writes singable lyrics
   │ Sonnet   │  that reflect the user's emotional journey
   └────┬────┘
        │
        ▼
   ┌─────────┐
   │ Claude   │  Composition planning — vocal style, arrangement,
   │ Sonnet   │  section structure for maximum therapeutic impact
   └────┬────┘
        │
        ▼
   ┌──────────┐
   │ElevenLabs│  Full song production — AI vocals + instruments
   │Music API │  → streaming MP3
   └────┬─────┘
        │
        ▼
   ┌──────────┐
   │ Computer │  Real-time emotion tracking + gesture control
   │ Vision   │  → adaptive feedback into next iteration
   └──────────┘
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Frontend (Web UI)                       │
│  Three.js particles · Audio player · Lyrics overlay       │
│  Emotion tracker · Gesture mixer · CV feedback UI         │
│  Iterate panel · Aurora glassmorphism theme                │
└───────────────────────┬──────────────────────────────────┘
                        │  HTTP (POST /process, /refine)
┌───────────────────────▼──────────────────────────────────┐
│               FastAPI Backend (main.py)                    │
│  Session management · Static file serving · Audio         │
└───────────────────────┬──────────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────────┐
│              Orchestrator (orchestrator.py)                │
│  Stage sequencing · Feedback loop · History tracking       │
├───────────┬──────────┬──────────────┬────────────────────┤
│narrative  │ analyzer │ lyrics_gen   │ eleven_gen          │
│  .py      │   .py    │   .py        │    .py              │
│ Claude    │  Claude  │  Claude      │ Claude +            │
│ Sonnet    │  Sonnet  │  Sonnet      │ ElevenLabs          │
└───────────┴──────────┴──────────────┴────────────────────┘
```

### Computer Vision Layer

| Module | Role |
|--------|------|
| `emotion-tracker.js` | Real-time facial emotion detection via webcam — maps expressions to emotional states for therapeutic feedback |
| `gesture-mixer.js` | Hand gesture recognition — translates physical movements into musical parameter adjustments |
| `cv-ui.js` | Computer vision UI overlay — displays emotion readings, gesture indicators, and feedback status |
| `audio-effects.js` | Web Audio effect chain — reverb, delay, EQ manipulation driven by emotion and gesture data |

### Core Pipeline

| File | Role | AI Used |
|------|------|---------|
| `orchestrator.py` | Pipeline controller — sequences stages, handles iteration | — |
| `context.py` | Central data model — `PipelineContext` and `MusicalFeatures` | — |
| `narrative.py` | Story → rich emotional narrative | **Claude Sonnet** |
| `analyzer.py` | Narrative → therapeutic musical parameters (JSON) | **Claude Sonnet** |
| `lyrics_generator.py` | Features → healing lyrics | **Claude Sonnet** |
| `eleven_generator.py` | Lyrics + features → song with vocals | **Claude Sonnet** + **ElevenLabs** |
| `generator.py` | Fallback waveform synthesizer | — |

### Frontend

| File | Role |
|------|------|
| `index.html` | Three-screen SPA: input → loading → player, with CV integration |
| `app.js` | Generation flow, audio player, lyrics animation, iterate panel, CV hooks |
| `style.css` | Aurora-themed glassmorphism — therapeutic color palette |
| `background.js` | Three.js scene — audio-reactive particles, 3D musical notes, emotion-driven visuals |

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Creative AI | [Claude Sonnet](https://docs.anthropic.com/en/docs) (Anthropic) | Narrative expansion, musical analysis, lyrics, composition planning |
| Music Generation | [ElevenLabs Music API](https://elevenlabs.io/docs) | Full song production with AI vocals |
| Computer Vision | [MediaPipe](https://mediapipe.dev/) | Face mesh + hand tracking for emotion detection and gesture control |
| Extended AI | [Google Gemini](https://ai.google.dev/) | Multimodal processing and extended capabilities |
| Backend | [FastAPI](https://fastapi.tiangolo.com/) | Python web framework with async support |
| Frontend | Vanilla JS + [Three.js](https://threejs.org/) | No build tools — pure web standards |
| Audio Processing | Web Audio API | Real-time frequency analysis + effect chain |

---

## Setup

### Prerequisites
- Python 3.10+
- Webcam (for emotion tracking and gesture control)
- API keys for [Anthropic](https://console.anthropic.com/) and [ElevenLabs](https://elevenlabs.io/)

### Installation

```bash
git clone https://github.com/Manikatlantis/HearMeOut-MentalHealth.git
cd HearMeOut-MentalHealth
pip install fastapi uvicorn python-dotenv anthropic elevenlabs google-generativeai reportlab
```

### Environment Variables

Create a `.env` file in the project root:

```env
ANTHROPIC_API_KEY=sk-ant-...
ELEVENLABS_API_KEY=xi-...
GEMINI_API_KEY=...          # Optional
```

### Running

```bash
cd user_input/backend
uvicorn main:app --reload --port 8000
```

Then open `http://localhost:8000` in your browser. Grant camera permissions when prompted for emotion tracking and gesture control.

---

## Usage

1. **Share your story** — Describe what you're feeling or a moment you want to process
2. **Generate** — The AI pipeline creates a personalized therapeutic song (~30-60 seconds)
3. **Experience** — Listen with immersive 3D visuals while the system reads your emotional response
4. **Interact** — Use hand gestures to shape the music in real time
5. **Iterate** — Refine through the Remix panel until the music truly resonates
6. **Repeat** — Each session deepens the therapeutic connection

---

## Project Structure

```
HearMeOut-MentalHealth/
├── context.py              # PipelineContext + MusicalFeatures dataclasses
├── orchestrator.py         # Pipeline controller and stage sequencing
├── narrative.py            # Story → narrative (Claude Sonnet)
├── analyzer.py             # Narrative → musical features JSON (Claude Sonnet)
├── lyrics_generator.py     # Features → lyrics (Claude Sonnet)
├── eleven_generator.py     # Lyrics + features → song (Claude + ElevenLabs)
├── generator.py            # Fallback waveform synthesizer
├── pdf_generator.py        # Export narrative as PDF
├── main.py                 # CLI entry point
├── .env                    # API keys (not committed)
├── user_input/
│   ├── backend/
│   │   ├── main.py         # FastAPI server
│   │   ├── gemini_processor.py
│   │   └── pdf_generator.py
│   └── frontend/
│       ├── index.html      # Main SPA with CV integration
│       ├── app.js          # App logic + emotion/gesture hooks
│       ├── style.css       # Therapeutic aurora glassmorphism
│       ├── background.js   # Three.js particles + emotion-driven visuals
│       ├── audio-effects.js # Web Audio effect chain
│       ├── emotion-tracker.js # Facial emotion detection
│       ├── gesture-mixer.js   # Hand gesture music control
│       └── cv-ui.js        # Computer vision UI overlay
└── requirements.txt
```

---

## License

MIT
