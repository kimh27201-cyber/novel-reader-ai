from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse

from app.services.demo_source import DEMO_BOOK_SLUG, build_demo_source, build_demo_source_content


router = APIRouter(tags=["demo"])


@router.get("/api/demo/source-json")
def read_demo_source_json(request: Request) -> dict[str, object]:
    base_url = str(request.base_url).rstrip("/")
    return {
        "source": build_demo_source(base_url),
        "content": build_demo_source_content(base_url),
    }


@router.get("/demo-source/search", response_class=HTMLResponse)
def demo_search(q: str = "", page: int = 1) -> str:
    keyword = q.strip() or "星轨"
    return f"""
    <!doctype html>
    <html lang="zh-CN">
      <head><meta charset="utf-8"><title>本地演示搜索</title></head>
      <body>
        <h1>搜索：{keyword}</h1>
        <p class="page">第 {page} 页</p>
        <ul class="result-list">
          <li>
            <h3><a href="/demo-source/books/{DEMO_BOOK_SLUG}/catalog">星轨图书馆</a></h3>
            <span class="author">示例作者</span>
            <span class="kind">轻科幻</span>
            <span class="latest">第二章 梦的索引</span>
            <p class="intro">一座会在凌晨穿过城市上空的图书馆，保存着人类忘记的梦。</p>
          </li>
          <li>
            <h3><a href="/demo-source/books/old-city/catalog">风停在旧城</a></h3>
            <span class="author">另一位作者</span>
            <span class="kind">都市悬疑</span>
            <span class="latest">第一章 消失的站台</span>
            <p class="intro">旧城车站每到雨夜就会多出一班没有终点的列车。</p>
          </li>
        </ul>
      </body>
    </html>
    """


@router.get("/demo-source/books/{book_slug}/catalog", response_class=HTMLResponse)
def demo_catalog(book_slug: str) -> str:
    title = "星轨图书馆" if book_slug == DEMO_BOOK_SLUG else "风停在旧城"
    return f"""
    <!doctype html>
    <html lang="zh-CN">
      <head><meta charset="utf-8"><title>{title}目录</title></head>
      <body>
        <h1>{title}</h1>
        <div class="chapter-list">
          <a href="/demo-source/books/{book_slug}/chapters/1">第一章 失重借阅证</a>
          <a href="/demo-source/books/{book_slug}/chapters/2">第二章 梦的索引</a>
          <a href="/demo-source/books/{book_slug}/chapters/3">第三章 倒放的雨</a>
        </div>
      </body>
    </html>
    """


@router.get("/demo-source/books/{book_slug}/chapters/{chapter_no}", response_class=HTMLResponse)
def demo_chapter(book_slug: str, chapter_no: int) -> str:
    title = {
        1: "第一章 失重借阅证",
        2: "第二章 梦的索引",
        3: "第三章 倒放的雨",
    }.get(chapter_no, "番外 迷路的书签")
    return f"""
    <!doctype html>
    <html lang="zh-CN">
      <head><meta charset="utf-8"><title>{title}</title></head>
      <body>
        <article id="content">
          <h1>{title}</h1>
          <p>凌晨四点，星轨图书馆经过城市上空，玻璃穹顶映出一整片缓慢移动的星海。</p>
          <p>安禾第一次看见它时，以为那只是一颗移动得过慢的星星，直到借阅证从窗缝里飘进来。</p>
          <p>借阅证背面写着一句话：请在日出前归还你遗忘的梦。</p>
        </article>
      </body>
    </html>
    """
