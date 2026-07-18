"""
Patch compiled H5 build output to reflect source changes for reader UI.
Replaces hardcoded values in minified JS and CSS bundles.
"""
import os
import re
import glob

DEFAULT_H5_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "unpackage", "dist", "build", "h5")
H5_DIR = os.environ.get("H5_DIR", DEFAULT_H5_DIR)


def patch_source_engine_bundle(content):
    """Backport the tested selector parser into a stale H5 bundle.

    This is used only when HBuilderX cannot rebuild. It fails closed if the
    expected old minified implementation cannot be located.
    """
    selector_start = content.find('function Y(e,t){const r=t.match')
    selector_end = content.find('function W(e,t,r){', selector_start)
    if selector_start < 0 or selector_end < 0:
        return content, False

    replacement = r'''function Y(e,t){const r=String(t||"").trim().replace(/^css:/i,""),n=r.match(/^(.*?):nth-(?:of-type|child)\((\d+)\)$/i),o=n?n[1]:r,i=n?Math.max(0,Number(n[2])-1):/:last-child$/i.test(o)?"last":/:first-child$/i.test(o)?0:null,s=/:last-child$/i.test(o)?o.replace(/:last-child$/i,""):/:first-child$/i.test(o)?o.replace(/:first-child$/i,""):o,a=s.match(/^(.*?)(?:\.|\[)(\d+)\]?$/),u=a?a[1]:s,c=null!==i?i:a?Number(a[2]):null,l=u.match(/^(.*?)(\[[^\]]+\])$/),f=l?l[1]:u,d=l?l[2].match(/^\[\s*([\w:-]+)\s*(\*?=)\s*["']?([^"'\]]*)["']?\s*\]$/):null,{tag:p,id:h,className:g}=V(f),m=/<([a-zA-Z][\w:-]*)([^>]*)>/gi,v=[];let y;while(y=m.exec(e)){const t=y[1],r=y[2]||"";if(p&&t.toLowerCase()!==String(p).toLowerCase())continue;if(h&&!new RegExp(`\\bid=["']?${oe(h)}["']?`,"i").test(r))continue;if(g&&!new RegExp(`\\bclass=["'][^"']*\\b${oe(g)}\\b`,"i").test(r))continue;if(d){const e=z(`<x ${r}></x>`,d[1]);if(!e||(d[2]==="*="?!e.includes(d[3]):e!==d[3]))continue}if(/^(img|input|meta|link|br)$/i.test(t)){v.push(y[0]);continue}const n=new RegExp(`<\\/${oe(t)}>` ,"i"),o=e.slice(m.lastIndex),i=o.match(n);v.push(i?e.slice(y.index,m.lastIndex+i.index+i[0].length):y[0])}return"last"===c?v.length?[v[v.length-1]]:[]:null!==c?v[c]?[v[c]]:[]:v}'''
    content = content[:selector_start] + replacement + content[selector_end:]

    old_selector_parser = 'function V(e){if(e.startsWith("#"))return{id:e.slice(1)};if(e.startsWith("."))return{className:e.slice(1)};const t=e.match(/^([a-zA-Z][\\w:-]*)?\\.([\\w-]+)$/);if(t)return{tag:t[1]||"",className:t[2]};const r=e.match(/^([a-zA-Z][\\w:-]*)?#([\\w-]+)$/);return r?{tag:r[1]||"",id:r[2]}:{tag:e||""}}'
    new_selector_parser = 'function V(e){const t=e.match(/^([a-zA-Z][\\w:-]*)/),r=t?t[1]:"",n=e.slice(r.length),o=n.match(/#([\\w-]+)/),i=[...n.matchAll(/\\.([\\w-]+)/g)].map(e=>e[1]);return n&&n.replace(/#[\\w-]+|\\.[\\w-]+/g,"")?{tag:e||""}:{tag:r,id:o?o[1]:"",className:i.join(" ")}}'
    if old_selector_parser not in content:
        raise RuntimeError("Old source-engine selector parser was not found in H5 bundle")
    content = content.replace(old_selector_parser, new_selector_parser, 1)

    old_normalizer = 'function ee(e){const t=String(e||"").trim();return t.startsWith("class.")?"."+t.slice(6):t.startsWith("id.")?"#"+t.slice(3):t.startsWith("tag.")?t.slice(4):t}'
    new_normalizer = 'function ee(e){const t=String(e||"").trim();return/^css:/i.test(t)?t.replace(/^css:/i,""):t.startsWith("class.")?"."+t.slice(6):t.startsWith("id.")?"#"+t.slice(3):t.startsWith("tag.")?t.slice(4):t}'
    if old_normalizer not in content:
        raise RuntimeError("Old source-engine selector normalizer was not found in H5 bundle")
    return content.replace(old_normalizer, new_normalizer, 1), True

def patch_file(filepath):
    """Apply all patches to a single JS or CSS file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    # ── JS patches ──
    if filepath.endswith('.js'):
        content, source_engine_patched = patch_source_engine_bundle(content)
        if source_engine_patched:
            print(f"  [SOURCE-ENGINE] {os.path.basename(filepath)}")

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
