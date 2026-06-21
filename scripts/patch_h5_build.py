"""
Patch compiled H5 build output to reflect source changes for reader UI.
Replaces hardcoded values in minified JS and CSS bundles.
"""
import os
import re
import glob

H5_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "unpackage", "dist", "build", "h5")

def patch_file(filepath):
    """Apply all patches to a single JS or CSS file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    # ── JS patches ──
    if filepath.endswith('.js'):
        # 1. contentWidth default: 82 → 88
        #    Matches patterns like: contentWidth:82, or contentWidth:82}
        content = re.sub(r'(contentWidth\s*:\s*)82([,;}])', r'\g<1>88\2', content)
        # Also match in object literals with computed keys
        content = content.replace('contentWidth:82,', 'contentWidth:88,')
        content = content.replace('contentWidth:82}', 'contentWidth:88}')
        content = content.replace('contentWidth:82;', 'contentWidth:88;')

        # 2. contentWidth clamp range: 62,96 → 72,98
        content = re.sub(r'(contentWidth\s*,\s*)62\s*,\s*96', r'\g<1>72,98', content)

        # 3. splitChapter size calculation
        #    Math.max(110,Math.floor((280- → Math.max(140,Math.floor((340-
        content = re.sub(
            r'Math\.max\(110,Math\.floor\(\(280-',
            r'Math.max(140,Math.floor(((340-',
            content
        )
        # Also handle case where parens differ
        content = re.sub(
            r'Math\.max\(110,Math\.floor\(280-',
            r'Math.max(140,Math.floor(340-',
            content
        )

        # 4. Slider min/max in template
        content = re.sub(
            r'min:\s*"62"\s*,\s*max:\s*"96"\s*,\s*activeColor:\s*"#df7458"\s*,\s*onChange:\s*changeContentWidthSlider',
            r'min:"72",max:"98",activeColor:"#df7458",onChange:changeContentWidthSlider',
            content
        )
        # Try alternate minified template patterns
        content = content.replace('min:"62"', 'min:"72"')
        if 'max:"96"' in content and 'changeContentWidthSlider' in content:
            content = content.replace('max:"96"', 'max:"98"')

        # 5. Pattern for contentWidth default in normalizePrefs
        #    (contentWidth,62,96, → (contentWidth,72,98,
        content = content.replace('(contentWidth,62,96,', '(contentWidth,72,98,')

    # ── CSS patches (both .css files and CSS-in-JS) ──
    # UniApp compiles rpx values to %?NNN?% placeholders for runtime conversion.
    # We need to patch both the placeholder format and raw values.

    # 1. reading-surface padding: %?128?% 0 %?174?% → %?88?% 0 %?80?%
    #    (128rpx top → 88rpx, 174rpx bottom → 80rpx)
    content = content.replace('%?128?% 0 %?174?%', '%?88?% 0 %?80?%')
    # Also try raw rpx patterns
    content = content.replace('padding:128rpx 0 330rpx', 'padding:88rpx 0 80rpx')
    content = content.replace('padding:128rpx 0 174rpx', 'padding:88rpx 0 80rpx')

    # 2. reader-content min-height: %?420?% → flex:1
    content = content.replace('min-height:%?420?%', 'flex:1')
    content = content.replace('min-height:420rpx', 'flex:1')

    # 3. Width 82% → 88% for reader elements (both desktop and mobile)
    #    The compiled CSS has newlines in it, so use a broader regex
    content = re.sub(
        r'(\.page-head\[data-v-[a-f0-9]+\][^{]*\{[^}]*width:\s*)82%',
        r'\g<1>88%',
        content
    )
    # Also any simple .page-head,.chapter-meta,... { width:82% } patterns
    content = re.sub(
        r'(\.page-head\s*,.*?\{[^}]*?width:\s*)82%',
        r'\g<1>88%',
        content
    )

    # 4. Reader content margin-top/padding-bottom
    content = content.replace('margin-top:30rpx;padding-bottom:34rpx', 'margin-top:24rpx;padding-bottom:20rpx')

    # 5. Mobile media query: padding-top calc(%?132?% + env(...)) → calc(%?100?% + env(...))
    content = content.replace('%?132?% + env(safe-area-inset-top)', '%?100?% + env(safe-area-inset-top)')
    # Add mobile padding-bottom alongside the mobile reading-surface padding-top
    content = content.replace(
        'padding-top:calc(%?100?% + env(safe-area-inset-top))',
        'padding-top:calc(%?100?% + env(safe-area-inset-top));padding-bottom:%?72?%'
    )

    # 6. Mobile reader widths: 88% → 92% (for the media query version)
    #    Already handled by the width regex in step 3

    # 7. Error/loading card width: 82% → 88%
    content = re.sub(
        r'(\.loading-card\[data-v-[a-f0-9]+\][^{]*\{[^}]*width:\s*)82%',
        r'\g<1>88%',
        content
    )

    # 8. Add display:flex and flex-direction:column to reading-surface
    #    The padding was already patched to 88/80 in step 1
    content = content.replace(
        'position:absolute;inset:0;padding:%?88?% 0 %?80?%',
        'position:absolute;inset:0;display:flex;flex-direction:column;padding:%?88?% 0 %?80?%'
    )

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False


def main():
    print("Patching H5 build output for reader UI changes...")
    print(f"H5 directory: {H5_DIR}")
    print()

    patched_count = 0
    total_files = 0

    for root, dirs, files in os.walk(H5_DIR):
        for filename in files:
            if filename.endswith(('.js', '.css')):
                total_files += 1
                filepath = os.path.join(root, filename)
                if patch_file(filepath):
                    patched_count += 1
                    rel = os.path.relpath(filepath, H5_DIR)
                    print(f"  [PATCHED] {rel}")

    print()
    print(f"Patched {patched_count} of {total_files} files.")
    print("Done.")


if __name__ == "__main__":
    main()
