# -*- coding: utf-8 -*-
"""
重置存量项目的默认封面（旧版灰色 canvas 封面 / 非法 cover 值）为站点标准默认值，
使首页/项目列表恢复显示新的品牌绿渐变默认封面。

使用方式（内网部署机）：
    python scripts/reset_default_covers.py --dry-run        # 预览将重置的项目
    python scripts/reset_default_covers.py                  # 执行重置（自动备份数据库）
    python scripts/reset_default_covers.py --db D:/data/mindoc.db --workdir D:/mindoc
"""
import argparse
import os
import shutil
import sqlite3
import time

DEFAULT_COVER = "/static/images/book.jpg"

try:
    from PIL import Image
    HAS_PIL = True
except ImportError:
    HAS_PIL = False


def is_legacy_gray_cover(workdir, cover):
    """检测是否为旧版 canvas 绘制的灰色默认封面（#eee 背景 + 深灰文字，170x230）。"""
    if not HAS_PIL:
        return False
    if not (cover.startswith("/uploads/") and cover.lower().endswith((".png", ".jpg", ".jpeg", ".gif"))):
        return False
    path = os.path.join(workdir, cover.lstrip("/").replace("/", os.sep))
    if not os.path.isfile(path):
        return False
    try:
        im = Image.open(path).convert("RGB")
        w, h = im.size
        # 旧版 canvas 封面为 170x230，允许一定偏差；非该尺寸的图片不做灰度判断
        if abs(w - 170) > 10 or abs(h - 230) > 10:
            return False
        im = im.resize((64, 64))
        px = list(im.getdata())
        total = len(px)
        gray = sum(1 for r, g, b in px if abs(r - g) < 22 and abs(g - b) < 22 and r > 200 and g > 200 and b > 200)
        return (gray / total) > 0.95
    except Exception as e:
        print("  [skip] 图片解析失败:", cover, e)
        return False


def main():
    parser = argparse.ArgumentParser(description="重置存量项目默认封面")
    parser.add_argument("--db", default=os.path.join("database", "mindoc.db"), help="sqlite 数据库路径")
    parser.add_argument("--workdir", default=os.getcwd(), help="MinDoc 工作目录（uploads 所在目录）")
    parser.add_argument("--dry-run", action="store_true", help="仅预览，不修改")
    args = parser.parse_args()

    if not os.path.isfile(args.db):
        print("数据库不存在:", args.db)
        return 1

    conn = sqlite3.connect(args.db)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    try:
        cur.execute("SELECT book_id, book_name, identify, cover FROM md_books ORDER BY book_id")
        rows = cur.fetchall()
    except sqlite3.OperationalError as e:
        print("读取 md_books 失败（表名可能不同）:", e)
        conn.close()
        return 1

    affected = []
    for row in rows:
        cover = row["cover"] or ""
        reason = ""
        if cover == "":
            reason = "cover 为空"
        elif cover == "static/images/book.jpg":
            reason = "cover 缺少前导斜杠"
        elif cover != DEFAULT_COVER and is_legacy_gray_cover(args.workdir, cover):
            reason = "旧版灰色 canvas 封面"
        if reason:
            affected.append((row["book_id"], row["identify"], cover, reason))

    if not affected:
        print("没有需要重置的项目。")
        conn.close()
        return 0

    print("待重置项目 %d 个：" % len(affected))
    for bid, identify, cover, reason in affected:
        print("  #%s %-16s %s  (%s)" % (bid, identify, cover, reason))

    if args.dry_run:
        print("\n[--dry-run] 未做任何修改。")
        conn.close()
        return 0

    backup = args.db + ".bak." + time.strftime("%Y%m%d%H%M%S")
    shutil.copy2(args.db, backup)
    print("\n已备份数据库 ->", backup)

    for bid, identify, cover, reason in affected:
        cur.execute("UPDATE md_books SET cover=? WHERE book_id=?", (DEFAULT_COVER, bid))
    conn.commit()
    print("已重置 %d 个项目的封面为默认值。" % len(affected))
    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
