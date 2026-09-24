#!/usr/bin/env python3
# ruff: noqa: E501 -- embedded standalone HTML/CSS/JavaScript template
"""Read-only technical validation and preview generation for emoticon assets.

The validator never rewrites, resizes, converts, or deletes an image. Only files
inside the project's output directory are generated.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import struct
import zlib
from collections import defaultdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
IMAGE_EXTENSIONS = {".png", ".psd", ".svg", ".webp", ".jpg", ".jpeg", ".gif"}


def load_json(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, dict):
        raise ValueError(f"JSON root must be an object: {path}")
    return data


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def inspect_png(path: Path) -> dict[str, Any]:
    """Validate PNG structure/CRCs/IDAT stream and return technical metadata."""
    result: dict[str, Any] = {
        "is_png": False,
        "width": None,
        "height": None,
        "has_alpha_channel": False,
        "has_transparency": False,
        "corrupted": False,
        "corruption_reason": "",
    }
    try:
        with path.open("rb") as handle:
            if handle.read(8) != PNG_SIGNATURE:
                return result
            result["is_png"] = True
            saw_ihdr = False
            saw_iend = False
            idat_parts: list[bytes] = []
            while True:
                length_bytes = handle.read(4)
                if not length_bytes:
                    break
                if len(length_bytes) != 4:
                    raise ValueError("truncated chunk length")
                length = struct.unpack(">I", length_bytes)[0]
                chunk_type = handle.read(4)
                chunk_data = handle.read(length)
                crc_bytes = handle.read(4)
                if len(chunk_type) != 4 or len(chunk_data) != length or len(crc_bytes) != 4:
                    raise ValueError("truncated chunk")
                expected_crc = struct.unpack(">I", crc_bytes)[0]
                actual_crc = zlib.crc32(chunk_type)
                actual_crc = zlib.crc32(chunk_data, actual_crc) & 0xFFFFFFFF
                if expected_crc != actual_crc:
                    raise ValueError(f"CRC mismatch in {chunk_type.decode('ascii', 'replace')}")
                if chunk_type == b"IHDR":
                    if saw_ihdr or length != 13:
                        raise ValueError("invalid IHDR")
                    width, height, bit_depth, color_type, compression, filter_method, interlace = (
                        struct.unpack(">IIBBBBB", chunk_data)
                    )
                    if width <= 0 or height <= 0:
                        raise ValueError("invalid dimensions")
                    if compression != 0 or filter_method != 0 or interlace not in {0, 1}:
                        raise ValueError("unsupported PNG header values")
                    result.update(
                        width=width,
                        height=height,
                        bit_depth=bit_depth,
                        color_type=color_type,
                        has_alpha_channel=color_type in {4, 6},
                    )
                    saw_ihdr = True
                elif chunk_type == b"tRNS":
                    result["has_transparency"] = True
                elif chunk_type == b"IDAT":
                    idat_parts.append(chunk_data)
                elif chunk_type == b"IEND":
                    saw_iend = True
                    break
            if not saw_ihdr or not saw_iend or not idat_parts:
                raise ValueError("required PNG chunk missing")
            zlib.decompress(b"".join(idat_parts))
            result["has_transparency"] = bool(
                result["has_transparency"] or result["has_alpha_channel"]
            )
    except (OSError, ValueError, zlib.error, struct.error) as exc:
        result["corrupted"] = True
        result["corruption_reason"] = str(exc)
    return result


def inspect_file(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {
            "exists": False,
            "size_bytes": None,
            "sha256": None,
            "is_png": False,
            "width": None,
            "height": None,
            "has_alpha_channel": False,
            "has_transparency": False,
            "corrupted": False,
            "corruption_reason": "file missing",
        }
    png = inspect_png(path)
    return {
        "exists": True,
        "size_bytes": path.stat().st_size,
        "sha256": sha256_file(path),
        **png,
    }


def config_checks(item_result: dict[str, Any], config: dict[str, Any]) -> list[dict[str, str]]:
    rules = config.get("static_image", {})
    checks: list[dict[str, str]] = []

    def add(name: str, expected: Any, actual: Any, passed: bool) -> None:
        if expected is None or expected == []:
            checks.append({"name": name, "status": "skipped", "detail": "설정값 없음"})
        else:
            checks.append(
                {
                    "name": name,
                    "status": "pass" if passed else "fail",
                    "detail": f"expected={expected}, actual={actual}",
                }
            )

    add("canvas_width", rules.get("canvas_width"), item_result.get("width"),
        item_result.get("width") == rules.get("canvas_width"))
    add("canvas_height", rules.get("canvas_height"), item_result.get("height"),
        item_result.get("height") == rules.get("canvas_height"))
    maximum = rules.get("max_file_size_bytes")
    add("max_file_size_bytes", maximum, item_result.get("size_bytes"),
        bool(item_result.get("size_bytes") is not None and maximum is not None
             and item_result["size_bytes"] <= maximum))
    allowed = [str(value).upper() for value in rules.get("allowed_formats", [])]
    actual_format = "PNG" if item_result.get("is_png") else "OTHER"
    add("allowed_formats", allowed, actual_format, actual_format in allowed)
    require_alpha = rules.get("require_alpha_channel")
    add("require_alpha_channel", require_alpha, item_result.get("has_alpha_channel"),
        item_result.get("has_alpha_channel") is require_alpha)
    require_transparency = rules.get("require_transparent_background")
    add("require_transparent_background", require_transparency,
        item_result.get("has_transparency"),
        item_result.get("has_transparency") is require_transparency)
    return checks


def set_config_checks(
    set_data: dict[str, Any], item_count: int, config: dict[str, Any]
) -> list[dict[str, str]]:
    static_rules = config.get("static_image", {})
    animation_rules = config.get("animation", {})
    checks: list[dict[str, str]] = []

    def add(name: str, expected: Any, actual: Any, passed: bool) -> None:
        if expected is None:
            checks.append({"name": name, "status": "skipped", "detail": "설정값 없음"})
        else:
            checks.append(
                {
                    "name": name,
                    "status": "pass" if passed else "fail",
                    "detail": f"expected={expected}, actual={actual}",
                }
            )

    required_count = static_rules.get("required_count")
    add("required_count", required_count, item_count, item_count == required_count)
    actual_animation = bool(set_data.get("animation"))
    required_animation = animation_rules.get("required")
    add(
        "animation.required",
        required_animation,
        actual_animation,
        actual_animation is required_animation,
    )
    animation_allowed = animation_rules.get("allowed")
    add(
        "animation.allowed",
        animation_allowed,
        actual_animation,
        not actual_animation or animation_allowed is True,
    )
    return checks


def validate(project_dir: Path, manifest: dict[str, Any], config: dict[str, Any]) -> dict[str, Any]:
    filename_pattern = re.compile(manifest["project_rules"]["filename_pattern"])
    set_results: list[dict[str, Any]] = []
    all_manifest_paths: set[str] = set()

    for set_data in manifest.get("sets", []):
        items = set_data.get("items", [])
        numbers = [item.get("number") for item in items if isinstance(item.get("number"), int)]
        expected_count = set_data.get("expected_count")
        missing_numbers = (
            sorted(set(range(1, expected_count + 1)) - set(numbers))
            if isinstance(expected_count, int)
            else []
        )
        duplicate_numbers = sorted({number for number in numbers if numbers.count(number) > 1})
        item_results: list[dict[str, Any]] = []
        for item in items:
            relative = str(item["path"]).replace("\\", "/")
            all_manifest_paths.add(relative)
            path = project_dir / relative
            technical = inspect_file(path)
            filename_valid = bool(filename_pattern.fullmatch(item["filename"]))
            number_matches_filename = (
                filename_valid and int(item["filename"][:2]) == item["number"]
            )
            recorded = item.get("image", {})
            metadata_matches = bool(
                technical["exists"]
                and technical["width"] == recorded.get("width")
                and technical["height"] == recorded.get("height")
                and ("PNG" if technical["is_png"] else "OTHER")
                == str(recorded.get("format", "")).upper()
            )
            issues: list[str] = []
            if not technical["exists"]:
                issues.append("파일 없음")
            elif not technical["is_png"]:
                issues.append("PNG 아님")
            if technical["corrupted"]:
                issues.append(f"손상: {technical['corruption_reason']}")
            if not filename_valid:
                issues.append("파일명 규칙 불일치")
            if not number_matches_filename:
                issues.append("번호와 파일명 불일치")
            if not metadata_matches:
                issues.append("manifest 이미지 정보 불일치")
            configured = config_checks(technical, config)
            issues.extend(
                f"설정 불일치: {check['name']}"
                for check in configured
                if check["status"] == "fail"
            )
            item_results.append(
                {
                    "number": item["number"],
                    "path": relative,
                    "filename": item["filename"],
                    "filename_valid": filename_valid,
                    "number_matches_filename": number_matches_filename,
                    "manifest_metadata_matches": metadata_matches,
                    "technical": technical,
                    "config_checks": configured,
                    "issues": issues,
                    "technical_status": "pass" if not issues else "fail",
                }
            )
        configured_set = set_config_checks(set_data, len(items), config)
        set_results.append(
            {
                "set_id": set_data["set_id"],
                "expected_count": expected_count,
                "manifest_count": len(items),
                "missing_numbers": missing_numbers,
                "duplicate_numbers": duplicate_numbers,
                "config_checks": configured_set,
                "config_status": (
                    "fail"
                    if any(check["status"] == "fail" for check in configured_set)
                    else "pass"
                ),
                "items": item_results,
            }
        )

    scanned_assets: list[dict[str, Any]] = []
    digest_paths: dict[str, list[str]] = defaultdict(list)
    assets_dir = project_dir / "assets"
    if assets_dir.is_dir():
        for path in sorted(assets_dir.rglob("*")):
            if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS:
                relative = path.relative_to(project_dir).as_posix()
                technical = inspect_file(path)
                scanned_assets.append({"path": relative, "technical": technical})
                if technical["sha256"]:
                    digest_paths[technical["sha256"]].append(relative)
    duplicates = [
        {"sha256": digest, "paths": paths}
        for digest, paths in sorted(digest_paths.items())
        if len(paths) > 1
    ]
    unlisted_assets = sorted(
        asset["path"] for asset in scanned_assets if asset["path"] not in all_manifest_paths
    )
    failures = sum(
        item["technical_status"] == "fail"
        for set_result in set_results
        for item in set_result["items"]
    )
    failed_sets = sum(value["config_status"] == "fail" for value in set_results)
    return {
        "schema_version": 1,
        "generated_at": datetime.now(UTC).isoformat(),
        "project": manifest.get("project", {}),
        "config_verification": config.get("verification", {}),
        "summary": {
            "manifest_items": sum(len(value["items"]) for value in set_results),
            "scanned_image_files": len(scanned_assets),
            "failed_manifest_items": failures,
            "failed_set_configurations": failed_sets,
            "duplicate_groups": len(duplicates),
            "unlisted_image_files": len(unlisted_assets),
            "corrupted_files": sum(
                asset["technical"]["corrupted"] for asset in scanned_assets
            ),
        },
        "sets": set_results,
        "duplicates": duplicates,
        "unlisted_assets": unlisted_assets,
        "scanned_assets": scanned_assets,
    }


def markdown_report(report: dict[str, Any]) -> str:
    summary = report["summary"]
    lines = [
        "# 곁곰 이모티콘 자산 기술 검수",
        "",
        f"- 생성 시각(UTC): `{report['generated_at']}`",
        f"- 카카오 설정 확인 상태: `{report['config_verification'].get('status', 'unknown')}`",
        "- 이 검수는 파일을 읽기만 하며 이미지 내용이나 원본 파일을 변경하지 않는다.",
        "",
        "## 요약",
        "",
        "| 항목 | 결과 |",
        "|---|---:|",
        f"| manifest 이모티콘 | {summary['manifest_items']} |",
        f"| 탐색한 이미지 | {summary['scanned_image_files']} |",
        f"| 기술 검수 실패 항목 | {summary['failed_manifest_items']} |",
        f"| 세트 설정 불일치 | {summary['failed_set_configurations']} |",
        f"| 손상 파일 | {summary['corrupted_files']} |",
        f"| 동일 해시 중복 그룹 | {summary['duplicate_groups']} |",
        f"| manifest 세트 외 이미지 | {summary['unlisted_image_files']} |",
        "",
    ]
    if report["config_verification"].get("status") != "verified":
        lines.extend(
            [
                "> [!WARNING]",
                "> 카카오 공식 규격이 확인되지 않았다. config의 빈 조건은 검사하지 않았으므로",
                "> 이 보고서는 제출 적합 판정이 아니라 현재 파일의 기술 인벤토리다.",
                "",
            ]
        )
    for set_result in report["sets"]:
        lines.extend(
            [
                f"## 세트: {set_result['set_id']}",
                "",
                f"- 기대 개수: `{set_result['expected_count']}`",
                f"- manifest 개수: `{set_result['manifest_count']}`",
                f"- 누락 번호: `{set_result['missing_numbers'] or '없음'}`",
                f"- 중복 번호: `{set_result['duplicate_numbers'] or '없음'}`",
                f"- 외부 설정 검사: `{set_result['config_status']}`",
                "",
                "| 번호 | 파일 | 크기 | 용량 | PNG | 알파 | 투명성 | 상태 | 문제 |",
                "|---:|---|---:|---:|---|---|---|---|---|",
            ]
        )
        for item in set_result["items"]:
            technical = item["technical"]
            dimensions = (
                f"{technical['width']}×{technical['height']}"
                if technical["width"] and technical["height"]
                else "-"
            )
            issues = "<br>".join(item["issues"]) or "-"
            lines.append(
                f"| {item['number']:02d} | `{item['filename']}` | {dimensions} | "
                f"{technical['size_bytes'] or '-'} | {'예' if technical['is_png'] else '아니오'} | "
                f"{'예' if technical['has_alpha_channel'] else '아니오'} | "
                f"{'예' if technical['has_transparency'] else '아니오'} | "
                f"{item['technical_status']} | {issues} |"
            )
        lines.append("")
    lines.extend(["## 동일 파일 해시", ""])
    if report["duplicates"]:
        for duplicate in report["duplicates"]:
            lines.append(f"- `{duplicate['sha256']}`")
            lines.extend(f"  - `{path}`" for path in duplicate["paths"])
    else:
        lines.append("- 없음")
    lines.extend(["", "## 세트 외 이미지", ""])
    lines.extend(f"- `{path}`" for path in report["unlisted_assets"])
    if not report["unlisted_assets"]:
        lines.append("- 없음")
    lines.append("")
    return "\n".join(lines)


def preview_html(
    manifest: dict[str, Any], report: dict[str, Any], business: dict[str, Any]
) -> str:
    payload = json.dumps(
        {"manifest": manifest, "report": report, "business": business},
        ensure_ascii=False,
    ).replace("</", "<\\/")
    title = html.escape(manifest.get("project", {}).get("title", "이모티콘"))
    return f"""<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} 자산 미리보기</title>
<style>
.reference-alert.connected{{border-color:#91c5b5;border-left-color:var(--accent);background:#f0faf6;color:#185c4d}}.reference-alert.connected p{{color:#397467}}.reference-board{{grid-column:1/-1;width:100%;max-height:620px;margin-top:12px;border:1px solid var(--line);border-radius:8px;object-fit:contain;background:#fff}}
body .card::before{{content:'v3 생성 시안 · 소유자 확인 필요'}}
:root{{--ink:#18212f;--muted:#68778a;--surface:#fff;--canvas:#eef1f4;--line:#d7dde5;--accent:#2f7d6b;--sidebar:#17202d;--ok:#217a56;--warn:#8a5b15;--bad:#8a2e2e}}*{{box-sizing:border-box}}html{{scroll-behavior:smooth}}body{{margin:0;min-width:320px;min-height:100vh;background:var(--canvas);color:var(--ink);font:14px/1.5 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}}button,select,textarea{{font:inherit}}button{{cursor:pointer}}.app-shell{{display:grid;grid-template-columns:252px minmax(0,1fr);min-height:100vh}}.sidebar{{position:sticky;top:0;display:flex;flex-direction:column;gap:24px;height:100vh;padding:20px;color:#f4f7fb;background:var(--sidebar)}}.brand{{display:flex;align-items:center;gap:10px;min-height:44px;font-size:19px;font-weight:700}}.brand-mark{{display:grid;place-items:center;width:34px;height:34px;border-radius:8px;background:var(--accent);font-size:15px}}.side-nav{{display:grid;gap:8px}}.side-nav span{{display:flex;align-items:center;gap:10px;min-height:42px;padding:0 12px;border-radius:8px;color:#dbe5ef}}.side-nav .active{{color:#fff;background:var(--accent)}}.side-status{{display:flex;align-items:center;gap:8px;margin-top:auto;color:#b8c6d4;font-size:13px}}.side-status i{{width:9px;height:9px;border-radius:999px;background:#31b47c}}.workspace{{min-width:0;padding:28px}}header{{margin-bottom:24px}}.eyebrow{{color:#697789;font-size:12px;font-weight:700;letter-spacing:.08em}}.topbar{{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-top:4px}}h1,h2,p{{margin:0}}h1{{font-size:30px}}h2{{margin:28px 0 14px;font-size:21px}}header p{{margin-top:7px;color:var(--muted)}}.toolbar,.summary,.workflow{{display:flex;gap:10px;flex-wrap:wrap;align-items:center}}.toolbar button{{min-height:42px;border-radius:8px;padding:0 14px;font-weight:700}}#export{{border:0;color:#fff;background:var(--accent)}}#reset{{border:1px solid #cfd7e2;color:#263445;background:#fff}}.summary{{display:grid;grid-template-columns:repeat(6,minmax(120px,1fr));gap:14px}}.pill{{display:flex;flex-direction:column;gap:6px;min-height:78px;padding:14px 16px;border:1px solid var(--line);border-radius:8px;background:var(--surface);box-shadow:0 10px 24px rgba(32,42,56,.07);color:var(--muted);font-size:13px}}.pill b{{color:var(--ink);font-size:21px}}#config-note{{margin-top:12px;padding:12px 14px;border:1px solid #ead9b7;border-radius:8px;background:#fff9ed;color:var(--warn)}}.workflow{{align-items:stretch}}.set-card{{flex:1;min-width:300px;padding:18px;border:1px solid var(--line);border-radius:8px;background:var(--surface);box-shadow:0 10px 24px rgba(32,42,56,.07)}}.set-card b{{font-size:16px}}.steps{{margin:8px 0 14px;color:var(--muted);font-size:12px}}select,textarea{{width:100%;border:1px solid #cfd7e2;border-radius:8px;background:#fff;color:var(--ink)}}select{{min-height:42px;padding:0 12px}}textarea{{min-height:72px;margin-top:8px;padding:10px 12px;resize:vertical}}select:focus,textarea:focus{{border-color:var(--accent);outline:0;box-shadow:0 0 0 3px rgba(47,125,107,.14)}}.set-card select{{max-width:220px}}.set-card .muted{{margin-top:12px}}.muted{{color:var(--muted)}}.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:18px}}.card{{overflow:hidden;padding:0 14px 14px;border:1px solid var(--line);border-radius:8px;background:var(--surface);box-shadow:0 10px 24px rgba(32,42,56,.08)}}.card img{{width:calc(100% + 28px);aspect-ratio:1;object-fit:contain;margin-left:-14px;border-bottom:1px solid var(--line);background:#f7f9fb}}.meta{{display:grid;grid-template-columns:64px 1fr;gap:6px 8px;margin:14px 0}}.meta b{{color:var(--muted);font-size:12px;font-weight:700}}.status-pass{{color:var(--ok);font-weight:700}}.status-fail{{color:var(--bad);font-weight:700}}.revision{{color:var(--warn);font-weight:700}}@media(max-width:1050px){{.summary{{grid-template-columns:repeat(3,1fr)}}}}@media(max-width:760px){{.app-shell{{display:block}}.sidebar{{position:static;height:auto;padding:14px 18px}}.side-nav,.side-status{{display:none}}.workspace{{padding:20px 16px}}.topbar{{display:grid}}.summary{{grid-template-columns:repeat(2,1fr)}}}}
</style><style>.reference-alert{{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;margin:0 0 24px;padding:17px 18px;border:1px solid #e1b86d;border-left:5px solid #c58418;border-radius:8px;background:#fff8e9;color:#60400e}}.reference-alert strong{{font-size:16px}}.reference-alert p{{grid-column:2;color:#78551b}}.reference-alert code{{grid-column:2;margin-top:5px;font-size:12px;word-break:break-all}}.card::before{{content:'v4 임시 후보';display:block;margin:10px 0 8px;color:var(--warn);font-size:12px;font-weight:800}}.card img{{border-top:1px solid var(--line)}}</style></head><body><div class="app-shell"><aside class="sidebar"><div class="brand"><span class="brand-mark">J</span>Jay AI Platform</div><nav class="side-nav"><span>⌂ 홈</span><span>▥ 주식 분석</span><span class="active">☺ Content Ops</span><span>◫ 운영 현황</span></nav><div class="side-status"><i></i>로컬 자산 미리보기</div></aside><div class="workspace"><header><span class="eyebrow">CONTENT OPS / EMOTICON</span><div class="topbar"><div><h1>{title} 자산 관리</h1><p>기존 원본을 변경하지 않는 기술 검수 및 출시 준비 화면입니다.</p></div><div class="toolbar"><button id="export">검수 데이터 내보내기</button><button id="reset">로컬 변경 초기화</button></div></div></header><main><div id="reference-alert"></div><h2>기술 검수 요약</h2><div id="summary" class="summary"></div><p id="config-note" class="muted"></p><h2>세트 진행상태</h2><div id="workflow" class="workflow"></div><h2 id="asset-heading">현재 연결 자산</h2><div id="grid" class="grid"></div></main></div></div>
<script>const DATA={payload};const KEY='gyeotgom-review-v1';const local=JSON.parse(localStorage.getItem(KEY)||'{{}}');const save=()=>localStorage.setItem(KEY,JSON.stringify(local));const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}}[c]));
const sum=DATA.report.summary;document.querySelector('#summary').innerHTML=[['manifest',sum.manifest_items],['전체 이미지',sum.scanned_image_files],['항목 실패',sum.failed_manifest_items],['세트 설정 실패',sum.failed_set_configurations],['손상',sum.corrupted_files],['중복 그룹',sum.duplicate_groups]].map(x=>`<span class="pill">${{x[0]}} <b>${{x[1]}}</b></span>`).join('');document.querySelector('#config-note').textContent=DATA.report.config_verification.status==='verified'?'카카오 규격 설정 확인 완료':'카카오 공식 규격 미확인: 설정되지 않은 조건은 검사에서 건너뛰었습니다.';
const ref=DATA.manifest.project.active_character_reference,series=DATA.manifest.project.current_asset_series;if(ref?.status==='connected'){{document.querySelector('#reference-alert').innerHTML=`<section class="reference-alert connected"><span>✓</span><strong>곁곰 v3 기준 원본 연결 완료</strong><p>아래 32종은 이 기준 원본을 참조해 새로 제작한 시안입니다. 소유자 육안 검토 전에는 최종확정·제출용으로 사용하지 마세요. 기존 v4 자산은 별도로 보존·보류합니다.</p><code>${{esc(ref.expected_path)}}</code><img class="reference-board" src="../../${{esc(ref.expected_path)}}" alt="곁곰 v3 기준 디자인 보드"></section>`;}}else{{document.querySelector('#reference-alert').innerHTML=`<div class="reference-alert"><span>⚠</span><strong>기준 원본이 연결되지 않았습니다</strong><p>아래 32종은 기존 디자인이 아니라 ${{esc(series?.id||'현재')}} 임시 후보입니다. 최종확정·제출용으로 사용하지 마세요.</p><code>원본 연결 위치: ${{esc(ref?.expected_path)}}</code></div>`;}}document.querySelector('#asset-heading').textContent=series?.status==='needs_owner_visual_review'?`v3 기준 재제작 시안 32종`:'이모티콘 32종';
const stages=DATA.business.workflow;document.querySelector('#workflow').innerHTML=DATA.business.sets.map(set=>{{const st=local.sets?.[set.set_id]?.status||set.status,blocked=set.blocked_reason?`<p class="revision">보류: ${{esc(set.blocked_reason)}}</p>`:'';return `<section class="set-card"><b>${{esc(set.title)}}</b><p class="steps">${{esc(stages.join(' → '))}}</p>${{blocked}}<select data-set="${{esc(set.set_id)}}">${{stages.map(v=>`<option ${{v===st?'selected':''}}>${{esc(v)}}</option>`).join('')}}</select><p class="muted">${{esc(set.notes)}}</p></section>`}}).join('');document.querySelectorAll('[data-set]').forEach(el=>el.onchange=()=>{{local.sets=local.sets||{{}};local.sets[el.dataset.set]={{status:el.value}};save()}});
const results=new Map(DATA.report.sets.flatMap(s=>s.items.map(i=>[i.path,i])));const items=DATA.manifest.sets.flatMap(s=>s.items);document.querySelector('#grid').innerHTML=items.map(i=>{{const key=String(i.number),r=results.get(i.path),saved=local.items?.[key]||{{}},status=saved.status||i.review.status,note=saved.note??i.review.note;return `<article class="card"><img loading="lazy" src="../../${{esc(i.path)}}" alt="${{esc(i.number+' '+i.dialogue)}}"><div class="meta"><b>번호</b><span>${{String(i.number).padStart(2,'0')}}</span><b>대사</b><span>${{esc(i.dialogue)}}</span><b>감정</b><span>${{esc(i.emotion)}}</span><b>상황</b><span>${{esc(i.situation)}}</span><b>기술검수</b><span class="status-${{r?.technical_status}}">${{esc(r?.technical_status)}}</span><b>수정</b><span class="${{i.review.revision_required?'revision':''}}">${{i.review.revision_required?'확인 필요':'없음'}}</span></div><select data-item-status="${{key}}"><option ${{status==='needs_review'?'selected':''}}>needs_review</option><option ${{status==='approved'?'selected':''}}>approved</option><option ${{status==='revision_required'?'selected':''}}>revision_required</option></select><textarea data-item-note="${{key}}" placeholder="수정 메모">${{esc(note)}}</textarea></article>`}}).join('');
document.querySelectorAll('[data-item-status]').forEach(el=>el.onchange=()=>{{const k=el.dataset.itemStatus;local.items=local.items||{{}};local.items[k]={{...(local.items[k]||{{}}),status:el.value}};save()}});document.querySelectorAll('[data-item-note]').forEach(el=>el.oninput=()=>{{const k=el.dataset.itemNote;local.items=local.items||{{}};local.items[k]={{...(local.items[k]||{{}}),note:el.value}};save()}});document.querySelector('#reset').onclick=()=>{{if(confirm('브라우저에 저장된 검수 상태와 메모를 초기화할까요?')){{localStorage.removeItem(KEY);location.reload()}}}};document.querySelector('#export').onclick=()=>{{const blob=new Blob([JSON.stringify({{exported_at:new Date().toISOString(),...local}},null,2)],{{type:'application/json'}});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='gyeotgom-review-export.json';a.click();URL.revokeObjectURL(a.href)}};
</script></body></html>"""


def parse_args() -> argparse.Namespace:
    repository = Path(__file__).resolve().parents[1]
    default_project = repository / "content" / "emoticon" / "gyeotgom"
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", type=Path, default=default_project)
    parser.add_argument("--manifest", type=Path)
    parser.add_argument("--config", type=Path)
    parser.add_argument("--business-status", type=Path)
    parser.add_argument("--output", type=Path)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    project_dir = args.project.resolve()
    manifest_path = args.manifest or project_dir / "metadata" / "emoticon-manifest.json"
    config_path = args.config or project_dir / "config" / "kakao-config.json"
    business_path = args.business_status or project_dir / "metadata" / "business-status.json"
    output_dir = args.output or project_dir / "output"
    manifest = load_json(manifest_path)
    config = load_json(config_path)
    business = load_json(business_path)
    report = validate(project_dir, manifest, config)
    reports_dir = output_dir / "reports"
    preview_dir = output_dir / "preview"
    reports_dir.mkdir(parents=True, exist_ok=True)
    preview_dir.mkdir(parents=True, exist_ok=True)
    (reports_dir / "asset-validation.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (reports_dir / "asset-validation.md").write_text(
        markdown_report(report), encoding="utf-8"
    )
    (preview_dir / "index.html").write_text(
        preview_html(manifest, report, business), encoding="utf-8"
    )
    print(json.dumps(report["summary"], ensure_ascii=False))
    print(f"Report: {reports_dir / 'asset-validation.md'}")
    print(f"Preview: {preview_dir / 'index.html'}")
    return (
        1
        if report["summary"]["failed_manifest_items"]
        or report["summary"]["failed_set_configurations"]
        else 0
    )


if __name__ == "__main__":
    raise SystemExit(main())
