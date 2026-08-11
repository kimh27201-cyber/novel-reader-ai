from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from PIL import Image
from reportlab.lib.colors import Color, HexColor
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "output" / "pdf"
OUT_PDF = OUT_DIR / "decode-reading-portfolio-zhou-junhua.pdf"

W, H = A4
M = 36

FONT_REG = "Deng"
FONT_BOLD = "Deng-Bold"

INK = HexColor("#0A1018")
PANEL = HexColor("#121B29")
PANEL_2 = HexColor("#182333")
CYAN = HexColor("#58F4E8")
GOLD = HexColor("#E7B65D")
CORAL = HexColor("#FF7043")
WHITE = HexColor("#F5F8FA")
MUTED = HexColor("#A7B4C5")
LINE = HexColor("#2B3A4B")
PAPER = HexColor("#F3F6F6")
TEXT_DARK = HexColor("#17202B")
SOFT_DARK = HexColor("#4D5A69")
PINK = HexColor("#D65193")


ASSETS = {
    "icon": ROOT / "static" / "branding" / "app-icon-1024.png",
    "current_phone": ROOT / "output" / "pdf" / "assets" / "current-phone.png",
    "source_library": Path(r"D:\Codex\source-library-393.png"),
    "source_scan": Path(r"D:\Codex\source-scan-393.png"),
    "reader": ROOT / "output" / "playwright" / "p1-reader.png",
    "reader_controls": ROOT / "output" / "playwright" / "p1-reader-controls.png",
    "reader_catalog": ROOT / "output" / "playwright" / "p1-reader-catalog.png",
    "theme_panel": Path(r"D:\Codex\stage1-candy-preview-native.png"),
    "backend_selfcheck": Path(r"D:\Codex\android-hbuilder-backend-selfcheck.png"),
    "xuanye": ROOT / "output" / "playwright" / "theme-visual-check" / "xuanye-bookshelf.png",
    "candy": ROOT / "output" / "playwright" / "theme-visual-check" / "candy-bookshelf.png",
    "sakura": ROOT / "output" / "playwright" / "theme-visual-check" / "sakura-bookshelf.png",
    "cyber": ROOT / "output" / "playwright" / "theme-visual-check" / "cyber-bookshelf.png",
    "noir": ROOT / "output" / "playwright" / "theme-visual-check" / "noirGold-bookshelf.png",
}


def register_fonts() -> None:
    pdfmetrics.registerFont(TTFont(FONT_REG, r"C:\Windows\Fonts\Deng.ttf"))
    pdfmetrics.registerFont(TTFont(FONT_BOLD, r"C:\Windows\Fonts\Dengb.ttf"))


def hex_alpha(hex_color: str, alpha: float) -> Color:
    c = HexColor(hex_color)
    return Color(c.red, c.green, c.blue, alpha=alpha)


def rounded_rect(c: canvas.Canvas, x: float, y: float, w: float, h: float,
                 radius: float = 10, fill=PANEL, stroke=None, line_width: float = 1) -> None:
    c.saveState()
    c.setLineWidth(line_width)
    if stroke is None:
        c.setStrokeColor(fill)
    else:
        c.setStrokeColor(stroke)
    c.setFillColor(fill)
    c.roundRect(x, y, w, h, radius, stroke=1 if stroke else 0, fill=1)
    c.restoreState()


def line(c: canvas.Canvas, x1: float, y1: float, x2: float, y2: float,
         color=LINE, width: float = 1) -> None:
    c.saveState()
    c.setStrokeColor(color)
    c.setLineWidth(width)
    c.line(x1, y1, x2, y2)
    c.restoreState()


def txt(c: canvas.Canvas, text: str, x: float, y: float, size: float = 10,
        color=WHITE, font: str = FONT_REG, align: str = "left") -> None:
    c.saveState()
    c.setFont(font, size)
    c.setFillColor(color)
    if align == "center":
        c.drawCentredString(x, y, text)
    elif align == "right":
        c.drawRightString(x, y, text)
    else:
        c.drawString(x, y, text)
    c.restoreState()


def text_width(text: str, size: float, font: str = FONT_REG) -> float:
    return pdfmetrics.stringWidth(text, font, size)


def wrap_text(text: str, max_width: float, size: float, font: str = FONT_REG) -> list[str]:
    lines: list[str] = []
    current = ""
    for ch in text:
        candidate = current + ch
        if current and text_width(candidate, size, font) > max_width:
            lines.append(current)
            current = ch
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines


def paragraph(c: canvas.Canvas, text: str, x: float, y_top: float, max_width: float,
              size: float = 10, leading: float | None = None, color=MUTED,
              font: str = FONT_REG, max_lines: int | None = None) -> float:
    leading = leading or size * 1.55
    lines: list[str] = []
    for raw in text.split("\n"):
        lines.extend(wrap_text(raw, max_width, size, font) or [""])
    if max_lines is not None:
        lines = lines[:max_lines]
    y = y_top
    for item in lines:
        txt(c, item, x, y, size, color, font)
        y -= leading
    return y


def bullet_list(c: canvas.Canvas, items: list[str], x: float, y: float, width: float,
                size: float = 9.5, color=MUTED, dot_color=CYAN, gap: float = 9) -> float:
    for item in items:
        c.saveState()
        c.setFillColor(dot_color)
        c.circle(x + 3, y + 4, 2, stroke=0, fill=1)
        c.restoreState()
        next_y = paragraph(c, item, x + 14, y + 7, width - 14, size=size,
                           leading=size * 1.55, color=color)
        y = next_y - gap
    return y


def draw_image_cover(c: canvas.Canvas, path: Path, x: float, y: float, w: float, h: float,
                     radius: float = 10, stroke=LINE, bg=PANEL) -> None:
    if not path.exists():
        rounded_rect(c, x, y, w, h, radius, bg, stroke)
        txt(c, "image unavailable", x + w / 2, y + h / 2, 8, MUTED, align="center")
        return
    with Image.open(path) as im:
        iw, ih = im.size
    scale = max(w / iw, h / ih)
    dw, dh = iw * scale, ih * scale
    dx, dy = x + (w - dw) / 2, y + (h - dh) / 2
    c.saveState()
    clip = c.beginPath()
    clip.roundRect(x, y, w, h, radius)
    c.clipPath(clip, stroke=0, fill=0)
    c.drawImage(ImageReader(str(path)), dx, dy, dw, dh, preserveAspectRatio=True, mask="auto")
    c.restoreState()
    if stroke:
        c.saveState()
        c.setStrokeColor(stroke)
        c.setLineWidth(0.8)
        c.roundRect(x, y, w, h, radius, stroke=1, fill=0)
        c.restoreState()


def draw_image_contain(c: canvas.Canvas, path: Path, x: float, y: float, w: float, h: float,
                       radius: float = 10, stroke=LINE, bg=PANEL) -> None:
    rounded_rect(c, x, y, w, h, radius, bg, stroke)
    if not path.exists():
        txt(c, "image unavailable", x + w / 2, y + h / 2, 8, MUTED, align="center")
        return
    with Image.open(path) as im:
        iw, ih = im.size
    scale = min((w - 4) / iw, (h - 4) / ih)
    dw, dh = iw * scale, ih * scale
    dx, dy = x + (w - dw) / 2, y + (h - dh) / 2
    c.saveState()
    clip = c.beginPath()
    clip.roundRect(x + 1, y + 1, w - 2, h - 2, max(2, radius - 1))
    c.clipPath(clip, stroke=0, fill=0)
    c.drawImage(ImageReader(str(path)), dx, dy, dw, dh, preserveAspectRatio=True, mask="auto")
    c.restoreState()


def page_bg(c: canvas.Canvas, page_no: int, light: bool = False) -> None:
    c.setFillColor(PAPER if light else INK)
    c.rect(0, 0, W, H, stroke=0, fill=1)
    if not light:
        c.saveState()
        c.setFillColor(hex_alpha("#58F4E8", 0.05))
        c.circle(W - 10, H - 25, 120, stroke=0, fill=1)
        c.setFillColor(hex_alpha("#E7B65D", 0.04))
        c.circle(0, 15, 100, stroke=0, fill=1)
        c.restoreState()
    footer(c, page_no, light)


def footer(c: canvas.Canvas, page_no: int, light: bool = False) -> None:
    color = HexColor("#718090") if light else HexColor("#6E7C8D")
    line(c, M, 22, W - M, 22, HexColor("#DCE3E6") if light else LINE, 0.6)
    txt(c, "解码阅读 - 项目作品集", M, 10, 7.5, color)
    txt(c, f"{page_no:02d}", W - M, 10, 7.5, color, align="right")


def section_title(c: canvas.Canvas, kicker: str, title: str, subtitle: str | None = None,
                  light: bool = False) -> None:
    primary = TEXT_DARK if light else WHITE
    secondary = SOFT_DARK if light else MUTED
    txt(c, kicker.upper(), M, H - 54, 8.5, CYAN if not light else PINK, FONT_BOLD)
    txt(c, title, M, H - 86, 24, primary, FONT_BOLD)
    if subtitle:
        txt(c, subtitle, M, H - 106, 9, secondary)


def pill(c: canvas.Canvas, text: str, x: float, y: float, fill=CYAN, fg=INK,
         size: float = 8.2, pad_x: float = 9, h: float = 20) -> float:
    w = text_width(text, size, FONT_BOLD) + pad_x * 2
    rounded_rect(c, x, y, w, h, h / 2, fill, None)
    txt(c, text, x + w / 2, y + 6, size, fg, FONT_BOLD, "center")
    return w


def metric_card(c: canvas.Canvas, x: float, y: float, w: float, h: float,
                value: str, label: str, accent=CYAN, light: bool = False) -> None:
    fill = WHITE if light else PANEL
    stroke = HexColor("#D8E0E4") if light else LINE
    rounded_rect(c, x, y, w, h, 10, fill, stroke)
    txt(c, value, x + 14, y + h - 28, 19, accent, FONT_BOLD)
    txt(c, label, x + 14, y + 13, 8.3, SOFT_DARK if light else MUTED)


def callout(c: canvas.Canvas, number: str, title: str, body: str,
            x: float, y: float, w: float, h: float, accent=CYAN) -> None:
    rounded_rect(c, x, y, w, h, 10, PANEL, LINE)
    c.saveState()
    c.setFillColor(accent)
    c.circle(x + 24, y + h - 24, 13, stroke=0, fill=1)
    c.restoreState()
    txt(c, number, x + 24, y + h - 28, 9, INK, FONT_BOLD, "center")
    txt(c, title, x + 44, y + h - 28, 12, WHITE, FONT_BOLD)
    paragraph(c, body, x + 16, y + h - 52, w - 32, 8.5, 13, MUTED, max_lines=3)


def cover_page(c: canvas.Canvas) -> None:
    page_bg(c, 1)
    # Signal line and logo
    c.saveState()
    c.setFillColor(CYAN)
    c.rect(M, H - 66, 70, 3, stroke=0, fill=1)
    c.setFillColor(GOLD)
    c.rect(M + 74, H - 66, 22, 3, stroke=0, fill=1)
    c.restoreState()
    draw_image_contain(c, ASSETS["icon"], W - M - 48, H - 92, 48, 48, 10, None, INK)

    txt(c, "PRODUCT DESIGN + FULL-STACK DELIVERY", M, H - 105, 8.5, CYAN, FONT_BOLD)
    txt(c, "解码阅读", M, H - 166, 38, WHITE, FONT_BOLD)
    txt(c, "AI 阅读助手移动端项目作品集", M, H - 198, 17, GOLD, FONT_BOLD)
    paragraph(c,
              "从信息架构、视觉主题与阅读交互，到 FastAPI 后端、Android 真机联调与自动化验证。"
              "作品完整展示设计判断、工程协作和交付能力。",
              M, H - 232, 285, 10.5, 17, MUTED)

    x = M
    for item, color in [("UI / 交互", CYAN), ("产品闭环", GOLD), ("Android 真机", CORAL)]:
        x += pill(c, item, x, H - 322, color, INK) + 8

    # Hero phone and notes
    phone_x, phone_y, phone_w, phone_h = 338, 94, 216, 572
    c.saveState()
    c.setFillColor(hex_alpha("#58F4E8", 0.08))
    c.roundRect(phone_x - 14, phone_y - 14, phone_w + 28, phone_h + 28, 28, stroke=0, fill=1)
    c.restoreState()
    draw_image_cover(c, ASSETS["current_phone"], phone_x, phone_y, phone_w, phone_h, 22, CYAN)

    rounded_rect(c, M, 150, 270, 164, 14, PANEL, LINE)
    txt(c, "项目一句话", M + 18, 286, 8.5, CYAN, FONT_BOLD)
    paragraph(c,
              "一个支持本地 TXT、书源规则导入、多源搜索、章节阅读、离线缓存与 AI 总结问答的移动阅读助手。",
              M + 18, 260, 234, 12, 20, WHITE, FONT_BOLD)
    line(c, M + 18, 196, M + 252, 196, LINE, 0.8)
    txt(c, "前端", M + 18, 176, 8, MUTED)
    txt(c, "uni-app / Vue 2", M + 72, 176, 9, WHITE, FONT_BOLD)
    txt(c, "后端", M + 18, 158, 8, MUTED)
    txt(c, "FastAPI / SQLAlchemy", M + 72, 158, 9, WHITE, FONT_BOLD)

    txt(c, "周俊华", M, 74, 12, WHITE, FONT_BOLD)
    txt(c, "项目作品附件 - 2026.07", M, 56, 8.5, MUTED)
    txt(c, "当前画面来自 2026-07-21 HBuilderX Android 真机基座", 338, 74, 7.3, MUTED)


def overview_page(c: canvas.Canvas) -> None:
    page_bg(c, 2, light=True)
    section_title(c, "01 / Project Overview", "把阅读工具做成可交付产品", "定位、目标、角色与可验证成果", light=True)

    rounded_rect(c, M, 568, W - 2 * M, 134, 14, WHITE, HexColor("#D8E0E4"))
    txt(c, "设计命题", M + 20, 675, 9, PINK, FONT_BOLD)
    txt(c, "面对复杂书源与长文本阅读，如何让用户始终知道下一步？", M + 20, 646, 16, TEXT_DARK, FONT_BOLD)
    paragraph(c,
              "核心不是增加更多入口，而是把导入、识别、检测、搜索、阅读和 AI 辅助串成有状态反馈的连续流程；"
              "同时为失败、兼容性不足和离线场景提供明确解释。",
              M + 20, 618, W - 2 * M - 40, 9.4, 15, SOFT_DARK)

    col_w = (W - 2 * M - 18) / 2
    callout(c, "01", "产品设计", "梳理信息架构、任务路径、空状态、错误反馈与阅读沉浸体验。", M, 430, col_w, 112, PINK)
    callout(c, "02", "视觉系统", "建立统一 token，并扩展 5 套主题，让视觉差异服务不同阅读气质。", M + col_w + 18, 430, col_w, 112, GOLD)
    callout(c, "03", "全栈落地", "uni-app 客户端连接 FastAPI，覆盖鉴权、书架、书源、阅读进度与 AI。", M, 300, col_w, 112, CYAN)
    callout(c, "04", "验证交付", "真机联调、APK 构建、pytest、前端工具测试、CI 与验收文档共同收口。", M + col_w + 18, 300, col_w, 112, CORAL)

    metrics_y = 156
    gap = 10
    mw = (W - 2 * M - gap * 3) / 4
    metric_card(c, M, metrics_y, mw, 90, "5", "可切换主题", PINK, True)
    metric_card(c, M + (mw + gap), metrics_y, mw, 90, "47", "FastAPI 路由", CYAN, True)
    metric_card(c, M + 2 * (mw + gap), metrics_y, mw, 90, "97", "后端测试通过", CORAL, True)
    metric_card(c, M + 3 * (mw + gap), metrics_y, mw, 90, "65", "前端测试文件通过", GOLD, True)
    txt(c, "数据来源：项目代码与 2026-07-21 本机测试结果", M, 132, 7.5, SOFT_DARK)


def flow_page(c: canvas.Canvas) -> None:
    page_bg(c, 3)
    section_title(c, "02 / Product Flow", "从导入到阅读的闭环", "每一步都对应一个用户疑问和一个可见反馈")

    # Main horizontal flow
    y = 560
    box_w = 92
    gap = 14
    steps = [
        ("1", "导入", "链接 / JSON\n扫码 / 文件", GOLD),
        ("2", "识别", "解析格式\n预览变化", CYAN),
        ("3", "检测", "规则兼容\n网络可用", CORAL),
        ("4", "搜索", "多源并发\n结果去重", CYAN),
        ("5", "阅读", "目录 / 缓存\n主题 / AI", GOLD),
    ]
    for i, (num, title, body, accent) in enumerate(steps):
        x = M + i * (box_w + gap)
        rounded_rect(c, x, y, box_w, 112, 12, PANEL, LINE)
        c.saveState(); c.setFillColor(accent); c.circle(x + 18, y + 89, 10, stroke=0, fill=1); c.restoreState()
        txt(c, num, x + 18, y + 86, 8, INK, FONT_BOLD, "center")
        txt(c, title, x + 16, y + 57, 13, WHITE, FONT_BOLD)
        paragraph(c, body, x + 16, y + 38, box_w - 28, 7.7, 12, MUTED)
        if i < len(steps) - 1:
            line(c, x + box_w + 3, y + 56, x + box_w + gap - 3, y + 56, CYAN, 1.2)
            c.saveState(); c.setFillColor(CYAN); c.circle(x + box_w + gap - 3, y + 56, 2.5, stroke=0, fill=1); c.restoreState()

    txt(c, "关键设计原则", M, 514, 10, CYAN, FONT_BOLD)
    principles = [
        ("先预览，再确认", "导入前显示新增、覆盖、不兼容数量，降低误操作成本。"),
        ("状态可解释", "兼容、网络、超时与失败原因分层呈现，不用笼统的“加载失败”。"),
        ("复杂能力渐进展开", "默认保留主任务，批量检测、反爬参数和日志放在二级面板。"),
        ("离线仍可演示", "本地 TXT 与 mock AI 让面试、CI 和弱网环境仍能跑通完整流程。"),
    ]
    card_h = 82
    for i, (title, body) in enumerate(principles):
        row, col = divmod(i, 2)
        x = M + col * (255 + 14)
        yy = 410 - row * (card_h + 14)
        rounded_rect(c, x, yy, 255, card_h, 10, PANEL_2, LINE)
        txt(c, f"0{i+1}", x + 14, yy + card_h - 24, 8, GOLD, FONT_BOLD)
        txt(c, title, x + 44, yy + card_h - 26, 11, WHITE, FONT_BOLD)
        paragraph(c, body, x + 14, yy + card_h - 46, 227, 8.2, 12.5, MUTED, max_lines=2)

    rounded_rect(c, M, 122, W - 2 * M, 82, 12, hex_alpha("#58F4E8", 0.08), CYAN)
    txt(c, "产品价值", M + 18, 178, 8.5, CYAN, FONT_BOLD)
    txt(c, "把“能解析书源”转化为“普通用户能理解、能排错、能继续阅读”的体验。", M + 18, 146, 14, WHITE, FONT_BOLD)


def visual_system_page(c: canvas.Canvas) -> None:
    page_bg(c, 4, light=True)
    section_title(c, "03 / Visual System", "五种阅读气质，一套设计骨架", "主题改变颜色、字体、卡片几何与视觉记忆点，而不破坏任务结构", light=True)

    # Main theme panel
    draw_image_cover(c, ASSETS["theme_panel"], M, 244, 230, 455, 14, HexColor("#CED8DD"), WHITE)
    txt(c, "真机主题选择面板", M, 224, 8, SOFT_DARK)

    right_x = 286
    txt(c, "设计系统", right_x, 674, 9, PINK, FONT_BOLD)
    txt(c, "稳定 token + 可识别主题", right_x, 646, 17, TEXT_DARK, FONT_BOLD)
    paragraph(c,
              "基础层统一页面间距、文字层级、卡片与交互状态；主题层只替换语义色、字体气质、边框和装饰母题。"
              "这样既能表达差异，也能保持跨页面一致性。",
              right_x, 617, 273, 9.2, 14.5, SOFT_DARK)

    themes = [
        ("玄夜", "暗黑 / 解码 / 夜读", ASSETS["xuanye"], CYAN),
        ("糖果绘本", "活力 / 贴纸 / 圆润", ASSETS["candy"], CORAL),
        ("樱雾少女", "柔和 / 信笺 / 留白", ASSETS["sakura"], PINK),
        ("量子蓝图", "网格 / 数据 / 冷光", ASSETS["cyber"], HexColor("#4DA6FF")),
        ("黑曜金", "藏书 / 金线 / 克制", ASSETS["noir"], GOLD),
    ]
    thumb_w, thumb_h = 84, 132
    for i, (name, desc, path, accent) in enumerate(themes):
        row, col = divmod(i, 3)
        x = right_x + col * 94
        y = 386 - row * 176
        draw_image_cover(c, path, x, y, thumb_w, thumb_h, 8, accent, WHITE)
        txt(c, name, x, y - 18, 9.2, TEXT_DARK, FONT_BOLD)
        txt(c, desc, x, y - 32, 6.8, SOFT_DARK)

    txt(c, "视觉原则", right_x, 138, 9, PINK, FONT_BOLD)
    bullet_list(c, [
        "高对比信号色只用于选中、进度与关键操作。",
        "深色主题优先保证阅读正文对比度与长时间舒适度。",
        "动效服务状态反馈，并尊重系统“减少动态效果”设置。",
    ], right_x, 112, 272, 8.2, SOFT_DARK, PINK, 4)


def screen_showcase_page(c: canvas.Canvas) -> None:
    page_bg(c, 5)
    section_title(c, "04 / Key Screens", "关键页面：清晰、可操作、可证明", "真机与高保真页面共同展示主要任务")

    # Three phone compositions
    img_y, img_h = 296, 370
    phone_w = 158
    xs = [M, M + 173, M + 346]
    paths = [ASSETS["current_phone"], ASSETS["source_library"], ASSETS["source_scan"]]
    labels = [
        ("01 书架", "继续阅读、章节进度与本地内容状态集中展示。"),
        ("02 书源", "四类入口、兼容状态、导入日志与管理工具分层呈现。"),
        ("03 扫码导入", "扫码、粘贴、预览与识别结果统一到同一任务页。"),
    ]
    for x, path, (title, body) in zip(xs, paths, labels):
        c.saveState(); c.setFillColor(hex_alpha("#58F4E8", 0.045)); c.roundRect(x - 6, img_y - 6, phone_w + 12, img_h + 12, 18, stroke=0, fill=1); c.restoreState()
        draw_image_cover(c, path, x, img_y, phone_w, img_h, 15, LINE)
        txt(c, title, x, 266, 10, CYAN, FONT_BOLD)
        paragraph(c, body, x, 248, phone_w, 7.6, 11.5, MUTED, max_lines=3)

    txt(c, "素材说明：第 1 张为 2026-07-21 HBuilderX Android 真机截图；其余为项目验收素材。", M, 82, 7.2, MUTED)


def interaction_page(c: canvas.Canvas) -> None:
    page_bg(c, 6, light=True)
    section_title(c, "05 / Interaction Detail", "把复杂能力拆成可理解的反馈", "导入、诊断、搜索与阅读中的关键交互决策", light=True)

    # Left: source import image
    draw_image_cover(c, ASSETS["source_scan"], M, 236, 226, 462, 14, HexColor("#CCD8DD"), WHITE)
    # Right cards
    x = 285
    topics = [
        ("统一入口", "链接、JSON、扫码和本地文件共用识别与预览逻辑，降低多入口维护成本。", PINK),
        ("兼容诊断", "把“规则能否解析”和“目标站能否访问”拆开，失败原因更准确。", CYAN),
        ("批量任务", "检测进度、通过/失败/不兼容逐项显示，避免长任务没有反馈。", CORAL),
        ("安全边界", "不执行第三方 JS，不绕过登录、付费或站点限制，明确合规边界。", GOLD),
    ]
    for i, (title, body, accent) in enumerate(topics):
        yy = 592 - i * 112
        rounded_rect(c, x, yy, 274, 94, 12, WHITE, HexColor("#D8E0E4"))
        c.saveState(); c.setFillColor(accent); c.rect(x, yy + 12, 4, 70, stroke=0, fill=1); c.restoreState()
        txt(c, f"0{i+1}", x + 18, yy + 66, 7.5, accent, FONT_BOLD)
        txt(c, title, x + 50, yy + 64, 11.5, TEXT_DARK, FONT_BOLD)
        paragraph(c, body, x + 18, yy + 40, 238, 8.4, 12.8, SOFT_DARK, max_lines=2)

    rounded_rect(c, x, 144, 274, 76, 12, TEXT_DARK, None)
    txt(c, "交互原则", x + 18, 194, 8.2, CYAN, FONT_BOLD)
    txt(c, "先解释发生了什么，再告诉用户可以做什么。", x + 18, 164, 11, WHITE, FONT_BOLD)


def reading_page(c: canvas.Canvas) -> None:
    page_bg(c, 7)
    section_title(c, "06 / Reading Experience", "阅读器：沉浸，但不失控制", "正文、目录、进度、缓存与个性化形成稳定阅读体验")

    x0, y0, h0 = M, 246, 425
    w1, w2, w3 = 150, 150, 192
    gap = 12
    draw_image_contain(c, ASSETS["reader"], x0, y0, w1, h0, 12, LINE, PANEL)
    draw_image_contain(c, ASSETS["reader_catalog"], x0 + w1 + gap, y0, w2, h0, 12, LINE, PANEL)
    draw_image_contain(c, ASSETS["reader_controls"], x0 + w1 + gap + w2 + gap, y0, w3, h0, 12, LINE, PANEL)

    txt(c, "沉浸正文", x0, 222, 9.5, CYAN, FONT_BOLD)
    txt(c, "目录与缓存状态", x0 + w1 + gap, 222, 9.5, GOLD, FONT_BOLD)
    txt(c, "完整阅读控制", x0 + w1 + gap + w2 + gap, 222, 9.5, CORAL, FONT_BOLD)

    cards = [
        ("阅读状态", "顶部章节信息 + 底部进度，让沉浸与定位同时成立。"),
        ("离线策略", "章节预加载、缓存上限、清理与导出覆盖弱网场景。"),
        ("AI 辅助", "章节总结、问答与历史记录从阅读上下文自然进入。"),
    ]
    cw = (W - 2 * M - 20) / 3
    for i, (title, body) in enumerate(cards):
        x = M + i * (cw + 10)
        rounded_rect(c, x, 112, cw, 86, 10, PANEL_2, LINE)
        txt(c, title, x + 14, 174, 10.5, WHITE, FONT_BOLD)
        paragraph(c, body, x + 14, 152, cw - 28, 7.8, 12, MUTED, max_lines=3)


def engineering_page(c: canvas.Canvas) -> None:
    page_bg(c, 8, light=True)
    section_title(c, "07 / Engineering Delivery", "设计不是效果图，交付才是终点", "前后端、数据库、真机与自动化测试形成可复现的工程链路", light=True)

    # Architecture flow
    arch_y = 572
    nodes = [
        (M, "移动端", "uni-app\nVue 2", PINK),
        (174, "API 层", "FastAPI\nPydantic", CYAN),
        (312, "业务层", "Service\nJWT / AI", CORAL),
        (450, "数据层", "SQLAlchemy\nAlembic", GOLD),
    ]
    for i, (x, title, body, accent) in enumerate(nodes):
        rounded_rect(c, x, arch_y, 108, 92, 12, WHITE, HexColor("#D8E0E4"))
        c.saveState(); c.setFillColor(accent); c.rect(x, arch_y + 88, 108, 4, stroke=0, fill=1); c.restoreState()
        txt(c, title, x + 14, arch_y + 60, 11, TEXT_DARK, FONT_BOLD)
        paragraph(c, body, x + 14, arch_y + 38, 82, 8.2, 12, SOFT_DARK)
        if i < len(nodes) - 1:
            line(c, x + 111, arch_y + 46, nodes[i + 1][0] - 3, arch_y + 46, HexColor("#92A1AE"), 1.2)

    # Evidence metrics
    txt(c, "可验证成果", M, 528, 9, PINK, FONT_BOLD)
    gap = 10
    mw = (W - 2 * M - gap * 3) / 4
    metric_card(c, M, 426, mw, 82, "97", "pytest 全部通过", CORAL, True)
    metric_card(c, M + mw + gap, 426, mw, 82, "65", "前端测试文件", CYAN, True)
    metric_card(c, M + 2 * (mw + gap), 426, mw, 82, "47", "API 路由", PINK, True)
    metric_card(c, M + 3 * (mw + gap), 426, mw, 82, "14", "数据模型", GOLD, True)

    left_w = 272
    rounded_rect(c, M, 170, left_w, 226, 14, WHITE, HexColor("#D8E0E4"))
    txt(c, "后端工程能力", M + 18, 366, 12, TEXT_DARK, FONT_BOLD)
    bullet_list(c, [
        "JWT 登录鉴权与用户数据隔离",
        "统一错误响应与 X-Request-ID 追踪",
        "书架、章节、阅读进度与书源解析服务",
        "AI mock / 真实 provider 切换与调用日志",
        "Alembic 迁移、SQLite / PostgreSQL 验证",
        "GitHub Actions 自动化测试与迁移检查",
    ], M + 18, 340, left_w - 36, 8.4, SOFT_DARK, PINK, 4)

    img_x = M + left_w + 18
    draw_image_cover(c, ASSETS["backend_selfcheck"], img_x, 170, W - M - img_x, 226, 12, HexColor("#CDD7DC"), WHITE)
    txt(c, "Android 真机后端健康检查与 USB 反向代理提示", img_x, 152, 7.5, SOFT_DARK)
    txt(c, "本机验证：2026-07-21", M, 132, 7.5, SOFT_DARK)


def closing_page(c: canvas.Canvas) -> None:
    page_bg(c, 9)
    txt(c, "08 / FIT & REFLECTION", M, H - 60, 8.5, CYAN, FONT_BOLD)
    txt(c, "我能为设计团队带来什么", M, H - 110, 27, WHITE, FONT_BOLD)
    paragraph(c,
              "这不是一份只展示视觉稿的作品，而是一次从问题定义、交互拆解、视觉系统到工程交付的完整实践。",
              M, H - 142, 430, 11, 18, MUTED)

    strengths = [
        ("视觉表达", "能建立设计语言并保持跨页面一致，主题差异有明确意图。", PINK),
        ("交互思维", "关注任务路径、状态反馈、错误恢复和复杂能力的渐进呈现。", CYAN),
        ("工程协作", "理解接口、数据结构、鉴权、部署与测试，能与研发高效对齐。", CORAL),
        ("项目推进", "用文档、验收清单、自动化测试和真机验证推动交付收口。", GOLD),
    ]
    for i, (title, body, accent) in enumerate(strengths):
        row, col = divmod(i, 2)
        x = M + col * 266
        y = 442 - row * 146
        rounded_rect(c, x, y, 248, 124, 13, PANEL, LINE)
        c.saveState(); c.setFillColor(accent); c.rect(x, y + 120, 248, 4, stroke=0, fill=1); c.restoreState()
        txt(c, title, x + 18, y + 86, 14, WHITE, FONT_BOLD)
        paragraph(c, body, x + 18, y + 58, 210, 9, 14, MUTED, max_lines=3)

    rounded_rect(c, M, 120, W - 2 * M, 126, 16, hex_alpha("#58F4E8", 0.075), CYAN)
    txt(c, "适配方向", M + 20, 216, 8.5, CYAN, FONT_BOLD)
    txt(c, "设计管培生 / 产品设计 / UI 设计 / 交互设计 / 设计与研发协作", M + 20, 184, 14, WHITE, FONT_BOLD)
    paragraph(c,
              "项目仓库：github.com/kimh27201-cyber/novel-reader-ai\n"
              "作品素材：真机截图、项目验收截图、代码与测试结果",
              M + 20, 158, W - 2 * M - 40, 8.2, 13, MUTED)

    txt(c, "谢谢阅读", M, 74, 18, GOLD, FONT_BOLD)
    txt(c, "DECODE THE EXPERIENCE, DELIVER THE PRODUCT.", M, 54, 7.5, MUTED, FONT_BOLD)


def build() -> Path:
    register_fonts()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    missing = [str(p) for p in ASSETS.values() if not p.exists()]
    if missing:
        raise FileNotFoundError("Missing assets:\n" + "\n".join(missing))

    c = canvas.Canvas(str(OUT_PDF), pagesize=A4, pageCompression=1)
    c.setTitle("解码阅读 - 项目作品集")
    c.setAuthor("周俊华")
    c.setSubject("移动端产品设计与全栈工程作品展示")
    c.setCreator("Codex + ReportLab")

    pages = [
        cover_page,
        overview_page,
        flow_page,
        visual_system_page,
        screen_showcase_page,
        interaction_page,
        reading_page,
        engineering_page,
        closing_page,
    ]
    for page in pages:
        page(c)
        c.showPage()
    c.save()
    return OUT_PDF


if __name__ == "__main__":
    path = build()
    print(path)
    print(path.stat().st_size)
