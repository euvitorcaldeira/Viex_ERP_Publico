"""Build VIEX's vector identity and matching raster application assets."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

DESTINATION = Path(__file__).resolve().parents[1] / "public" / "brand"
NAVY = "#122B43"
TEAL = "#087F82"
BACKGROUND = "#F2F7F8"
LEFT = [(32, 40), (76, 40), (128, 164), (106, 216)]
RIGHT = [(180, 40), (224, 40), (150, 216), (106, 216)]


def polygons():
    return "".join(
        f'<polygon points="{" ".join(f"{x},{y}" for x, y in points)}" fill="{color}"/>'
        for points, color in ((LEFT, NAVY), (RIGHT, TEAL))
    )


def symbol(size=1024, background=False):
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    scale = size / 256
    if background:
        draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=48 * scale, fill=BACKGROUND)
    for points, color in ((LEFT, NAVY), (RIGHT, TEAL)):
        draw.polygon([(round(x * scale), round(y * scale)) for x, y in points], fill=color)
    return image


def main():
    DESTINATION.mkdir(parents=True, exist_ok=True)
    common = 'xmlns="http://www.w3.org/2000/svg" role="img" aria-label="VIEX ERP"'
    (DESTINATION / "viex-symbol.svg").write_text(
        f'<svg {common} viewBox="0 0 256 256">{polygons()}</svg>', encoding="utf-8"
    )
    (DESTINATION / "viex-icon.svg").write_text(
        f'<svg {common} viewBox="0 0 256 256"><rect width="256" height="256" rx="48" fill="{BACKGROUND}"/>{polygons()}</svg>',
        encoding="utf-8",
    )
    (DESTINATION / "viex-logo.svg").write_text(
        f'<svg {common} viewBox="0 0 550 256">{polygons()}'
        f'<text x="266" y="157" font-family="Arial,Helvetica,sans-serif" font-size="100" font-weight="700" fill="{NAVY}">VIEX</text>'
        f'<text x="268" y="207" font-family="Arial,Helvetica,sans-serif" font-size="38" letter-spacing="11" fill="{TEAL}">ERP</text></svg>',
        encoding="utf-8",
    )
    symbol().save(DESTINATION / "viex-symbol.png")
    icon = symbol(background=True)
    icon.resize((512, 512), Image.Resampling.LANCZOS).save(DESTINATION / "viex-icon.png")
    icon.save(DESTINATION / "viex.ico", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    scale = 3
    logo = Image.new("RGBA", (550 * scale, 256 * scale), (0, 0, 0, 0))
    logo.alpha_composite(symbol(256 * scale))
    draw = ImageDraw.Draw(logo)
    font = ImageFont.truetype("arialbd.ttf", 100 * scale)
    small = ImageFont.truetype("arial.ttf", 38 * scale)
    draw.text((266 * scale, 157 * scale), "VIEX", font=font, fill=NAVY, anchor="ls")
    cursor = 268 * scale
    for letter in "ERP":
        draw.text((cursor, 207 * scale), letter, font=small, fill=TEAL, anchor="ls")
        cursor += draw.textlength(letter, font=small) + 11 * scale
    logo.resize((1100, 512), Image.Resampling.LANCZOS).save(DESTINATION / "viex-logo.png")


if __name__ == "__main__":
    main()
