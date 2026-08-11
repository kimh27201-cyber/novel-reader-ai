import json
import logging
import time
from typing import Any
from uuid import uuid4

from fastapi import HTTPException, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response


REQUEST_ID_HEADER = "X-Request-ID"
logger = logging.getLogger("novel_reader.requests")


ERROR_CODES = {
    400: "bad_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    409: "conflict",
    422: "validation_error",
    500: "internal_server_error",
    502: "bad_gateway",
    504: "gateway_timeout",
}


def normalize_request_id(value: str | None) -> str:
    request_id = str(value or "").strip()
    if not request_id or len(request_id) > 128:
        return uuid4().hex
    return request_id


def get_request_id(request: Request) -> str:
    request_id = getattr(request.state, "request_id", None)
    if request_id:
        return request_id
    request_id = normalize_request_id(request.headers.get(REQUEST_ID_HEADER))
    request.state.request_id = request_id
    return request_id


def error_code_for_status(status_code: int) -> str:
    return ERROR_CODES.get(status_code, "request_error" if status_code < 500 else "internal_server_error")


def detail_to_message(detail: Any, fallback: str) -> str:
    if isinstance(detail, str) and detail:
        return detail
    if isinstance(detail, dict) and isinstance(detail.get("message"), str):
        return detail["message"]
    return fallback


def build_error_body(
    *,
    status_code: int,
    message: str,
    request_id: str,
    detail: Any = None,
    fields: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    error: dict[str, Any] = {
        "code": error_code_for_status(status_code),
        "message": message,
        "request_id": request_id,
    }
    if fields is not None:
        error["fields"] = fields

    body: dict[str, Any] = {"error": error}
    if detail is not None:
        body["detail"] = detail
    return jsonable_encoder(body)


def error_response(
    *,
    request: Request,
    status_code: int,
    message: str,
    detail: Any = None,
    fields: list[dict[str, Any]] | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    request_id = get_request_id(request)
    response_headers = dict(headers or {})
    response_headers[REQUEST_ID_HEADER] = request_id
    return JSONResponse(
        status_code=status_code,
        content=build_error_body(
            status_code=status_code,
            message=message,
            request_id=request_id,
            detail=detail,
            fields=fields,
        ),
        headers=response_headers,
    )


async def request_observability_middleware(request: Request, call_next) -> Response:
    request_id = get_request_id(request)
    started_at = time.perf_counter()
    status_code = 500

    try:
        response = await call_next(request)
        status_code = response.status_code
        response.headers[REQUEST_ID_HEADER] = request_id
        return response
    except Exception:
        status_code = 500
        logger.exception(
            json.dumps(
                {
                    "event": "request_failed",
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "user_id": getattr(request.state, "user_id", None),
                },
                ensure_ascii=False,
            )
        )
        return error_response(
            request=request,
            status_code=500,
            message="Internal server error",
            detail="Internal server error",
        )
    finally:
        duration_ms = round((time.perf_counter() - started_at) * 1000, 2)
        logger.info(
            json.dumps(
                {
                    "event": "request_completed",
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "user_id": getattr(request.state, "user_id", None),
                    "status_code": status_code,
                    "duration_ms": duration_ms,
                },
                ensure_ascii=False,
            )
        )


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    message = detail_to_message(exc.detail, "Request failed")
    return error_response(
        request=request,
        status_code=exc.status_code,
        message=message,
        detail=exc.detail,
        headers=exc.headers,
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    fields = jsonable_encoder(exc.errors())
    logger.warning(
        json.dumps(
            {
                "event": "request_validation_failed",
                "request_id": get_request_id(request),
                "method": request.method,
                "path": request.url.path,
                "fields": [
                    {
                        "type": field.get("type"),
                        "loc": field.get("loc"),
                    }
                    for field in fields
                ],
            },
            ensure_ascii=False,
        )
    )
    return error_response(
        request=request,
        status_code=422,
        message="Request validation failed",
        detail=fields,
        fields=fields,
    )
