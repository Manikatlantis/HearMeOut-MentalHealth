"""Generate a 1-page concept brief PDF for Hear Me Out."""

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas

W, H = letter
OUTPUT = "Hear_Me_Out_Concept_Brief.pdf"

DARK = HexColor("#0a0e1a")
ROSE = HexColor("#f472b6")
AMBER = HexColor("#fbbf24")
TEAL = HexColor("#2dd4bf")
LIGHT_GRAY = HexColor("#e0e0e0")
MID_GRAY = HexColor("#888888")


def draw_brief():
    c = canvas.Canvas(OUTPUT, pagesize=letter)

    # ---- Header bar ----
    c.setFillColor(DARK)
    c.rect(0, H - 90, W, 90, fill=True, stroke=False)

    c.setFillColor(ROSE)
    c.setFont("Helvetica-Bold", 28)
    c.drawString(50, H - 55, "Hear Me Out")

    c.setFillColor(LIGHT_GRAY)
    c.setFont("Helvetica", 11)
    c.drawString(50, H - 75, "Turn your stories into songs — no musical talent required.")

    c.setFillColor(AMBER)
    c.setFont("Helvetica-Oblique", 9)
    c.drawRightString(W - 50, H - 55, "AI-Powered Music Generation")
    c.setFillColor(TEAL)
    c.drawRightString(W - 50, H - 70, "Claude Opus 4.6 API (Anthropic)  |  ElevenLabs Music API")

    y = H - 115

    # ---- The Problem ----
    c.setFillColor(ROSE)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(50, y, "The Problem")
    y -= 5

    c.setFillColor(HexColor("#333333"))
    c.setFont("Helvetica", 9.2)
    lines = [
        "Every person carries stories that deserve to be heard — a first love, a quiet goodbye, a moment of triumph, a grief that lingers.",
        "But for most people, these stories remain locked inside. They lack the musical training to compose a melody, the vocal ability to",
        "sing, or the production skills to create a track. Traditional music creation demands years of practice with instruments, knowledge of",
        "music theory, and access to expensive recording studios. The result: billions of untold stories, billions of unsung songs.",
        "",
        "Existing AI music tools generate generic background music from keywords. They don't understand your story. They don't write lyrics",
        "that capture your specific experience. They don't produce a song that feels like yours. The gap between having a story and hearing",
        "it as a song remains vast — until now.",
    ]
    for line in lines:
        y -= 13
        c.drawString(50, y, line)

    y -= 22

    # ---- The Solution ----
    c.setFillColor(TEAL)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(50, y, "The Solution")
    y -= 5

    c.setFillColor(HexColor("#333333"))
    c.setFont("Helvetica", 9.2)
    lines = [
        "Hear Me Out is a generative AI platform that transforms personal stories into fully produced songs with custom lyrics and AI-sung",
        "vocals. Users describe their experience in plain language — a paragraph, a few sentences, even a single feeling — and our multi-",
        "model AI pipeline composes a complete, unique song that tells their story through music. The entire system is API-driven, chaining",
        "together three generative AI APIs in a five-stage pipeline:",
    ]
    for line in lines:
        y -= 13
        c.drawString(50, y, line)

    y -= 8

    steps = [
        ("1. Narrative Expansion", "Claude Opus 4.6 API", "Transforms raw input into a rich, emotionally detailed narrative"),
        ("2. Musical Analysis", "Claude Opus 4.6 API", "Extracts structured musical parameters — genre, tempo, mood, key, dynamics"),
        ("3. Lyrics Generation", "Claude Opus 4.6 API", "Writes singable verse + chorus lyrics that poeticize the user's story"),
        ("4. Composition Planning", "Claude Opus 4.6 API", "Architects a production plan with vocal styles, sections, and lyric placement"),
        ("5. Music Production", "ElevenLabs API", "Generates the final track — instruments, arrangement, and AI-sung vocals"),
    ]
    for label, api, desc in steps:
        y -= 14
        c.setFont("Helvetica-Bold", 8.5)
        c.setFillColor(HexColor("#1a1a2e"))
        c.drawString(65, y, label)
        c.setFont("Helvetica-Bold", 7.5)
        c.setFillColor(TEAL)
        c.drawString(195, y, f"[{api}]")
        c.setFont("Helvetica", 8.2)
        c.setFillColor(HexColor("#555555"))
        c.drawString(310, y, desc)

    y -= 10

    c.setFillColor(HexColor("#333333"))
    c.setFont("Helvetica", 9.2)
    lines = [
        "After generation, users iteratively refine their song — adjusting tempo, swapping genres, adding instruments, changing mood —",
        "and the entire API pipeline re-runs with accumulated feedback context, producing a new version each time.",
    ]
    for line in lines:
        y -= 13
        c.drawString(50, y, line)

    y -= 22

    # ---- API Architecture ----
    c.setFillColor(AMBER)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(50, y, "API Architecture & Generative AI Models")
    y -= 5

    c.setFillColor(HexColor("#333333"))
    c.setFont("Helvetica", 9.2)
    lines = [
        "The system is built entirely on two generative AI APIs — no local models, no fine-tuning. Each API call is prompt-engineered for",
        "its specific creative task, and the outputs chain together to form a coherent creative pipeline.",
    ]
    for line in lines:
        y -= 13
        c.drawString(50, y, line)

    y -= 10

    # API table
    c.setFont("Helvetica-Bold", 8.5)
    c.setFillColor(HexColor("#1a1a2e"))
    headers = [("API / Model", 50), ("Provider", 185), ("Calls", 275), ("Role in Pipeline", 320)]
    for text, x in headers:
        c.drawString(x, y, text)
    y -= 2
    c.setStrokeColor(HexColor("#cccccc"))
    c.line(50, y, W - 50, y)
    y -= 13

    c.setFont("Helvetica", 8.5)
    rows = [
        ("Claude Opus 4.6 API", "Anthropic", "5x", "Narrative expansion, musical analysis, lyrics writing, composition planning"),
        ("ElevenLabs Music API", "ElevenLabs", "1x", "Full song production with AI-sung vocals from composition plans"),
    ]
    for model, provider, calls, role in rows:
        c.setFillColor(HexColor("#333333"))
        c.setFont("Helvetica-Bold", 8.5)
        c.drawString(50, y, model)
        c.setFont("Helvetica", 8.5)
        c.drawString(185, y, provider)
        c.setFillColor(ROSE)
        c.setFont("Helvetica-Bold", 8.5)
        c.drawString(275, y, calls)
        c.setFillColor(HexColor("#555555"))
        c.setFont("Helvetica", 8)
        c.drawString(320, y, role)
        y -= 14

    y -= 6
    c.setFillColor(HexColor("#333333"))
    c.setFont("Helvetica", 9.2)
    lines = [
        "Claude Opus 4.6 serves as the creative brain — it understands stories, makes musical decisions, writes lyrics, and designs",
        "production plans. The Anthropic API is called via the official Python SDK with carefully engineered prompts for each stage.",
        "ElevenLabs Music API handles audio synthesis — receiving the Claude-designed composition plan and producing studio-quality",
        "instrumentals with AI-sung vocals. Together, these two APIs power the entire creative pipeline end to end.",
    ]
    for line in lines:
        y -= 13
        c.drawString(50, y, line)

    y -= 22

    # ---- Why It Matters ----
    c.setFillColor(ROSE)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(50, y, "Why It Matters")
    y -= 5

    c.setFillColor(HexColor("#333333"))
    c.setFont("Helvetica", 9.2)
    lines = [
        "Music is the most universal form of human expression — it transcends language, culture, and literacy. Yet creating music has",
        "always been one of the most gatekept art forms. Hear Me Out democratizes musical expression through generative AI. A grandmother",
        "can turn her immigration story into a ballad. A teenager can transform heartbreak into an indie track. A community can hear its",
        "collective memory as a song. We're not replacing musicians — we're giving a voice to the billions of people who have stories",
        "worth singing but never had the means to sing them.",
    ]
    for line in lines:
        y -= 13
        c.drawString(50, y, line)

    # ---- Footer bar ----
    c.setFillColor(HexColor("#f5f5f5"))
    c.rect(0, 28, W, 40, fill=True, stroke=False)
    c.setFont("Helvetica", 8)
    c.setFillColor(MID_GRAY)
    stack = "Claude Opus 4.6 API (Anthropic)  ·  ElevenLabs Music API  ·  FastAPI  ·  Python  ·  Three.js  ·  Web Audio API"
    c.drawCentredString(W / 2, 45, stack)
    c.setFont("Helvetica-Oblique", 7.5)
    c.drawCentredString(W / 2, 33, "Powered by generative AI APIs at every stage of the creative pipeline")

    c.save()
    print(f"Generated: {OUTPUT}")


if __name__ == "__main__":
    draw_brief()
