#!/usr/bin/env python3
"""
Multi-PDF Dataset Builder for ปกครอง Diary (Admin Law Exam Prep WebApp).
Automatically scans all PDF files in the workspace, normalizes legacy Thai
PUA font encodings (U+F700..U+F71F from TH SarabunPSK / Angsana / Cordia)
into standard Unicode Thai, parses the 2-Part 39-Chapter Table of Contents,
and extracts all Supreme Administrative Court judgments/orders from every
PDF volume into their corresponding TOC categories without duplication.
"""
import fitz
import glob
import json
import os
import re

THAI_DIGITS = str.maketrans("๐๑๒๓๔๕๖๗๘๙", "0123456789")
ARABIC_TO_THAI = str.maketrans("0123456789", "๐๑๒๓๔๕๖๗๘๙")

# Legacy Windows/Mac Thai PUA glyph mapping (TH SarabunPSK, AngsanaUPC, CordiaUPC)
THAI_PUA_MAP = str.maketrans({
    "\uf700": "\u0e10",  # ฐ (tailless)
    "\uf701": "\u0e34",  # ิ (shifted left)
    "\uf702": "\u0e35",  # ี (shifted left)
    "\uf703": "\u0e36",  # ึ (shifted left)
    "\uf704": "\u0e37",  # ื (shifted left)
    "\uf705": "\u0e48",  # ่ (low-left)
    "\uf706": "\u0e49",  # ้ (low-left)
    "\uf707": "\u0e4a",  # ๊ (low-left)
    "\uf708": "\u0e4b",  # ๋ (low-left)
    "\uf709": "\u0e4c",  # ์ (low-left)
    "\uf70a": "\u0e48",  # ่ (low)
    "\uf70b": "\u0e49",  # ้ (low)
    "\uf70c": "\u0e4a",  # ๊ (low)
    "\uf70d": "\u0e4b",  # ๋ (low)
    "\uf70e": "\u0e4c",  # ์ (low)
    "\uf70f": "\u0e0d",  # ญ (tailless)
    "\uf710": "\u0e31",  # ั (shifted left)
    "\uf711": "\u0e4d",  # ํ (nikhahit shifted left)
    "\uf712": "\u0e47",  # ็ (shifted left)
    "\uf713": "\u0e48",  # ่ (high-left)
    "\uf714": "\u0e49",  # ้ (high-left)
    "\uf715": "\u0e4a",  # ๊ (high-left)
    "\uf716": "\u0e4b",  # ๋ (high-left)
    "\uf717": "\u0e4c",  # ์ (high-left)
    "\uf718": "\u0e38",  # ุ (low)
    "\uf719": "\u0e39",  # ู (low)
    "\uf71a": "\u0e3a",  # ฺ (low)
    "\uf71d": "\u0e2c",  # ฬ
})

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def clean_thai(s):
    """Normalize Thai PUA glyphs and decomposed Sara Am into clean standard Unicode."""
    if not s:
        return ""
    s = s.translate(THAI_PUA_MAP)
    s = re.sub(r"([\u0e48-\u0e4b])\u0e4d\u0e32", "\\1\u0e33", s)
    s = re.sub(r"\u0e4d([\u0e48-\u0e4b])\u0e32", "\\1\u0e33", s)
    s = re.sub(r"\u0e4d\u0e32", "\u0e33", s)
    return s


def to_int(s):
    return int(clean_thai(s).translate(THAI_DIGITS))


def to_arabic(s):
    return clean_thai(s).translate(THAI_DIGITS)


def normalize_spaces(s):
    return re.sub(r"\s+", "", clean_thai(s or ""))


CHAPTER_ICONS = {
    "part-1-ch-1": "landmark",
    "part-1-ch-2": "building-2",
    "part-1-ch-3": "scale",
    "part-1-ch-4": "file-check-2",
    "part-1-ch-5": "gavel",
    "part-2-ch-1": "book-open-check",
    "part-2-ch-2": "trees",
    "part-2-ch-3": "shield-check",
    "part-2-ch-4": "building",
    "part-2-ch-5": "radio",
    "part-2-ch-6": "factory",
    "part-2-ch-7": "trending-up",
    "part-2-ch-8": "briefcase",
    "part-2-ch-9": "zap",
    "part-2-ch-10": "heart-pulse",
    "part-2-ch-11": "store",
    "part-2-ch-12": "train-front",
    "part-2-ch-13": "map-pin",
    "part-2-ch-14": "home",
    "part-2-ch-15": "vote",
    "part-2-ch-16": "file-badge",
    "part-2-ch-17": "alert-triangle",
    "part-2-ch-18": "coins",
    "part-2-ch-19": "package-check",
    "part-2-ch-20": "file-signature",
    "part-2-ch-21": "handshake",
    "part-2-ch-22": "award",
    "part-2-ch-23": "shield-alert",
    "part-2-ch-24": "lock",
    "part-2-ch-25": "graduation-cap",
    "part-2-ch-26": "school",
    "part-2-ch-27": "eye",
    "part-2-ch-28": "receipt",
    "part-2-ch-29": "hard-hat",
    "part-2-ch-30": "compass",
    "part-2-ch-31": "users",
    "part-2-ch-32": "user-x",
    "part-2-ch-33": "gift",
    "part-2-ch-34": "wallet"
}

BANNER_LINES = {
    "ระบบงานคดีปกครองอิเล็กทรอนิกส์",
    "ยื่นฟ้องออนไลน์ สะดวก รวดเร็ว เป็นธรรม",
    "https://bit.ly/3sBQbvO",
    "สายด่วนศาลปกครอง ๑๓๕๕",
}


def get_page_rich_lines(doc, p_num):
    """Extract lines from PDF page p_num (1-indexed) with (p_num, text, is_bold, x0)."""
    d = doc[p_num - 1].get_text("dict")
    out = []
    for b in d.get("blocks", []):
        if "lines" not in b:
            continue
        for l in b["lines"]:
            # Filter out small footnote & superscript spans (< 13.0pt)
            valid_spans = [s for s in l["spans"] if s["text"].strip() and s["size"] >= 13.0]
            if not valid_spans:
                continue
            max_sz = max(s["size"] for s in valid_spans)
            if max_sz < 13.5:
                continue
            txt = clean_thai("".join(s["text"] for s in l["spans"] if s["size"] >= 13.0)).strip()
            if not txt:
                continue
            if re.match(r"^([๐-๙]+\s+แนวคำวินิจฉัยของศาลปกครอง|แนวคำวินิจฉัยของศาลปกครอง\s+[๐-๙]+)$", txt):
                continue
            if txt in BANNER_LINES:
                continue
            x0 = round(l["bbox"][0], 1)
            bold_chars = sum(len(s["text"].strip()) for s in valid_spans if "Bold" in s["font"] or (s["flags"] & 16))
            total_chars = sum(len(s["text"].strip()) for s in valid_spans)
            is_bold = (bold_chars / max(1, total_chars)) > 0.5
            out.append((p_num, txt, is_bold, x0))
    return out


def join_lines_smart(lines_tuples):
    if not lines_tuples:
        return ""
    paras = []
    cur = []
    for idx, (p_num, txt, is_bold, x0) in enumerate(lines_tuples):
        s = clean_thai(txt).strip()
        if not s:
            continue
        if idx > 0 and x0 > 128.0 and cur:
            paras.append("".join(cur))
            cur = [s]
            continue
        if cur:
            prev = cur[-1]
            if prev.endswith(("ๆ", "ฯ", ")", "”", "\"")) or s.startswith(("(", "“", "ดังนั้น", "ทั้งนี้", "อีกทั้ง", "แต่", "โดย", "ซึ่ง", "อันเป็น", "ด้วยเหตุนี้", "จึง")):
                cur.append(" " + s)
            elif re.search(r"[๐-๙a-zA-Z]$", prev) and re.match(r"^[๐-๙a-zA-Z]", s):
                cur.append(" " + s)
            else:
                cur.append(s)
        else:
            cur.append(s)
    if cur:
        paras.append("".join(cur))
    return "\n\n".join(re.sub(r"\s{2,}", " ", p).strip() for p in paras if p.strip())


def make_short_citation(cite_clean, is_order):
    m = re.search(r"สูงสุด\s*ที่\s*(.+)$", cite_clean)
    rest = m.group(1).strip() if m else cite_clean
    rest_short = re.sub(r"\s*วินิจฉัยแนวทางเดียวกัน.*$", "", rest).strip()
    if is_order and not rest_short.startswith("คส."):
        return f"คส. {rest_short}"
    return rest_short


def extract_laws(body_text):
    flat = re.sub(r"\s+", " ", clean_thai(body_text))
    laws = []
    patterns = [
        r"มาตรา\s*[๐-๙]+(?:\s*วรรค[ก-๙]+)?(?:\s*\([๐-๙]+\))?\s*แห่งพระราชบัญญัติ[^\s,()]{4,45}",
        r"พระราชบัญญัติ[^\s,()]{4,50}\s*พ\.ศ\.\s*[๐-๙]{4}",
        r"พระราชกฤษฎีกา[^\s,()]{4,50}\s*พ\.ศ\.\s*[๐-๙]{4}",
        r"ข้อ\s*[๐-๙]+(?:\s*วรรค[ก-๙]+)?\s*แห่งระเบียบ[^\s,()]{4,45}",
        r"มาตรา\s*[๐-๙]+(?:\s*วรรค[ก-๙]+)?(?:\s*\([๐-๙]+\))?\s*แห่งประมวลกฎหมาย[^\s,()]{4,35}"
    ]
    for pat in patterns:
        for m in re.findall(pat, flat):
            m_clean = m.strip()
            if m_clean not in laws and len(laws) < 6:
                laws.append(m_clean)
    return laws


def parse_pdf_toc_and_chapters(doc):
    """
    Find TOC pages and chapter page ranges in any volume of แนวคำวินิจฉัยของศาลปกครอง
    by scanning actual page text (works whether or not PDF bookmarks exist).
    """
    toc_start_page = None
    toc_end_page = 34
    part2_cover_page = None
    appendix_page = len(doc)

    # First pass: locate TOC start, Part 1 cover, Part 2 cover, and Appendix cover
    for p in range(1, len(doc) + 1):
        txt = clean_thai(doc[p - 1].get_text("text"))
        lines = [
            l.strip()
            for l in txt.splitlines()
            if l.strip()
            and l.strip() not in BANNER_LINES
            and not re.match(r"^([๐-๙]+\s+แนวคำวินิจฉัยของศาลปกครอง|แนวคำวินิจฉัยของศาลปกครอง\s+[๐-๙]+)$", l.strip())
        ]
        if p <= 15 and (any(re.match(r"^ภาค\s*[๑1]", l) for l in lines) or any("สารบัญ" in l for l in lines)):
            if toc_start_page is None:
                toc_start_page = p
        elif 15 < p < 60 and lines == ["ภาค ๑", "ภาคทั่วไป"]:
            toc_end_page = p - 1
        elif p > 100 and lines == ["ภาค ๒", "แนวคำวินิจฉัยของศาลปกครองเฉพาะเรื่อง"]:
            part2_cover_page = p
        elif p > 200 and lines and lines[0] == "ภาคผนวก" and len(lines) <= 3:
            appendix_page = p - 1
            break

    if toc_start_page is None:
        toc_start_page = 6

    # Second pass: find every chapter start page in the body after toc_end_page
    ch_start_pages = []
    for p in range(toc_end_page + 1, appendix_page + 1):
        txt = clean_thai(doc[p - 1].get_text("text"))
        lines = [
            l.strip()
            for l in txt.splitlines()
            if l.strip()
            and l.strip() not in BANNER_LINES
            and not re.match(r"^([๐-๙]+\s+แนวคำวินิจฉัยของศาลปกครอง|แนวคำวินิจฉัยของศาลปกครอง\s+[๐-๙]+)$", l.strip())
        ]
        if lines and re.match(r"^บทที่\s*[๐-๙0-9]+$", lines[0]):
            ch_start_pages.append(p)

    # Parse TOC lines from toc_start_page .. toc_end_page
    raw_lines = []
    for p in range(toc_start_page - 1, toc_end_page):
        text = clean_thai(doc[p].get_text("text"))
        for ln in text.splitlines():
            s = ln.strip()
            if not s or s == "สารบัญ" or s == "หน้า" or s in BANNER_LINES:
                continue
            if re.match(r"^([๐-๙]+\s+แนวคำวินิจฉัยของศาลปกครอง|แนวคำวินิจฉัยของศาลปกครอง\s+[๐-๙]+)$", s):
                continue
            raw_lines.append(s)

    entries = []
    buf = []
    i = 0
    while i < len(raw_lines):
        s = raw_lines[i]
        if re.match(r"^ภาค\s+[๑๒12]$", s):
            part_name = s + " " + (raw_lines[i + 1] if i + 1 < len(raw_lines) else "")
            entries.append(("PART", part_name.strip(), None))
            buf = []
            i += 2
            continue
        if re.match(r"^[๐-๙]+$", s):
            title = " ".join(buf).strip()
            title = re.sub(r"\s+", " ", title)
            if title:
                entries.append(("ITEM", title, to_int(s)))
            buf = []
        else:
            buf.append(s)
        i += 1

    toc_parts = []
    cur_part = None
    cur_ch = None
    ch_counter = 0

    for etype, title, book_page in entries:
        if etype == "PART":
            part_id = "part-1" if ("๑" in title or "1" in title) else "part-2"
            cur_part = {
                "id": part_id,
                "code": "ภาค ๑" if part_id == "part-1" else "ภาค ๒",
                "title": title,
                "short_title": "ภาคทั่วไป" if part_id == "part-1" else "ภาคเฉพาะเรื่อง",
                "subtitle": "โครงสร้าง อำนาจศาล เงื่อนไขการฟ้องคดี และวิธีพิจารณาคดีปกครอง" if part_id == "part-1" else "แนวคำวินิจฉัยของศาลปกครองสูงสุดจำแนกตามประเภทคดีเฉพาะเรื่อง ๓๔ บท",
                "chapters": []
            }
            toc_parts.append(cur_part)
        elif etype == "ITEM" and cur_part is not None:
            if title.startswith("บทที่"):
                m = re.match(r"^(บทที่\s*[๐-๙0-9]+)\s*(.*)$", title)
                ch_code = m.group(1).strip() if m else title
                ch_name = m.group(2).strip() if m else title
                ch_num = to_int(re.search(r"[๐-๙0-9]+", ch_code).group(0))
                pid = cur_part["id"]
                ch_id = f"{pid}-ch-{ch_num}"
                pdf_start = ch_start_pages[ch_counter] if ch_counter < len(ch_start_pages) else book_page
                if ch_counter + 1 < len(ch_start_pages):
                    nxt_p = ch_start_pages[ch_counter + 1]
                    pdf_end = (part2_cover_page - 1) if (part2_cover_page and pdf_start < part2_cover_page <= nxt_p) else (nxt_p - 1)
                else:
                    pdf_end = appendix_page
                ch_counter += 1
                cur_ch = {
                    "id": ch_id,
                    "part_id": pid,
                    "part_code": cur_part["code"],
                    "part_title": cur_part["title"],
                    "code": ch_code,
                    "code_arabic": f"บทที่ {ch_num}",
                    "number": ch_num,
                    "title": ch_name,
                    "full_title": title,
                    "icon": CHAPTER_ICONS.get(ch_id, "book-open"),
                    "book_page": book_page,
                    "pdf_start": pdf_start,
                    "pdf_end": pdf_end,
                    "ruling_count": 0,
                    "sections": []
                }
                cur_part["chapters"].append(cur_ch)
            elif cur_ch is not None:
                m = re.match(r"^(\([ก-ฮ]\)|\([๐-๙]+\)|[๐-๙]+\)|[๐-๙]+(?:\.[๐-๙]+)*\.?)\s+(.*)$", title)
                if m:
                    sec_code = m.group(1)
                    sec_name = m.group(2)
                    if re.match(r"^\([ก-ฮ]\)$", sec_code):
                        level = 6
                    elif re.match(r"^\([๐-๙]+\)$", sec_code):
                        level = 5
                    elif sec_code.endswith(")"):
                        level = 4
                    elif sec_code.endswith("."):
                        level = 1
                    else:
                        level = sec_code.count(".") + 1
                else:
                    sec_code = ""
                    sec_name = title
                    level = 5
                cid = cur_ch["id"]
                sidx = len(cur_ch["sections"]) + 1
                sec_id = f"{cid}-sec-{sidx}"

                path = []
                cur_lvl = level
                for prev in reversed(cur_ch["sections"]):
                    if prev["level"] < cur_lvl:
                        path.insert(0, prev["full_title"])
                        cur_lvl = prev["level"]
                path.append(title)

                cur_ch["sections"].append({
                    "id": sec_id,
                    "chapter_id": cid,
                    "part_id": cur_ch["part_id"],
                    "code": sec_code,
                    "title": sec_name,
                    "full_title": title,
                    "level": level,
                    "book_page": book_page,
                    "path": path,
                    "ruling_count": 0
                })
    return toc_parts


def resolve_canonical_section(canon_ch, pdf_sec):
    """Map a section from any PDF volume onto the canonical chapter's sections."""
    if not canon_ch or not pdf_sec:
        return pdf_sec
    norm_full = normalize_spaces(pdf_sec["full_title"])
    for csec in canon_ch["sections"]:
        if normalize_spaces(csec["full_title"]) == norm_full:
            return csec
    if pdf_sec["code"]:
        for csec in canon_ch["sections"]:
            if csec["code"] == pdf_sec["code"] and normalize_spaces(csec["title"])[:20] == normalize_spaces(pdf_sec["title"])[:20]:
                return csec
    # If this volume has a new sub-section not in canonical TOC, add it to canonical chapter
    new_idx = len(canon_ch["sections"]) + 1
    new_sec = {
        "id": f"{canon_ch['id']}-sec-{new_idx}",
        "chapter_id": canon_ch["id"],
        "part_id": canon_ch["part_id"],
        "code": pdf_sec["code"],
        "title": pdf_sec["title"],
        "full_title": pdf_sec["full_title"],
        "level": pdf_sec["level"],
        "book_page": pdf_sec["book_page"],
        "path": pdf_sec["path"],
        "ruling_count": 0,
    }
    canon_ch["sections"].append(new_sec)
    return new_sec


def extract_rulings_from_pdf(pdf_path, canonical_toc, existing_sigs, start_seq):
    doc = fitz.open(pdf_path)
    pdf_filename = os.path.basename(pdf_path)
    pdf_toc = parse_pdf_toc_and_chapters(doc)
    if not pdf_toc:
        return [], start_seq

    canon_ch_map = {}
    for p in canonical_toc:
        for c in p["chapters"]:
            canon_ch_map[c["id"]] = c

    extracted = []
    ruling_seq = start_seq

    # Extract Ch1 Sec1 structural note if not already added
    ch1 = pdf_toc[0]["chapters"][0] if pdf_toc and pdf_toc[0]["chapters"] else None
    if ch1 and ch1["sections"]:
        ch1_rich = []
        for p_num in range(ch1["pdf_start"], ch1["pdf_end"] + 1):
            ch1_rich.extend(get_page_rich_lines(doc, p_num))
        sec1_lines = []
        in_sec1 = False
        for item in ch1_rich:
            if item[1].startswith("๑. โครงสร้างของศาลปกครอง"):
                in_sec1 = True
                continue
            if item[1].startswith("๒. อำนาจหน้าที่ของศาลปกครอง"):
                break
            if in_sec1:
                sec1_lines.append(item)
        ch1_sec1_text = join_lines_smart(sec1_lines)
        if ch1_sec1_text and "ยังไม่มีข้อมูลเพิ่มเติม" not in ch1_sec1_text:
            sig = "ch1-sec1-structure"
            if sig not in existing_sigs:
                existing_sigs.add(sig)
                canon_ch1 = canon_ch_map.get("part-1-ch-1", ch1)
                canon_sec1 = canon_ch1["sections"][0]
                extracted.append({
                    "id": f"ruling-{ruling_seq:04d}",
                    "seq": ruling_seq,
                    "source_vol": "",
                    "pdf_file": pdf_filename,
                    "part_id": "part-1",
                    "part_code": "ภาค ๑",
                    "part_title": "ภาค ๑ ภาคทั่วไป",
                    "chapter_id": canon_ch1["id"],
                    "chapter_code": canon_ch1["code"],
                    "chapter_title": canon_ch1["title"],
                    "section_id": canon_sec1["id"],
                    "section_code": canon_sec1["code"],
                    "section_title": canon_sec1["title"],
                    "section_full_title": canon_sec1["full_title"],
                    "section_path": canon_sec1["path"],
                    "ruling_type": "หลักการ/โครงสร้าง",
                    "citation": "โครงสร้างและเขตอำนาจศาลปกครอง",
                    "short_citation": "โครงสร้างศาลปกครอง",
                    "citation_arabic": "โครงสร้างและเขตอำนาจศาลปกครอง",
                    "year": "๒๕๖๘",
                    "is_general_assembly": False,
                    "title": "การเปิดทำการและเขตอำนาจของศาลปกครองในภูมิภาค",
                    "principle": "โครงสร้างและเขตอำนาจของศาลปกครองในภูมิภาคครอบคลุมพื้นที่ทั่วประเทศ",
                    "facts": ch1_sec1_text,
                    "content": ch1_sec1_text,
                    "laws": ["พระราชบัญญัติจัดตั้งศาลปกครองและวิธีพิจารณาคดีปกครอง พ.ศ. ๒๕๔๒"],
                    "book_page": canon_sec1["book_page"],
                    "pdf_page": ch1["pdf_start"],
                    "is_custom": False
                })
                ruling_seq += 1

    # Extract all rulings chapter by chapter
    for part in pdf_toc:
        for ch in part["chapters"]:
            canon_ch = canon_ch_map.get(ch["id"], ch)
            rich_lines = []
            for p_num in range(ch["pdf_start"], ch["pdf_end"] + 1):
                rich_lines.extend(get_page_rich_lines(doc, p_num))

            if len(rich_lines) >= 2 and re.match(r"^บทที่\s*[๐-๙0-9]+$", rich_lines[0][1]):
                rich_lines = rich_lines[2:]

            secs = ch["sections"]
            norm_secs = [(sec, normalize_spaces(sec["full_title"])) for sec in secs]
            line_sec_map = [None] * len(rich_lines)

            cur_sec = secs[0] if secs else None
            sec_ptr = 0

            i = 0
            while i < len(rich_lines):
                matched = False
                for look_sec_idx in range(sec_ptr, min(sec_ptr + 12, len(norm_secs))):
                    target_sec, target_norm = norm_secs[look_sec_idx]
                    acc = ""
                    for span_len in range(1, 5):
                        if i + span_len > len(rich_lines):
                            break
                        acc += normalize_spaces(rich_lines[i + span_len - 1][1])
                        if acc == target_norm:
                            cur_sec = target_sec
                            sec_ptr = look_sec_idx + 1
                            for k in range(i, i + span_len):
                                line_sec_map[k] = ("HEADING", cur_sec)
                            i += span_len
                            matched = True
                            break
                    if matched:
                        break
                if not matched:
                    line_sec_map[i] = ("BODY", cur_sec)
                    i += 1

            body_items = []
            for idx, item in enumerate(rich_lines):
                ltype, s_obj = line_sec_map[idx]
                if ltype == "HEADING":
                    continue
                if item[1].strip() in ("ยังไม่มีข้อมูลเพิ่มเติม", "(ยังไม่มีข้อมูลเพิ่มเติม)"):
                    continue
                body_items.append((item[0], item[1], item[2], item[3], s_obj))

            cite_End_indices = []
            i = 0
            while i < len(body_items):
                p_num, txt, is_bold, x0, s_obj = body_items[i]
                combined = txt
                end_i = i
                if ("(" in txt and not txt.endswith(")")) and any(
                    k in " ".join(x[1] for x in body_items[i : i + 3]) for k in ("คำพิพากษา", "คำสั่ง")
                ):
                    for k in range(1, 5):
                        if i + k < len(body_items):
                            combined += " " + body_items[i + k][1]
                            end_i = i + k
                            if body_items[i + k][1].endswith(")"):
                                break

                m = re.search(
                    r"\((คำ\s*พิพากษา\s*ศาล\s*ปกครอง\s*สูงสุด\s*ที่|คำ\s*สั่ง\s*ศาล\s*ปกครอง\s*สูงสุด\s*ที่)\s*([^)]+)\)\s*$",
                    combined,
                )
                if m:
                    r_type_norm = re.sub(r"\s+", "", m.group(1))
                    cite_End_indices.append((i, end_i, r_type_norm, m.group(2), combined, p_num, s_obj))
                    i = end_i + 1
                else:
                    i += 1

            start_idx = 0
            for c_start, c_end, r_type_raw, cite_num_raw, combined_last_line, end_p_num, end_sec_obj in cite_End_indices:
                seg_items = body_items[start_idx:c_end + 1]
                start_idx = c_end + 1

                if not seg_items:
                    continue

                sec_obj = end_sec_obj or seg_items[-1][4] or (secs[0] if secs else None)
                canon_sec = resolve_canonical_section(canon_ch, sec_obj)
                first_p_num = seg_items[0][0]

                clean_tuples = []
                for idx_s, (sp, stxt, sbold, sx0, _) in enumerate(seg_items):
                    if idx_s == len(seg_items) - 1:
                        stxt_clean = re.sub(r"\((คำพิพากษาศาลปกครองสูงสุดที่|คำสั่งศาลปกครองสูงสุดที่)[^)]*\)\s*$", "", stxt).strip()
                        if stxt_clean:
                            clean_tuples.append((sp, stxt_clean, sbold, sx0))
                    elif idx_s >= (c_start - (start_idx - len(seg_items))):
                        stxt_clean = re.sub(r"\((คำพิพากษาศาลปกครองสูงสุด|คำสั่งศาลปกครองสูงสุด).*$", "", stxt).strip()
                        if stxt_clean and not re.match(r"^[^()]*\)\s*$", stxt_clean):
                            clean_tuples.append((sp, stxt_clean, sbold, sx0))
                    else:
                        clean_tuples.append((sp, stxt, sbold, sx0))

                full_text = join_lines_smart(clean_tuples)

                bold_lines = [t[1] for t in clean_tuples if t[2]]
                if bold_lines:
                    principle = join_lines_smart([t for t in clean_tuples if t[2]])
                else:
                    m_conc = re.search(r"((?:ดังนั้น|ด้วยเหตุนี้|จึงวินิจฉัยว่า|ศาลปกครองสูงสุดวินิจฉัยว่า)[^\"\n]{25,})", full_text)
                    if m_conc:
                        principle = m_conc.group(1).strip()
                    else:
                        paras = [p.strip() for p in full_text.split("\n\n") if p.strip()]
                        principle = paras[-1] if paras else full_text[:300]

                r_type = "คำสั่ง" if "คำสั่ง" in r_type_raw else "คำพิพากษา"
                cite_num_clean = clean_thai( re.sub(r"\s+", " ", cite_num_raw).strip() )
                full_citation = f"{r_type_raw} {cite_num_clean}"
                short_cite = make_short_citation(full_citation, r_type == "คำสั่ง")

                # Deduplicate identical ruling entries while preserving distinct sub-section analyses
                dedup_sig = f"{canon_ch['id']}::{canon_sec['id'] if canon_sec else ''}::{normalize_spaces(short_cite)}::{normalize_spaces(principle[:50])}"
                if dedup_sig in existing_sigs:
                    continue
                existing_sigs.add(dedup_sig)

                is_ga = "ประชุมใหญ่" in full_citation or "ประชุมใหญ่" in full_text
                years = re.findall(r"/(๒๕[๐-๙]{2})", full_citation)
                year_str = years[0] if years else ""

                headline = principle.split("\n")[0].strip()
                headline = re.sub(r"^(ดังนั้น|ด้วยเหตุนี้|จึงเห็นได้ว่า|กรณีจึง|ส่งผลให้)\s*", "", headline)
                if len(headline) > 135:
                    headline = headline[:132].rstrip() + "…"
                if not headline:
                    headline = canon_sec["title"] if canon_sec else canon_ch["title"]

                laws = extract_laws(full_text)
                book_page_est = first_p_num - 18 if first_p_num > 34 else first_p_num

                extracted.append({
                    "id": f"ruling-{ruling_seq:04d}",
                    "seq": ruling_seq,
                    "source_vol": "",
                    "pdf_file": pdf_filename,
                    "part_id": canon_ch["part_id"],
                    "part_code": canon_ch["part_code"],
                    "part_title": canon_ch["part_title"],
                    "chapter_id": canon_ch["id"],
                    "chapter_code": canon_ch["code"],
                    "chapter_title": canon_ch["title"],
                    "section_id": canon_sec["id"] if canon_sec else None,
                    "section_code": canon_sec["code"] if canon_sec else "",
                    "section_title": canon_sec["title"] if canon_sec else canon_ch["title"],
                    "section_full_title": canon_sec["full_title"] if canon_sec else canon_ch["full_title"],
                    "section_path": canon_sec["path"] if canon_sec else [canon_ch["full_title"]],
                    "ruling_type": r_type,
                    "citation": full_citation,
                    "short_citation": short_cite,
                    "citation_arabic": to_arabic(full_citation),
                    "year": year_str,
                    "is_general_assembly": is_ga,
                    "title": headline,
                    "principle": principle,
                    "facts": full_text,
                    "laws": laws,
                    "book_page": book_page_est,
                    "pdf_page": first_p_num,
                    "is_custom": False
                })
                ruling_seq += 1

    return extracted, ruling_seq


def main():
    pdf_files = sorted(glob.glob(os.path.join(BASE_DIR, "*.pdf")))
    if not pdf_files:
        print("No PDF files found in", BASE_DIR)
        return

    # Always prioritize Volume 14 first so the canonical 39-chapter TOC is built from the latest edition
    pdf_files.sort(key=lambda p: (0 if "14" in os.path.basename(p) else 1, os.path.basename(p)))

    first_doc = fitz.open(pdf_files[0])
    canonical_toc = parse_pdf_toc_and_chapters(first_doc)

    all_rulings = []
    existing_sigs = set()
    seq = 1

    for pdf_path in pdf_files:
        print(f"Extracting from: {os.path.basename(pdf_path)}")
        rulings, seq = extract_rulings_from_pdf(pdf_path, canonical_toc, existing_sigs, seq)
        print(f"  -> Extracted {len(rulings)} rulings from {os.path.basename(pdf_path)}")
        all_rulings.extend(rulings)

    # Recalculate ruling counts per chapter and section in canonical_toc
    ch_counts = {}
    sec_counts = {}
    for r in all_rulings:
        ch_counts[r["chapter_id"]] = ch_counts.get(r["chapter_id"], 0) + 1
        if r["section_id"]:
            sec_counts[r["section_id"]] = sec_counts.get(r["section_id"], 0) + 1

    total_ch = 0
    total_sec = 0
    for p in canonical_toc:
        for c in p["chapters"]:
            total_ch += 1
            c["ruling_count"] = ch_counts.get(c["id"], 0)
            for s in c["sections"]:
                total_sec += 1
                s["ruling_count"] = sec_counts.get(s["id"], 0)

    out_dir = os.path.join(BASE_DIR, "data")
    os.makedirs(out_dir, exist_ok=True)

    dataset = {
        "book_meta": {
            "title": "แนวคำวินิจฉัยของศาลปกครอง",
            "publisher": "สำนักงานศาลปกครอง",
            "pdf_files": [os.path.basename(p) for p in pdf_files],
            "total_parts": len(canonical_toc),
            "total_chapters": total_ch,
            "total_sections": total_sec,
            "total_rulings": len(all_rulings)
        },
        "toc": canonical_toc,
        "rulings": all_rulings
    }

    json_path = os.path.join(out_dir, "vol14_data.json")
    js_path = os.path.join(out_dir, "vol14_data.js")

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(dataset, f, ensure_ascii=False, indent=2)

    with open(js_path, "w", encoding="utf-8") as f:
        f.write("window.ADMIN_LAW_DATA = ")
        json.dump(dataset, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")

    print(f"Done! Processed {len(pdf_files)} PDF file(s), total chapters: {total_ch}, total sections: {total_sec}, total rulings: {len(all_rulings)}")


if __name__ == "__main__":
    main()
