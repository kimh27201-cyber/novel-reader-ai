from pathlib import Path

from docx import Document
from docx.enum.text import WD_BREAK, WD_COLOR_INDEX
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt, RGBColor


ROOT = Path(__file__).resolve().parents[1]
DOCX_PATH = ROOT / "docs" / "解码阅读-V3阶段开发记录-2026-08-11.docx"
DOCX_FALLBACK_PATH = ROOT / "docs" / "DEVELOPMENT_RECORD_2026-08-11-stage3.docx"
SECTION_TITLE = "10. 书源本地优先运行时（2026-08-11 追加）"
STAGE2_SECTION_TITLE = "11. 书源运行时第二轮完善（2026-08-11）"
STAGE3_SECTION_TITLE = "12. YCK 全目录导入与 Android 大容量存储（2026-08-11）"


def set_east_asia_font(run, name="微软雅黑"):
    run.font.name = name
    properties = run._element.get_or_add_rPr()
    fonts = properties.rFonts
    if fonts is None:
        fonts = OxmlElement("w:rFonts")
        properties.insert(0, fonts)
    fonts.set(qn("w:eastAsia"), name)
    fonts.set(qn("w:ascii"), name)
    fonts.set(qn("w:hAnsi"), name)


def add_bullet(document, text):
    paragraph = document.add_paragraph(style="List Bullet")
    run = paragraph.add_run(text)
    set_east_asia_font(run)
    return paragraph


def add_number(document, text):
    paragraph = document.add_paragraph(style="List Number")
    run = paragraph.add_run(text)
    set_east_asia_font(run)
    return paragraph


def add_body(document, text, bold_prefix=""):
    paragraph = document.add_paragraph()
    if bold_prefix and text.startswith(bold_prefix):
        prefix = paragraph.add_run(bold_prefix)
        prefix.bold = True
        set_east_asia_font(prefix)
        remainder = paragraph.add_run(text[len(bold_prefix):])
        set_east_asia_font(remainder)
    else:
        run = paragraph.add_run(text)
        set_east_asia_font(run)
    return paragraph


def set_repeat_table_header(row):
    properties = row._tr.get_or_add_trPr()
    repeat = OxmlElement("w:tblHeader")
    repeat.set(qn("w:val"), "true")
    properties.append(repeat)


def style_table(table):
    table.style = "Table Grid"
    table.autofit = True
    set_repeat_table_header(table.rows[0])
    for row_index, row in enumerate(table.rows):
        for cell in row.cells:
            for paragraph in cell.paragraphs:
                for run in paragraph.runs:
                    set_east_asia_font(run)
                    run.font.size = Pt(8.5)
                    if row_index == 0:
                        run.bold = True


def save_document(document):
    try:
        document.save(DOCX_PATH)
        return DOCX_PATH
    except PermissionError:
        document.save(DOCX_FALLBACK_PATH)
        return DOCX_FALLBACK_PATH


def append_stage2_section(document):
    if any(paragraph.text.strip() == STAGE2_SECTION_TITLE for paragraph in document.paragraphs):
        return False

    document.add_page_break()
    heading = document.add_heading(STAGE2_SECTION_TITLE, level=1)
    for run in heading.runs:
        set_east_asia_font(run)

    document.add_heading("11.1 稳定失败分类与脱敏诊断", level=2)
    add_bullet(document, "新增统一 SourceRuntimeError 与 classifySourceFailure；搜索、详情、目录、正文和传输层使用稳定错误码，不再只返回笼统的请求失败。")
    add_bullet(document, "区分网络、超时、HTTP 拦截、站点失效、登录/Cookie/WebView/验证码需求、规则或解析为空、安全脚本拒绝和预算超限。")
    add_bullet(document, "健康记录增加失败阶段、HTTP 状态、可重试标记和脱敏诊断；不保存正文、Cookie、Token 或完整响应。")

    document.add_heading("11.2 高频 3.x 兼容补齐", level=2)
    add_bullet(document, "安全脚本解释器支持受控变量声明、字符串拼接、对象/数组字面量、JSON.parse/stringify 和 String()，可执行常见动态 URL + POST 请求规则。")
    add_bullet(document, "请求层仅允许 GET/POST，支持 header/body/charset；增加可取消超时、响应头 charset 识别和 GBK/GB2312 解码。")
    add_bullet(document, "规则引擎增加 JSONPath 过滤、@children 和标签链式属性，并修复嵌套同名 HTML 标签提前截断。")
    add_bullet(document, "YCK 7655 已完成动态 POST 搜索、详情、1914 章目录和正文；7628 曾完整通过，但固定复测触发验证码，按 CAPTCHA_REQUIRED 记录。")

    document.add_heading("11.3 第二轮 200 源基准", level=2)
    rows = [
        ("有效文字 JSON / 可导入", "200 / 200", "导入率 100%"),
        ("静态状态", "ready 82 / partial 30", "needs_login 10 / blocked 78"),
        ("静态完整候选", "36", "运行时外部排除 32"),
        ("运行时合格分母", "4", "完整通过 1，阅读率 25%"),
        ("引擎侧未通过", "PARSE_EMPTY 1", "SEARCH_EMPTY 2"),
    ]
    table = document.add_table(rows=1, cols=3)
    for index, value in enumerate(["指标", "结果", "说明"]):
        table.rows[0].cells[index].text = value
    for values in rows:
        cells = table.add_row().cells
        for index, value in enumerate(values):
            cells[index].text = value
    style_table(table)
    add_body(document, "外部排除：NETWORK_ERROR 12、HTTP_BLOCKED 6、SITE_UNREACHABLE 4、TIMEOUT 4、HTTP_NOT_FOUND 3、HTTP_SERVER_ERROR 2、CAPTCHA_REQUIRED 1。")
    add_body(document, "38 个失败配置审计：POST 19、请求 options 21、Cookie 16、自定义 headers 9、JS 1；公开配置下载失败 0。")
    warning = document.add_paragraph()
    warning_run = warning.add_run("验收结论：25% 仍低于 ≥80% 发布目标，PR 保持草稿，不能宣称 YCK 绝大书源已可稳定阅读。")
    warning_run.bold = True
    warning_run.font.color.rgb = RGBColor(0xC6, 0x28, 0x28)
    warning_run.font.highlight_color = WD_COLOR_INDEX.YELLOW
    set_east_asia_font(warning_run)

    document.add_heading("11.4 自动验证、产物与下一步", level=2)
    add_bullet(document, "前端全量 95 passed；后端 SQLite 125 passed；语法检查与 git diff --check 通过。")
    add_bullet(document, "H5 生产构建成功；APK release/android-v2/V2.apk 为 1,504,334 字节，SHA-256 为 B7C810ACA13F12FA8978B79B4AA06E2862723F41A47B0FA2E0AB4CE80601050E，v1/v2/v3 签名通过。")
    add_bullet(document, "本轮仍无 Android 真机；关闭电脑后端后的五入口同源导入、覆盖安装、重启续读和断网缓存仍是发布阻断项。")
    add_number(document, "继续为 PARSE_EMPTY 和 SEARCH_EMPTY 样本补齐安全规则夹具，不扩大任意脚本权限。")
    add_number(document, "在仅手机联网且关闭 8765 的 Android 真机完成完整阅读闭环并保存脱敏证据。")
    add_number(document, "扩大运行时有效分母并跨两个时间窗口复测；达到 ≥80% 且 CI 全绿后再申请合并。")
    return True


def append_stage3_section(document):
    if any(paragraph.text.strip() == STAGE3_SECTION_TITLE for paragraph in document.paragraphs):
        return False

    document.add_page_break()
    heading = document.add_heading(STAGE3_SECTION_TITLE, level=1)
    for run in heading.runs:
        set_east_asia_font(run)

    document.add_heading("12.1 全目录入口与批量下载", level=2)
    add_bullet(document, "书源市场适配 YCK 当前 keys 搜索参数和全部筛选条件，同时解析总数、页码、每页数量和总页数。")
    add_bullet(document, "每页优先调用批量 JSON 地址 /yuedu/shuyuan/jsons；漏项时自动以 4 路并发回退到单源 JSON，不因一个失效 ID 丢弃整页。")
    add_bullet(document, "全量导入显示页码、下载、缺失、新增和覆盖进度，可保存进度后停止，并按筛选条件断点续传。")
    add_bullet(document, "合法来源全部保存；仅 ready 自动启用，登录、验证码、WebView、非文字类型等受限来源默认禁用且显示原因。")

    document.add_heading("12.2 唯一身份与 Android 分块存储", level=2)
    add_bullet(document, "新书源 ID 与 sourceKey 均使用规范化名称 + 基础 URL；同站点不同名称不再互相覆盖，旧数据 ID 保持不变。")
    add_bullet(document, "同批重复 sourceKey 复用同一 ID，后一条按覆盖策略更新，最终落盘按 ID 唯一化。")
    add_bullet(document, "新增 NovelReaderSourceStorage 原生桥，将书源按 25 条分片写入应用私有文件，通过新分片 → 新清单 → 清理旧分片完成事务式切换。")
    add_bullet(document, "本地存储架构版本提升至 4；H5 默认阻止超过 500 条的一键落盘，避免 localStorage 配额造成半写入。")

    document.add_heading("12.3 YCK 5621 条全量导入基准", level=2)
    rows = [
        ("目录条目 / 下载", "5621 / 5621", "缺失 0，无效 JSON 0"),
        ("唯一安装书源", "5327", "sourceKey 重复残留 0"),
        ("新增 / 覆盖", "5327 / 294", "合计 5621"),
        ("静态状态", "ready 2537 / partial 700", "blocked 1870 / needs_login 220"),
        ("启用 / 禁用", "2356 / 2971", "仅合格且原配置允许的来源启用"),
        ("原生存储", "214 分片", "39,669,743 字节"),
    ]
    table = document.add_table(rows=1, cols=3)
    for index, value in enumerate(["指标", "结果", "说明"]):
        table.rows[0].cells[index].text = value
    for values in rows:
        cells = table.add_row().cells
        for index, value in enumerate(values):
            cells[index].text = value
    style_table(table)
    add_body(document, "脱敏报告：docs/source-acceptance/yck-full-import-stage3-2026-08-11.json；不保存正文、Cookie、Token 或完整书源 JSON。")
    warning = document.add_paragraph()
    warning_run = warning.add_run("口径说明：100% 是合法 JSON 进入导入流水线的比例，不代表全部来源可稳定阅读；完整阅读率仍未达到 ≥80% 发布门槛。")
    warning_run.bold = True
    warning_run.font.color.rgb = RGBColor(0xC6, 0x28, 0x28)
    warning_run.font.highlight_color = WD_COLOR_INDEX.YELLOW
    set_east_asia_font(warning_run)

    document.add_heading("12.4 自动验证、构建与下一步", level=2)
    add_bullet(document, "前端 Node 测试 96 passed；后端 SQLite 125 passed；H5 生产构建成功。")
    add_bullet(document, "APK release/android-v2/V2.apk 为 1,516,622 字节，SHA-256 为 B11EBB3669C8D4346639F31712F07A2D2882E19390D58904255CDB10FA7DD586，v1/v2/v3 签名通过。")
    add_bullet(document, "REA-AN00 已覆盖安装并成功启动 1.0.0 (10000)；本轮未直接在用户手机触发约 39.7 MB 的全量导入压力操作。")
    add_number(document, "继续处理 PARSE_EMPTY、SEARCH_EMPTY 和受控 WebView/请求脚本差异，提高真实阅读通过率。")
    add_number(document, "在关闭 8765 的 Android 真机完成全量导入耗时、磁盘占用、重启加载和随机阅读压力测试。")
    add_number(document, "漫画、音频、任意 Java 类、复杂动态加密、验证码绕过和付费内容继续保持明确边界。")
    return True


def main():
    document = Document(DOCX_PATH)
    if any(paragraph.text.strip() == SECTION_TITLE for paragraph in document.paragraphs):
        changed = False
        for paragraph in document.paragraphs:
            if "APK release/android-v2/V2.apk" in paragraph.text and "SHA-256" in paragraph.text:
                paragraph.text = (
                    "H5 生产构建及本地导入持久化验收通过；APK release/android-v2/V2.apk "
                    "为 1,504,334 字节，SHA-256 为 "
                    "B7C810ACA13F12FA8978B79B4AA06E2862723F41A47B0FA2E0AB4CE80601050E，"
                    "v1/v2/v3 签名通过。"
                )
                for run in paragraph.runs:
                    set_east_asia_font(run)
                changed = True
        stage2_added = append_stage2_section(document)
        stage3_added = append_stage3_section(document)
        if changed or stage2_added or stage3_added:
            saved_path = save_document(document)
            print(f"Updated: {saved_path}")
        else:
            print(f"Sections already present: {DOCX_PATH}")
        return
    else:
        document.add_page_break()
        heading = document.add_heading(SECTION_TITLE, level=1)
        for run in heading.runs:
            set_east_asia_font(run)

        document.add_heading("10.1 架构决策", level=2)
    add_bullet(document, "Android APK 采用本地优先：URL、文件、二维码、深链和 3.x JSON 在手机本地识别、预览、去重、保存与运行。")
    add_bullet(document, "新增 NovelReaderHttp 原生桥；APK 的外部书源请求固定为“原生 HTTP → 必要时 WebView 渲染”，不再默认访问 localhost:8765。")
    add_bullet(document, "后端改为可选云服务，仅承担账号同步、云书架、云 TTS、H5 跨域代理和基础来源兼容。Android 联网阅读不要求连接电脑后端。")
    add_bullet(document, "H5 无后端时只保证同源或允许 CORS 的来源；这是浏览器平台限制，不在 UI 中伪装成书源失效。")

    document.add_heading("10.2 统一导入与数据迁移", level=2)
    add_bullet(document, "新增 resolveSourceImport、previewSourceImport、applySourceImport、requestSourceText、runSourceReadingFlow 公共接口。")
    add_bullet(document, "支持对象/数组/sources 包装、BOM、JSON/TXT、剪贴板、二维码、yuedu://、legado://、booksource://、JSON URL 和 YCK 详情页。")
    add_bullet(document, "新增稳定 sourceKey（规范化名称 + 基础 URL），本地存储迁移到版本 3；旧 id 原样保留，避免书架引用断裂。")
    add_bullet(document, "合法但受限的来源保存为禁用状态；只有无效 JSON 或缺少名称/基础 URL 时拒绝。状态统一为 ready、partial、needs_login、blocked、invalid。")

    document.add_heading("10.3 Android 传输与 3.x 兼容矩阵", level=2)
    add_body(document, "NovelReaderHttp 支持 GET/POST、请求头/body、UTF-8/GBK/GB2312、Cookie 隔离、Referer、User-Agent、重定向、超时、限速、并发和响应体限制。私网、回环、file:、content: 等目标默认禁止；跨域重定向会清除 Cookie/Authorization。")
    rows = [
        ("CSS / 属性 / 索引", "支持", "支持", "基础支持", "含 text/html/href/src/textNodes/ownText"),
        ("XPath", "支持", "浏览器支持", "暂不支持", "Android WebView DOM 执行"),
        ("JSONPath / 正则", "支持", "支持", "基础支持", "含 || 回退与 && 拼接"),
        ("GET/POST/headers/charset", "支持", "受 CORS 限制", "支持", "APK 走原生桥"),
        ("目录/正文多页", "支持", "支持", "暂未扩展", "默认最多 5 页"),
        ("安全 JS 子集", "支持", "支持", "不执行", "字符串/数组/JSON/URL/Base64 + 执行预算"),
        ("任意 java.* / eval", "阻止", "阻止", "阻止", "保存为禁用，不执行"),
        ("登录/验证码/付费", "人工处理", "受限", "不绕过", "只显示限制原因"),
    ]
    table = document.add_table(rows=1, cols=5)
    for index, value in enumerate(["能力", "Android", "H5 无后端", "后端", "说明"]):
        table.rows[0].cells[index].text = value
    for values in rows:
        cells = table.add_row().cells
        for index, value in enumerate(values):
            cells[index].text = value
    style_table(table)

    document.add_heading("10.4 后端契约", level=2)
    add_bullet(document, "新增鉴权接口 POST /api/sources/import/preview，只分析书源文本，不写数据库。")
    add_bullet(document, "POST /api/sources/import 增加 source_url、import_method、duplicate_strategy，并返回 updated/skipped/unsupported 计数和逐项平台能力。")
    add_bullet(document, "不新增数据库表；沿用 raw_json、compatibility、health_status 和加密会话字段，保持用户隔离、软删除恢复与事务一致性。")

    document.add_heading("10.5 真实 YCK 基准与结论", level=2)
    add_body(document, "抓取页：1、28、56；按近期/中段/较早三层固定 200 个合法文字源。报告只保存 ID、抓取时间、SHA-256、阶段状态、耗时和错误码，不保存正文、Cookie、Token 或完整书源 JSON。")
    add_bullet(document, "有效文字 JSON 200；可导入 200；导入率 100%，达到 ≥95% 门槛。")
    add_bullet(document, "静态状态：ready 86、partial 32、needs_login 10、blocked 72。")
    add_bullet(document, "严格合格候选 38；桌面真实完整流程 0/38：SEARCH_FAILED 30、SEARCH_EMPTY 6、TIMEOUT 2。")
    add_bullet(document, "代表源 7163、7298 单独探测均完成搜索、详情、目录和正文，目录分别为 1663、999 章。")
    warning = document.add_paragraph()
    warning_run = warning.add_run("验收结论：随机基准的 ≥80% 完整阅读目标未通过，当前版本不能宣称“绝大书源可读”。")
    warning_run.bold = True
    warning_run.font.color.rgb = RGBColor(0xC6, 0x28, 0x28)
    warning_run.font.highlight_color = WD_COLOR_INDEX.YELLOW
    set_east_asia_font(warning_run)

    document.add_heading("10.6 验证证据与发布阻断项", level=2)
    add_bullet(document, "前端 92 个 *.test.mjs 文件执行；后端 SQLite 全量 125 passed；PostgreSQL 16 由 GitHub Actions 继续验证。")
    add_bullet(document, "H5 生产构建及本地导入持久化验收通过；APK release/android-v2/V2.apk 为 1,496,142 字节，SHA-256 为 11D11EC281FBCF93D43B3B9A34C9900365238CAB93A523E92ABECBF8CBF39BCD，v1/v2/v3 签名通过。")
    add_bullet(document, "本轮没有可用 Android 真机/ADB 设备；关闭 8765 后扫码导入、覆盖安装、重启续读、断网缓存和内置摄像头扫码仍是发布阻断项。")
    add_number(document, "以 SEARCH_FAILED 样本补齐高频 3.x 请求脚本和受控宿主 API 映射，每次只扩展白名单能力。")
    add_number(document, "进一步区分站点失效、规则不支持、网络超时与无关键词结果；完整阅读率达到 ≥80% 前不合并正式发布。")
    add_number(document, "在无电脑后端的 Android 真机完成 URL、文件、二维码、深链同源去重和完整阅读闭环，并保存录屏与 APK 哈希。")

    append_stage2_section(document)
    append_stage3_section(document)
    saved_path = save_document(document)
    print(f"Updated: {saved_path}")


if __name__ == "__main__":
    main()
