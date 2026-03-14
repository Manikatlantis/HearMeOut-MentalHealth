import os
import textwrap

try:
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False


def generate_pdf(context):
    """Generate a PDF document capturing the current narrative and musical features.

    This PDF serves as an exportable artifact representing the creative context
    at a given iteration of the pipeline.
    """
    output_dir = "output"
    os.makedirs(output_dir, exist_ok=True)
    filename = os.path.join(output_dir, f"narrative_v{context.iteration}.pdf")

    if REPORTLAB_AVAILABLE:
        _generate_with_reportlab(context, filename)
    else:
        _generate_text_fallback(context, filename)

    context.pdf_file = filename
    return context


def _generate_with_reportlab(context, filename):
    c = canvas.Canvas(filename, pagesize=letter)
    _, height = letter
    y = height - 50

    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, y, f"Musical Narrative - Iteration {context.iteration}")
    y -= 30

    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, y, "Original Input:")
    y -= 18
    c.setFont("Helvetica", 10)
    for line in textwrap.wrap(context.original_input, width=90):
        c.drawString(60, y, line)
        y -= 14

    y -= 10
    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, y, "Narrative Context:")
    y -= 18
    c.setFont("Helvetica", 10)
    for line in context.narrative.split("\n"):
        for wrapped in textwrap.wrap(line, width=90):
            if y < 50:
                c.showPage()
                y = height - 50
            c.drawString(60, y, wrapped)
            y -= 14

    y -= 10
    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, y, "Musical Parameters:")
    y -= 18
    c.setFont("Helvetica", 10)
    features = context.musical_features.to_dict()
    for key, value in features.items():
        if y < 50:
            c.showPage()
            y = height - 50
        c.drawString(60, y, f"{key}: {value}")
        y -= 14

    c.save()


def _generate_text_fallback(context, filename):
    """Plain text fallback when reportlab is not installed."""
    txt_filename = filename.replace(".pdf", ".txt")
    with open(txt_filename, "w") as f:
        f.write(f"Musical Narrative - Iteration {context.iteration}\n")
        f.write("=" * 50 + "\n\n")
        f.write(f"Original Input:\n{context.original_input}\n\n")
        f.write(f"Narrative:\n{context.narrative}\n\n")
        f.write("Musical Parameters:\n")
        for key, value in context.musical_features.to_dict().items():
            f.write(f"  {key}: {value}\n")
    context.pdf_file = txt_filename
