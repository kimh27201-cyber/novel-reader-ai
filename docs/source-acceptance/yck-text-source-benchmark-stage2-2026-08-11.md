# YCK 文字书源脱敏验收报告（2026-08-11）

- 抓取时间：2026-08-11T08:26:28.196Z
- 分层页面：1、28、56
- 目标样本：200；有效文字 JSON：200
- JSON 导入成功率：100%（分母为有效文字 JSON）
- 静态状态：ready 82 / partial 30 / needs_login 10 / blocked 78 / invalid 0
- 静态候选：36；真实请求后合格分母：4；外部状态排除：32
- 完整阅读实测：1/4；完整阅读率 25%（全部静态候选共测试 36 个）
- 外部状态排除：CAPTCHA_REQUIRED 1 / TIMEOUT 4 / HTTP_BLOCKED 6 / SITE_UNREACHABLE 4 / NETWORK_ERROR 12 / HTTP_NOT_FOUND 3 / HTTP_SERVER_ERROR 2

> 报告不保存第三方正文、Cookie、Token 或完整书源 JSON；SHA-256 仅用于固定样本版本。未执行真机流程的行标记为 not_run，不能计为通过。

| ID | 层次 | 页 | SHA-256（前 12 位） | 下载 | 状态 | Android | 搜/详/目/文 | 流程 | 错误码 | 耗时(ms) |
|---:|---|---:|---|---|---|---|---|---|---|---:|
| 7697 | recent | 1 | 6f390ace6a0c | valid_text_json | blocked | — | —/✓/—/— | not_run | SCRIPT_UNSUPPORTED | 187 |
| 7688 | recent | 1 | 0d8f3cf8be0a | valid_text_json | blocked | — | ✓/✓/✓/— | not_run | SCRIPT_UNSUPPORTED | 221 |
| 7696 | recent | 1 | 6a4ec0d0324d | valid_text_json | blocked | — | —/✓/—/— | not_run | SCRIPT_UNSUPPORTED | 175 |
| 7694 | recent | 1 | f965b757e263 | valid_text_json | blocked | — | —/—/—/— | not_run | SCRIPT_UNSUPPORTED | 351 |
| 7693 | recent | 1 | 621d703526f5 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 352 |
| 7692 | recent | 1 | c7a895d5ec22 | valid_text_json | needs_login | ✓ | ✓/✓/✓/✓ | not_run | LOGIN_REQUIRED | 338 |
| 7691 | recent | 1 | e8239d441d1e | valid_text_json | blocked | — | ✓/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 319 |
| 7689 | recent | 1 | 58d0b3b86604 | valid_text_json | blocked | — | —/—/—/— | not_run | SCRIPT_UNSUPPORTED | 256 |
| 7685 | recent | 1 | e47dff2145e3 | valid_text_json | blocked | — | ✓/—/—/— | not_run | SCRIPT_UNSUPPORTED | 206 |
| 7684 | recent | 1 | c7cd3e05720f | valid_text_json | blocked | — | ✓/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 497 |
| 7679 | recent | 1 | 6039c6412023 | valid_text_json | blocked | — | —/—/—/— | not_run | SCRIPT_UNSUPPORTED | 215 |
| 7662 | recent | 1 | 0dea1816be17 | valid_text_json | blocked | — | ✓/✓/✓/— | not_run | SCRIPT_UNSUPPORTED | 221 |
| 7678 | recent | 1 | 01b56f86b57f | valid_text_json | partial | ✓ | —/✓/✓/✓ | not_run | PARTIAL_CAPABILITY | 193 |
| 7677 | recent | 1 | 8a5a5f74ae26 | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 248 |
| 7674 | recent | 1 | 6c3b3b370fa4 | valid_text_json | blocked | — | ✓/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 195 |
| 7671 | recent | 1 | 6c02ab0767fe | valid_text_json | partial | ✓ | —/✓/✓/✓ | not_run | PARTIAL_CAPABILITY | 225 |
| 7672 | recent | 1 | 10e9a26ae5ec | valid_text_json | partial | ✓ | —/✓/✓/✓ | not_run | PARTIAL_CAPABILITY | 235 |
| 7249 | recent | 1 | 8033bf41a62e | valid_text_json | blocked | — | —/—/—/— | not_run | SCRIPT_UNSUPPORTED | 247 |
| 7661 | recent | 1 | 2232cba7a1c4 | valid_text_json | blocked | — | ✓/—/—/— | not_run | SCRIPT_UNSUPPORTED | 368 |
| 7616 | recent | 1 | b79ec95b1a50 | valid_text_json | blocked | — | —/—/—/— | not_run | SCRIPT_UNSUPPORTED | 253 |
| 7663 | recent | 1 | c9cc782f5a22 | valid_text_json | blocked | — | —/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 259 |
| 7630 | recent | 1 | 4a05264f666b | valid_text_json | needs_login | ✓ | ✓/✓/✓/✓ | not_run | LOGIN_REQUIRED | 211 |
| 7656 | recent | 1 | c5bee50ea10c | valid_text_json | partial | ✓ | —/✓/✓/✓ | not_run | PARTIAL_CAPABILITY | 211 |
| 7655 | recent | 1 | b113b607e18e | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | passed |  | 190 |
| 7419 | recent | 1 | 4d87a81ef122 | valid_text_json | blocked | — | —/—/—/— | not_run | SCRIPT_UNSUPPORTED | 235 |
| 7650 | recent | 1 | 77199160d8a3 | valid_text_json | blocked | — | —/—/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 178 |
| 7649 | recent | 1 | acf4f007ba3d | valid_text_json | blocked | — | ✓/—/✓/— | not_run | SCRIPT_UNSUPPORTED | 202 |
| 7643 | recent | 1 | 95b79814068e | valid_text_json | blocked | — | —/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 209 |
| 7640 | recent | 1 | 5512bcc0c92b | valid_text_json | ready | ✓ | —/✓/✓/✓ | not_run |  | 206 |
| 7639 | recent | 1 | 703bdc8eb648 | valid_text_json | blocked | — | —/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 203 |
| 7637 | recent | 1 | d569b0b839c1 | valid_text_json | blocked | — | —/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 178 |
| 7634 | recent | 1 | c8ec3de253ff | valid_text_json | blocked | — | ✓/—/✓/— | not_run | SCRIPT_UNSUPPORTED | 203 |
| 7633 | recent | 1 | b4d67095e6dd | valid_text_json | blocked | — | —/✓/✓/— | not_run | SCRIPT_UNSUPPORTED | 222 |
| 6807 | recent | 1 | 2ca5973fdae9 | valid_text_json | blocked | — | —/—/—/— | not_run | SCRIPT_UNSUPPORTED | 207 |
| 7632 | recent | 1 | bb230b430f3b | valid_text_json | blocked | — | —/—/—/— | not_run | SCRIPT_UNSUPPORTED | 294 |
| 7631 | recent | 1 | 911b8bff7117 | valid_text_json | blocked | — | ✓/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 182 |
| 7629 | recent | 1 | 72da403cc19e | valid_text_json | blocked | — | ✓/✓/✓/— | not_run | SCRIPT_UNSUPPORTED | 183 |
| 7628 | recent | 1 | 086703974185 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | CAPTCHA_REQUIRED | 199 |
| 7624 | recent | 1 | d8c23d171ca7 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | TIMEOUT | 208 |
| 7623 | recent | 1 | 950672e8489f | valid_text_json | blocked | — | ✓/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 238 |
| 7622 | recent | 1 | ac2a79b4ef05 | valid_text_json | blocked | — | ✓/✓/—/✓ | not_run | SCRIPT_UNSUPPORTED | 245 |
| 6109 | recent | 1 | c689dcd33b1f | valid_text_json | blocked | — | ✓/✓/—/— | not_run | SCRIPT_UNSUPPORTED | 236 |
| 3331 | recent | 1 | bc780257f440 | valid_text_json | blocked | — | —/—/—/— | not_run | SCRIPT_UNSUPPORTED | 211 |
| 7619 | recent | 1 | a5340abb6a1a | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 226 |
| 7617 | recent | 1 | 94ac628b454b | valid_text_json | blocked | — | ✓/✓/—/— | not_run | SCRIPT_UNSUPPORTED | 195 |
| 7536 | recent | 1 | e3d0ef8d7ce6 | valid_text_json | blocked | — | —/—/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 201 |
| 7614 | recent | 1 | 194afe7c3066 | valid_text_json | blocked | — | ✓/✓/✓/— | not_run | SCRIPT_UNSUPPORTED | 235 |
| 7613 | recent | 1 | bcdbd8df945b | valid_text_json | blocked | — | —/✓/✓/— | not_run | SCRIPT_UNSUPPORTED | 235 |
| 7612 | recent | 1 | 31c51237141d | valid_text_json | blocked | — | —/✓/✓/— | not_run | SCRIPT_UNSUPPORTED | 226 |
| 7610 | recent | 1 | e51f7dd5a104 | valid_text_json | blocked | — | —/—/—/— | not_run | SCRIPT_UNSUPPORTED | 274 |
| 7609 | recent | 1 | 3915d486c3d4 | valid_text_json | needs_login | ✓ | ✓/✓/✓/— | not_run | LOGIN_REQUIRED | 210 |
| 7607 | recent | 1 | d6b332f542da | valid_text_json | blocked | — | ✓/—/—/— | not_run | SCRIPT_UNSUPPORTED | 211 |
| 7606 | recent | 1 | 2717efa54d19 | valid_text_json | blocked | — | ✓/—/—/— | not_run | SCRIPT_UNSUPPORTED | 259 |
| 7604 | recent | 1 | de804351eab0 | valid_text_json | blocked | — | —/—/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 190 |
| 7603 | recent | 1 | 9de2c939c821 | valid_text_json | blocked | — | ✓/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 198 |
| 7602 | recent | 1 | 149e2604c922 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 198 |
| 7600 | recent | 1 | 6918dfd2d785 | valid_text_json | blocked | — | ✓/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 197 |
| 7597 | recent | 1 | 3ad5e5fd9a23 | valid_text_json | blocked | — | —/—/—/— | not_run | SCRIPT_UNSUPPORTED | 186 |
| 7596 | recent | 1 | 6856da567c44 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | PARSE_EMPTY | 183 |
| 7595 | recent | 1 | 68e3ce2ece5b | valid_text_json | blocked | — | —/—/—/— | not_run | SCRIPT_UNSUPPORTED | 221 |
| 7592 | recent | 1 | 8033b24e1a22 | valid_text_json | blocked | — | —/✓/✓/— | not_run | SCRIPT_UNSUPPORTED | 187 |
| 7590 | recent | 1 | 3b7349f39afb | valid_text_json | needs_login | ✓ | ✓/✓/✓/✓ | not_run | LOGIN_REQUIRED | 189 |
| 7589 | recent | 1 | 57a3262bd3e1 | valid_text_json | blocked | — | —/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 266 |
| 7588 | recent | 1 | c0aac28b6e73 | valid_text_json | blocked | — | —/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 264 |
| 7587 | recent | 1 | 1f35df84fd24 | valid_text_json | blocked | — | —/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 266 |
| 7586 | recent | 1 | 9f577256a29c | valid_text_json | blocked | — | —/—/—/✓ | not_run | SCRIPT_UNSUPPORTED | 272 |
| 7585 | recent | 1 | 1dd3ac751a3e | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 277 |
| 291 | middle | 28 | 3bcead8cca1e | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 210 |
| 293 | middle | 28 | 3131d233d7c3 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 209 |
| 308 | middle | 28 | 5c781d6a803d | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 209 |
| 247 | middle | 28 | f59598c88e2e | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | SITE_UNREACHABLE | 245 |
| 263 | middle | 28 | d044842f3078 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 203 |
| 264 | middle | 28 | e9b2f632b3be | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 215 |
| 265 | middle | 28 | 7ba6dbf34104 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 236 |
| 275 | middle | 28 | c47521b22b6f | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 245 |
| 277 | middle | 28 | 586a36574958 | valid_text_json | partial | ✓ | —/✓/✓/✓ | not_run | PARTIAL_CAPABILITY | 203 |
| 303 | middle | 28 | 46f05af59c50 | valid_text_json | blocked | — | ✓/✓/✓/— | not_run | SCRIPT_UNSUPPORTED | 252 |
| 319 | middle | 28 | 6852329eb981 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 202 |
| 249 | middle | 28 | 9b926ba2cb24 | valid_text_json | blocked | — | —/—/—/— | not_run | SCRIPT_UNSUPPORTED | 222 |
| 271 | middle | 28 | cc6dc51a3d5a | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 268 |
| 272 | middle | 28 | 14ac03a60f78 | valid_text_json | blocked | — | ✓/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 204 |
| 273 | middle | 28 | a56cc46b1554 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 319 |
| 278 | middle | 28 | 88dba9b1007c | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 328 |
| 280 | middle | 28 | 25582bbdb72b | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 329 |
| 242 | middle | 28 | 62d8e918f5f2 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 328 |
| 261 | middle | 28 | adee59b0c232 | valid_text_json | needs_login | ✓ | ✓/✓/✓/✓ | not_run | LOGIN_REQUIRED | 328 |
| 266 | middle | 28 | a15bb3576f9e | valid_text_json | blocked | — | ✓/—/✓/— | not_run | SCRIPT_UNSUPPORTED | 322 |
| 268 | middle | 28 | 8bf3a5a7189c | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 288 |
| 269 | middle | 28 | 4f4ca2040879 | valid_text_json | blocked | — | ✓/—/—/✓ | not_run | SCRIPT_UNSUPPORTED | 278 |
| 257 | middle | 28 | 4ae31743d15f | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 201 |
| 281 | middle | 28 | 4e14be57fb08 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 186 |
| 248 | middle | 28 | 596d403f05cb | valid_text_json | blocked | — | —/—/—/— | not_run | SCRIPT_UNSUPPORTED | 230 |
| 250 | middle | 28 | cdc747857e51 | valid_text_json | blocked | — | —/—/—/— | not_run | SCRIPT_UNSUPPORTED | 228 |
| 251 | middle | 28 | 3a9a02ffcee1 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 227 |
| 252 | middle | 28 | 6713ca2143d2 | valid_text_json | blocked | — | —/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 226 |
| 253 | middle | 28 | 860a88d5f8c4 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 215 |
| 254 | middle | 28 | 04d6fb26ea5f | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 224 |
| 255 | middle | 28 | 76bbf21c1c8a | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 227 |
| 274 | middle | 28 | 0368ffb0cefa | valid_text_json | blocked | — | —/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 241 |
| 276 | middle | 28 | c26efd3f458f | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_NOT_FOUND | 256 |
| 294 | middle | 28 | 714eec26efe2 | valid_text_json | partial | ✓ | ✓/—/✓/✓ | not_run | PARTIAL_CAPABILITY | 256 |
| 203 | middle | 28 | 8e2155e3d4cd | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 268 |
| 229 | middle | 28 | b3e3c478486a | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_NOT_FOUND | 270 |
| 231 | middle | 28 | 1420369f8069 | valid_text_json | blocked | — | ✓/—/✓/— | not_run | SCRIPT_UNSUPPORTED | 268 |
| 232 | middle | 28 | bd53c3522d84 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 269 |
| 235 | middle | 28 | 839ee07dd61a | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_SERVER_ERROR | 225 |
| 236 | middle | 28 | 207a1a9988a6 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 210 |
| 238 | middle | 28 | c8624ada2040 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 193 |
| 243 | middle | 28 | e032b8314c24 | valid_text_json | blocked | — | —/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 252 |
| 244 | middle | 28 | 893e32652bbf | valid_text_json | blocked | — | ✓/✓/✓/— | not_run | SCRIPT_UNSUPPORTED | 195 |
| 245 | middle | 28 | 938fe0399262 | valid_text_json | blocked | — | —/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 250 |
| 246 | middle | 28 | 48e7c60b3957 | valid_text_json | blocked | — | —/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 252 |
| 21 | middle | 28 | 71bdff7c3e72 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 306 |
| 1709 | middle | 28 | 3a5a839a2050 | valid_text_json | blocked | — | ✓/—/—/✓ | not_run | SCRIPT_UNSUPPORTED | 268 |
| 194 | middle | 28 | 8eb374a2294b | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | TIMEOUT | 296 |
| 195 | middle | 28 | eee3ef11c9f7 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 336 |
| 204 | middle | 28 | 3499f503ffb0 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 275 |
| 219 | middle | 28 | 6fa60ba4a626 | valid_text_json | blocked | — | —/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 270 |
| 222 | middle | 28 | 227b01411209 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 271 |
| 226 | middle | 28 | 99f0d2f51f1d | valid_text_json | blocked | — | —/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 274 |
| 227 | middle | 28 | 452fd92e8b22 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | SEARCH_EMPTY | 202 |
| 228 | middle | 28 | 78d1503aa883 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 251 |
| 230 | middle | 28 | eced1465f46c | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 218 |
| 233 | middle | 28 | bac7457bf48d | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 220 |
| 148 | middle | 28 | 0d8a18338164 | valid_text_json | needs_login | ✓ | ✓/✓/✓/✓ | not_run | LOGIN_REQUIRED | 219 |
| 191 | middle | 28 | 0492d7ae4ed5 | valid_text_json | needs_login | ✓ | ✓/✓/—/✓ | not_run | LOGIN_REQUIRED | 212 |
| 212 | middle | 28 | b8f55bf19d8a | valid_text_json | blocked | — | ✓/—/✓/— | not_run | SCRIPT_UNSUPPORTED | 210 |
| 213 | middle | 28 | 7a0b82a17c30 | valid_text_json | needs_login | ✓ | ✓/✓/✓/✓ | not_run | LOGIN_REQUIRED | 245 |
| 214 | middle | 28 | c6427ea51bdd | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 206 |
| 215 | middle | 28 | 7f8a6eabdf5a | valid_text_json | partial | ✓ | ✓/✓/✓/✓ | not_run | PARTIAL_CAPABILITY | 227 |
| 216 | middle | 28 | be38f4fbcc09 | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 227 |
| 218 | middle | 28 | 0d5adfeca343 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 227 |
| 234 | middle | 28 | e0d3fbad2c00 | valid_text_json | blocked | — | ✓/—/✓/— | not_run | SCRIPT_UNSUPPORTED | 226 |
| 198 | middle | 28 | dff91ae12993 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 189 |
| 1972 | older | 56 | c408e8b05da8 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 176 |
| 2745 | older | 56 | 94cf2d79db39 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 176 |
| 2312 | older | 56 | b3f3c92f5a0d | valid_text_json | needs_login | ✓ | ✓/✓/✓/✓ | not_run | LOGIN_REQUIRED | 209 |
| 2066 | older | 56 | 44da1d4f1254 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | SITE_UNREACHABLE | 213 |
| 2641 | older | 56 | 4b0b74d15f5f | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | TIMEOUT | 186 |
| 3161 | older | 56 | 302d1c62531f | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 184 |
| 2150 | older | 56 | 488e4e8f6e5e | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | SITE_UNREACHABLE | 211 |
| 2669 | older | 56 | a9566de5620f | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 184 |
| 2416 | older | 56 | 19de4a55cf82 | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 184 |
| 1971 | older | 56 | cc03b97ffdfd | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 207 |
| 1975 | older | 56 | 67df08586654 | valid_text_json | blocked | — | ✓/✓/—/✓ | not_run | SCRIPT_UNSUPPORTED | 262 |
| 3024 | older | 56 | c96e16d46c9a | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 219 |
| 3033 | older | 56 | d80d1cc6bb20 | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 218 |
| 2533 | older | 56 | ff9a645cc639 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 168 |
| 1776 | older | 56 | a4f9b53e51db | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 218 |
| 2550 | older | 56 | 068cb2154026 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 214 |
| 2811 | older | 56 | 6738f2599d43 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | SEARCH_EMPTY | 225 |
| 3085 | older | 56 | 4be67f878f7f | valid_text_json | blocked | — | ✓/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 282 |
| 3087 | older | 56 | 44734c6d2510 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | SITE_UNREACHABLE | 193 |
| 3092 | older | 56 | c8d3f463f191 | valid_text_json | blocked | — | ✓/✓/—/— | not_run | SCRIPT_UNSUPPORTED | 210 |
| 1831 | older | 56 | 99453189931f | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 252 |
| 3134 | older | 56 | 0453bbaa6e80 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 254 |
| 2625 | older | 56 | 1f6da3d11f00 | valid_text_json | ready | ✓ | ✓/—/✓/✓ | failed | HTTP_BLOCKED | 254 |
| 3154 | older | 56 | da595373d0bf | valid_text_json | ready | ✓ | ✓/—/✓/✓ | failed | NETWORK_ERROR | 252 |
| 2686 | older | 56 | 1465c467b358 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_NOT_FOUND | 222 |
| 2968 | older | 56 | c0459462a309 | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 211 |
| 2503 | older | 56 | 1b48120ff827 | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 727 |
| 3015 | older | 56 | 563b7b65c50b | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 668 |
| 2252 | older | 56 | 80ac652f2637 | valid_text_json | blocked | — | ✓/✓/✓/— | not_run | SCRIPT_UNSUPPORTED | 980 |
| 2520 | older | 56 | ecc161b70053 | valid_text_json | blocked | — | ✓/✓/—/✓ | not_run | SCRIPT_UNSUPPORTED | 632 |
| 2527 | older | 56 | e0b6087e49af | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 631 |
| 1779 | older | 56 | ab8229165545 | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 632 |
| 1815 | older | 56 | ad42ee748c03 | valid_text_json | blocked | — | —/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 1045 |
| 1863 | older | 56 | f3df8fc68479 | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 585 |
| 2376 | older | 56 | e7d1e678c64a | valid_text_json | partial | ✓ | —/—/✓/✓ | not_run | PARTIAL_CAPABILITY | 2595 |
| 2147 | older | 56 | 7b9b02dcf063 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 1176 |
| 2718 | older | 56 | 60f5950970b5 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 827 |
| 1957 | older | 56 | d4bd1e88bb63 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 825 |
| 2990 | older | 56 | 4d5fa542ec9c | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 820 |
| 2223 | older | 56 | 7dc34a9ead4a | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 1096 |
| 2251 | older | 56 | f8d079316330 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 1063 |
| 3019 | older | 56 | 806fe5d62d9c | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 350 |
| 2006 | older | 56 | 52fb874cf75f | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 600 |
| 2821 | older | 56 | 99a9d5bd0758 | valid_text_json | needs_login | ✓ | ✓/✓/—/✓ | not_run | LOGIN_REQUIRED | 611 |
| 1828 | older | 56 | 06c140054a97 | valid_text_json | blocked | — | ✓/—/—/— | not_run | SCRIPT_UNSUPPORTED | 1161 |
| 2859 | older | 56 | 95212094761c | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 211 |
| 3130 | older | 56 | ad62f53276e2 | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 238 |
| 2901 | older | 56 | 3d656c04f27e | valid_text_json | ready | ✓ | ✓/—/✓/✓ | failed | NETWORK_ERROR | 210 |
| 1878 | older | 56 | 9d8e5e6d9c41 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 226 |
| 3175 | older | 56 | bbfb599bdcf2 | valid_text_json | blocked | — | ✓/—/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 469 |
| 2947 | older | 56 | 6016be6ead6c | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 569 |
| 2445 | older | 56 | dd08a582f59f | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | TIMEOUT | 577 |
| 1942 | older | 56 | 67826bc0533d | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 232 |
| 1955 | older | 56 | 0a35ec90d0c7 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 199 |
| 2764 | older | 56 | 5ed975ae43fc | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 194 |
| 3025 | older | 56 | c85018202864 | valid_text_json | blocked | — | ✓/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 592 |
| 2038 | older | 56 | 629820496fe7 | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 205 |
| 2305 | older | 56 | 01fea8550c20 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 184 |
| 2314 | older | 56 | 991da02eaefa | valid_text_json | partial | ✓ | ✓/✓/—/✓ | not_run | PARTIAL_CAPABILITY | 183 |
| 1819 | older | 56 | c0384234114b | valid_text_json | blocked | — | —/—/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 192 |
| 2335 | older | 56 | 49da099a6b53 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 575 |
| 2856 | older | 56 | 06be9b907a53 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 236 |
| 2877 | older | 56 | 9cd87598e88e | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_SERVER_ERROR | 209 |
| 2880 | older | 56 | 8883cee8504c | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 176 |
| 2628 | older | 56 | d0b8c060518a | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 228 |
| 2148 | older | 56 | c496d4bd72b5 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 243 |
