# Hear Me Out — AI Music Therapy for Mental Health

**Tell your story. We'll make it sing.**

Mental health support shouldn't feel clinical or intimidating. **Hear Me Out** is an AI-powered music therapy platform that transforms your emotional stories into personalized, healing songs. By combining Claude's therapeutic intelligence with real-time computer vision, hand gesture controls, and an immersive 3D musical landscape, it creates an experience where processing emotions becomes creative, accessible, and deeply personal.

Built for the **Mental Health (SKIPIT)** track — supporting mental well-being, accessibility to care, and early intervention through the universal language of music.

> **Live Demo:** [hearmeout.ink](https://hearmeout.ink)

---

## Why Music Therapy?

Music therapy is clinically proven to reduce anxiety by up to 65%, alleviate symptoms of depression, and improve emotional regulation. But traditional music therapy requires trained therapists, musical instruments, and scheduled sessions — barriers that exclude millions who need help most.

**Hear Me Out democratizes therapeutic music** by making it available to anyone with a browser:

- No musical talent required — just your words and feelings
- Available 24/7 — no appointments, no waitlists
- Deeply personal — every song is crafted specifically for your emotional state
- Safe — built-in crisis detection, ethical AI guardrails, and privacy-first design

---

## Core Features

### AI Companion Chatbot
A Claude-powered therapeutic chatbot guides users through emotional exploration in a warm, conversational flow. After suffiecient number of exchanges, it synthesizes the conversation into a structured **emotional profile** — extracting relationship dynamics, trigger events, core wounds, and specific imagery — that becomes the song generation prompt. The chatbot understands 24 distinct emotional domains (friendship loss, romantic breakup, grief, burnout, anxiety, shame, and more) with domain-specific therapeutic guidelines for each.

The system also runs **real-time crisis detection** — if suicidal ideation or self-harm language is detected in any user input, an immediate full-screen intervention appears with the **988 Suicide & Crisis Lifeline**, Crisis Text Line, and international resources. User safety always takes priority.

### Personalized Song Generation
Stories pass through a multi-stage AI pipeline where Claude serves as every cognitive layer:

1. **Narrative Expansion** — Claude transforms raw user input into a rich emotional narrative, incorporating therapeutic context from the questionnaire and chatbot
2. **Musical Feature Extraction** — Claude maps the emotional domain to evidence-based music therapy parameters (e.g., anxiety → 60-80 BPM, major keys, soft dynamics, legato phrasing with piano and strings)
3. **Lyrics Generation** — Claude writes structured therapeutic lyrics ([Verse 1], [Chorus], [Verse 2], [Bridge]) with built-in **fidelity checking** that validates against the emotional profile and regenerates if lyrics contain toxic positivity, wrong relationship imagery, or dismissive messaging
4. **Composition Planning** — Claude designs the full arrangement (vocal style, section structure, instrumentation) for maximum therapeutic impact
5. **Audio Production** — ElevenLabs Music API produces the final song with AI-sung vocals and full instrumentation

Users can **iterate and refine** — adjusting tempo, mood, genre, instruments, and dynamics through a remix panel, with each iteration deepening the therapeutic connection.

### Hand Gesture Audio Controls
MediaPipe hand landmark detection through the webcam enables real-time audio manipulation via the Web Audio API effect chain:

| Gesture | Effect |
|---------|--------|
| Hand height | Continuous volume control |
| Peace sign ✌️ | Low-pass filter sweep |
| Fist ✊ | Bass-heavy distortion |
| OK sign 👌 | Reverb |
| Open palm 🖐️ | Mastered "best version" preset |
| Two-handed heart 🫶 | Spawns heart particles — emotional expression |
| DBZ energy charge ⚡ | Launches fireballs across the landscape — cathartic release |

All gestures work simultaneously — volume stays responsive from hand height while any other effect is active. The heart and fireball gestures serve as creative **emotional venting points**, giving users a sense of control over their environment and turning physical expression into visual catharsis.

### Facial Emotion Tracking
Using face-api.js for real-time facial landmark detection, the app reads micro-expressions across 7 emotion channels (happy, sad, angry, fearful, disgusted, surprised, neutral) and:

- Dynamically **tints the 3D landscape and particle colors** to mirror your emotional state
- Records an **emotion timeline** throughout song playback
- Feeds aggregated emotion data into the **wellness dashboard** for longitudinal tracking
- Generates AI-powered **emotional reflections** after playback using Claude Haiku, suggesting what your next song could explore

### Guided Meditation
Claude generates structured meditation scripts tailored to the user's emotional profile, which are narrated via ElevenLabs text-to-speech (using a calm, therapeutic voice). Features include:

- Concentric **breath-ring animations** synchronized to inhale/exhale cycles
- Webcam-based presence tracking during meditation
- Two modes: standalone relaxation or **story-connected** meditation that references the user's song narrative
- A dedicated calming view that removes all other UI distractions

### Immersive Musical Landscape
A fully custom Three.js 3D background built entirely from **musical notation characters** (♪ ♫ 𝄞 ♯ ♭ ≈ ✦). The system consists of four modular layers:

- **Glyph Atlas** — 15 musical characters rendered to an offscreen canvas sprite sheet with UV-mapped texture sampling
- **Landscape Grid** — 250×80 grid of points using custom vertex/fragment shaders with procedural simplex noise (fractal Brownian motion) for terrain generation, ocean-like wave undulation, per-point sparkle effects, and HSV color cycling through aurora palette colors
- **Sky System** — Star field, sun/moon arc paths driven by day cycle, shooting stars, and drifting cloud clusters.

A **cinematic fly-through camera** slowly glides through the terrain with lateral drift, vertical breathing, altitude variation, and periodic smoothstep look-around sweeps — creating a meditative, dreamlike atmosphere. Hand/face/mouse tracking layers parallax on top of the cinematic base.

The terrain is **audio-reactive** — bass energy creates ripple waves across the foreground, and the entire landscape responds to the music's energy.

### Mood Check-In & Journey Dashboard
**Pre-session questionnaire** (4 questions) assesses current emotional state, primary concern, therapeutic need, and desired intensity. Responses construct a **therapy profile** that guides the entire generation pipeline:

| Need | Musical Direction |
|------|-------------------|
| Comfort | Warm, tender, reassuring tones |
| Motivation | Uplifting, empowering with building dynamics |
| Distraction | Fun, escapist imagery |
| Validation | Empathetic, soulful acknowledgment |
| Release | Raw, cathartic intensity |
| Calm | Peaceful, meditative atmosphere |

**Post-session questionnaire** (9 questions, Likert scale) measures therapeutic outcomes — emotional connection, relief felt, hopefulness, body calm, and reuse likelihood.

The **Journey Dashboard** aggregates data across all sessions, displaying wellness score trends (grouped bar charts of pre/post scores), emotion profile radar charts, and improvement deltas over time — helping users and potential providers identify emotional patterns.

---

## AI Safety & Ethics

Mental health is a sensitive domain. Safety isn't a feature we bolted on — it's woven into every layer:

- **Crisis Intervention** — Real-time keyword detection for suicidal ideation and self-harm language (28 patterns across high/medium severity). Triggers an immediate full-screen modal with 988 Suicide & Crisis Lifeline, Crisis Text Line, and international resources. User safety always overrides engagement.
- **Therapeutic Fidelity Checking** — Generated lyrics are automatically validated against the user's emotional profile. If lyrics contain toxic positivity ("just cheer up"), wrong relationship imagery, or dismissive messaging, they are rejected and regenerated.
- **Domain-Specific Guidelines** — Each of the 24 emotional domains has explicit `avoid` and `toxic_patterns` lists (e.g., for friendship loss: never suggest "you'll make new friends"; for grief: never minimize with "they're in a better place").
- **No Diagnosis** — The system explicitly avoids clinical terminology and never positions itself as a replacement for professional care. It redirects to professional help when conversations indicate severity beyond its scope.
- **Camera Opt-In** — All webcam features (gestures, emotion tracking, meditation) are strictly opt-in. The app functions fully without a camera. No video data is transmitted — all CV processing happens entirely client-side.
- **Privacy-First** — Emotional data stays in a local SQLite database. User IDs are anonymous UUIDs stored in localStorage. Stories and conversations are processed for song generation and are not used to train models or shared with third parties.
- **Transparency** — The app clearly identifies itself as an AI-powered tool, not a substitute for professional mental health care.

---

## The AI Pipeline

```
User Story + Therapy Profile + Emotional Profile (from Chat)
        │
        ▼
   ┌─────────────┐
   │   Claude     │  Narrative Expansion — transforms feelings into
   │   Sonnet     │  rich emotional prose with therapeutic context
   └──────┬──────┘
          │
          ▼
   ┌─────────────┐
   │   Claude     │  Musical Analysis — maps emotions to evidence-based
   │   Sonnet     │  therapy parameters (tempo, key, mood, dynamics)
   └──────┬──────┘
          │
          ▼
   ┌─────────────┐
   │   Claude     │  Lyrics Generation — therapeutic lyrics with
   │   Sonnet     │  fidelity checking against emotional profile
   └──────┬──────┘
          │
          ▼
   ┌─────────────┐
   │   Claude     │  Composition Planning — vocal style, arrangement,
   │   Sonnet     │  section structure (Intro→Verse→Chorus→Bridge→Outro)
   └──────┬──────┘
          │
          ▼
   ┌──────────────┐
   │  ElevenLabs  │  Full Song Production — AI vocals + instrumentation
   │  Music API   │  → streaming MP3
   └──────┬───────┘
          │
          ▼
   ┌──────────────┐
   │  Computer    │  Real-time emotion tracking + gesture control
   │  Vision      │  → feedback into next iteration / session recap
   └──────────────┘
```

---

## Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                      Frontend (Vanilla JS)                     │
│  Three.js musical landscape · Audio player · Lyrics overlay    │
│  Emotion tracker · Gesture mixer · Chatbot · Meditation        │
│  Questionnaire · Dashboard · Aurora glassmorphism UI            │
└──────────────────────────┬────────────────────────────────────┘
                           │  HTTP (FastAPI routes)
┌──────────────────────────▼────────────────────────────────────┐
│                    FastAPI Backend                              │
│  /process · /refine · /api/chat · /api/meditation              │
│  /api/questionnaire · /api/dashboard · /api/session-recap      │
└──────────────────────────┬────────────────────────────────────┘
                           │
┌──────────────────────────▼────────────────────────────────────┐
│                Pipeline Orchestrator                            │
├────────────┬───────────┬──────────────┬───────────────────────┤
│ narrative  │ analyzer  │ lyrics_gen   │ eleven_gen             │
│   .py      │   .py     │    .py       │    .py                 │
│  Claude    │  Claude   │   Claude     │  Claude + ElevenLabs   │
│  Sonnet    │  Sonnet   │   Sonnet     │  (composition + TTS)   │
├────────────┴───────────┴──────────────┴───────────────────────┤
│                    SQLite Database                              │
│  users · sessions · chat_messages · questionnaire_responses    │
└───────────────────────────────────────────────────────────────┘
```

### Computer Vision Layer (Client-Side)

| Module | Technology | Role |
|--------|-----------|------|
| `emotion-tracker.js` | face-api.js | Real-time facial emotion detection (7 channels) |
| `gesture-mixer.js` | MediaPipe Hands | Hand gesture → audio effect mapping |
| `hand-geometry.js` | MediaPipe Hands | 3D hand visualization with gesture color coding |
| `face-geometry.js` | face-api.js | Face mesh rendering + head pose tracking |
| `audio-effects.js` | Web Audio API | Real-time effect chain (volume, filter, distortion, reverb, delay, panner) |

### 3D Background System

| Module | Role |
|--------|------|
| `glyphAtlas.js` | Renders 15 musical characters to a sprite sheet texture atlas |
| `landscapeGrid.js` | Procedural terrain with custom vertex/fragment shaders |
| `skySystem.js` | Star field, celestial bodies, shooting stars, clouds |
| `dayNightCycle.js` | Color temperature cycle + landscape preset transitions |
| `background.js` | Integration layer — cinematic camera, audio reactivity, emotion tinting |

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| AI Engine | [Claude Sonnet](https://docs.anthropic.com/) (Anthropic) | All text generation — narrative, analysis, lyrics, composition, chatbot, meditation, session recap |
| Lightweight AI | [Claude Haiku](https://docs.anthropic.com/) (Anthropic) | Post-playback emotion suggestions |
| Music Production | [ElevenLabs API](https://elevenlabs.io/) | Song generation (vocals + instruments) and meditation TTS |
| Backend | [FastAPI](https://fastapi.tiangolo.com/) (Python) | Async API server with session management |
| Database | SQLite | Local persistence for users, sessions, chat, questionnaires |
| Frontend | Vanilla JavaScript | No frameworks, no bundler — pure web standards |
| 3D Graphics | [Three.js](https://threejs.org/) + WebGL | Musical landscape with custom GLSL shaders |
| Hand Tracking | [MediaPipe Hands](https://mediapipe.dev/) | Real-time hand landmark detection |
| Face Detection | [face-api.js](https://github.com/vladmandic/face-api) | Facial emotion recognition (7 emotions) |
| Audio Processing | Web Audio API | Real-time frequency analysis + effect chain |
| Deployment | Vultr VPS + Namecheap domain | HTTPS required for browser camera access |

---

## Setup

### Prerequisites
- Python 3.10+
- Webcam (optional — for emotion tracking and gesture control)
- API keys for [Anthropic](https://console.anthropic.com/) and [ElevenLabs](https://elevenlabs.io/)

### Installation

```bash
git clone https://github.com/Manikatlantis/HearMeOut-MentalHealth.git
cd HearMeOut-MentalHealth
pip install -r requirements.txt
```

### Environment Variables

Create a `.env` file in the project root:

```env
ANTHROPIC_API_KEY=sk-ant-...
ELEVENLABS_API_KEY=xi-...
```

### Running

```bash
uvicorn backend.main:app --reload --port 8000
```

Open `https://localhost:8000` in your browser. Grant camera permissions when prompted for emotion tracking and gesture control.

> **Note:** HTTPS is required for browser camera access. For local development, use `--ssl-keyfile` and `--ssl-certfile` flags with uvicorn, or deploy behind an HTTPS proxy.

---

## Usage Flow

1. **Check In** — Complete the pre-session questionnaire (mood, concerns, therapeutic needs)
2. **Explore** — Chat with the AI companion to explore your feelings deeper (or skip and write directly)
3. **Generate** — Your story + emotional profile flows through the AI pipeline → personalized song
4. **Experience** — Listen with the immersive 3D musical landscape while emotion tracking captures your response
5. **Interact** — Use hand gestures to shape the audio in real time
6. **Reflect** — Post-session questionnaire + AI-generated session recap
7. **Track** — View your wellness journey on the dashboard over multiple sessions
8. **Meditate** — Optional guided meditation tied to your emotional narrative

---

## Project Structure

```
HearMeOut-MentalHealth/
├── backend/
│   ├── main.py                    # FastAPI server + all API routes
│   ├── routes/
│   │   └── chat.py                # Claude chatbot route + system prompt
│   ├── db/
│   │   ├── database.py            # SQLite schema + connection management
│   │   └── emotions.py            # Emotion data persistence
│   └── pipeline/
│       ├── orchestrator.py        # Pipeline controller + stage sequencing
│       ├── context.py             # PipelineContext + MusicalFeatures dataclasses
│       ├── narrative.py           # Story → emotional narrative (Claude)
│       ├── analyzer.py            # Narrative → musical parameters (Claude)
│       ├── lyrics_generator.py    # Parameters → therapeutic lyrics (Claude)
│       ├── eleven_generator.py    # Lyrics → full song (Claude + ElevenLabs)
│       ├── meditation_generator.py # Meditation scripts + TTS
│       └── generator.py           # Fallback waveform synthesizer
├── frontend/
│   ├── index.html                 # Main SPA with all screens
│   ├── design/
│   │   ├── style.css              # Aurora glassmorphism theme
│   │   ├── background.js          # Three.js integration + cinematic camera
│   │   ├── glyphAtlas.js          # Musical character sprite sheet
│   │   ├── landscapeGrid.js       # Procedural terrain with custom shaders
│   │   ├── skySystem.js           # Stars, sun/moon, shooting stars, clouds
│   │   └── dayNightCycle.js       # Color temperature cycle + preset transitions
│   └── features/
│       ├── chatbot.js             # AI companion chatbot UI
│       ├── crisis.js              # Crisis detection + intervention modal
│       ├── questionnaire.js       # Pre/post wellness assessment
│       ├── meditation.js          # Guided meditation UI
│       ├── dashboard.js           # Wellness journey visualization
│       ├── history.js             # Past sessions browser
│       ├── player/
│       │   ├── app.js             # Audio player + generation flow
│       │   ├── audio-effects.js   # Web Audio effect chain
│       │   └── download.js        # Song download handler
│       └── cv/
│           ├── emotion-tracker.js # Face emotion detection
│           ├── gesture-mixer.js   # Hand gesture → audio effects
│           ├── hand-geometry.js   # 3D hand visualization
│           ├── face-geometry.js   # Face mesh + head pose
│           ├── emotion-arc.js     # Emotion timeline tracking
│           ├── face-emotion-panel.js # Emotion display UI
│           └── cv-ui.js           # CV overlay + gesture suggestions
├── data/
│   └── hearmeout.db               # SQLite database (auto-created)
├── .env                           # API keys (not committed)
└── requirements.txt
```

---

## The Mental Health Mission

Traditional mental health tools often feel impersonal or intimidating. Hear Me Out approaches emotional support differently:

- **Creative expression as therapy** — Music lowers the barrier to emotional expression. Users who might hesitate to describe their feelings to a therapist open up naturally when framing it as a story that becomes *their* song.
- **Embodied interaction** — Hand gestures and facial tracking transform passive listening into active, physical emotional processing. The heart gesture and fireball release aren't just fun — they're deliberate emotional venting mechanisms.
- **Longitudinal tracking** — The questionnaire and dashboard system creates a data trail that helps users (and potentially providers) identify emotional patterns over time, supporting early intervention.
- **Always available** — No appointments, no waitlists, no stigma. Available at 3 AM when someone needs it most.
- **Evidence-based** — Musical parameters are mapped using established music therapy research (tempo ranges, key selection, dynamic patterns) tailored to specific emotional domains.

This isn't a replacement for professional mental health care — it's a bridge that makes therapeutic expression accessible to everyone, and a complement that extends care beyond the therapist's office.

---

## License

MIT
