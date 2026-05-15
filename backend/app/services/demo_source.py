import json


DEMO_BOOK_SLUG = "star-library"


def build_demo_source(base_url: str) -> dict:
    base = str(base_url or "http://127.0.0.1:8000").rstrip("/")
    return {
        "bookSourceName": "本地演示书源",
        "bookSourceUrl": base,
        "bookSourceGroup": "本地演示",
        "searchUrl": f"{base}/demo-source/search?q={{{{key}}}}&page={{{{page}}}}",
        "ruleSearch": {
            "bookList": ".result-list li",
            "name": "h3 a@text",
            "author": ".author@text",
            "bookUrl": "h3 a@href",
            "kind": ".kind@text",
            "latestChapter": ".latest@text",
            "intro": ".intro@text",
        },
        "ruleToc": {
            "chapterList": ".chapter-list a",
            "chapterName": "@text",
            "chapterUrl": "@href",
        },
        "ruleContent": {
            "content": "#content@text",
        },
    }


def build_demo_source_content(base_url: str) -> str:
    return json.dumps(build_demo_source(base_url), ensure_ascii=False)
