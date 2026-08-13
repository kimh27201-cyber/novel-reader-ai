# YCK 文字书源脱敏验收报告（2026-08-11）

- 抓取时间：2026-08-12T16:56:41.247Z
- 分层页面：1、28、56
- 目标样本：200；有效文字 JSON：200
- JSON 导入成功率：100%（分母为有效文字 JSON）
- 静态状态：ready 88 / partial 26 / needs_login 11 / blocked 75 / invalid 0
- 静态候选：36；真实请求后合格分母：3；外部状态排除：33
- 完整阅读实测：1/3；完整阅读率 33.33%（全部静态候选共测试 36 个）
- 外部状态排除：TIMEOUT 6 / HTTP_BLOCKED 6 / NETWORK_ERROR 13 / SITE_UNREACHABLE 4 / HTTP_NOT_FOUND 2 / HTTP_SERVER_ERROR 2

> 报告不保存第三方正文、Cookie、Token 或完整书源 JSON；SHA-256 仅用于固定样本版本。未执行真机流程的行标记为 not_run，不能计为通过。

| ID | 层次 | 页 | SHA-256（前 12 位） | 下载 | 状态 | Android | 搜/详/目/文 | 流程 | 错误码 | 耗时(ms) |
|---:|---|---:|---|---|---|---|---|---|---|---:|
| 7697 | recent | 1 | e466765156a8 | valid_text_json | blocked | — | —/✓/—/— | not_run | SCRIPT_UNSUPPORTED | 233 |
| 7700 | recent | 1 | 1b3a3127f7b9 | valid_text_json | blocked | — | —/—/—/— | not_run | SCRIPT_UNSUPPORTED | 417 |
| 7661 | recent | 1 | cb87e179ff79 | valid_text_json | blocked | — | ✓/—/—/— | not_run | SCRIPT_UNSUPPORTED | 516 |
| 7699 | recent | 1 | 819051fa30ed | valid_text_json | blocked | — | ✓/—/—/— | not_run | SCRIPT_UNSUPPORTED | 5324 |
| 7698 | recent | 1 | 403970f6fef6 | valid_text_json | blocked | — | —/—/—/— | not_run | SCRIPT_UNSUPPORTED | 1732 |
| 7688 | recent | 1 | 0d8f3cf8be0a | valid_text_json | blocked | — | ✓/✓/✓/— | not_run | SCRIPT_UNSUPPORTED | 1671 |
| 7696 | recent | 1 | 6a4ec0d0324d | valid_text_json | blocked | — | —/✓/—/— | not_run | SCRIPT_UNSUPPORTED | 1711 |
| 7694 | recent | 1 | f965b757e263 | valid_text_json | blocked | — | —/—/—/— | not_run | SCRIPT_UNSUPPORTED | 1567 |
| 7693 | recent | 1 | 621d703526f5 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 1570 |
| 7692 | recent | 1 | c7a895d5ec22 | valid_text_json | needs_login | ✓ | ✓/✓/✓/✓ | not_run | LOGIN_REQUIRED | 1508 |
| 7691 | recent | 1 | e8239d441d1e | valid_text_json | blocked | — | ✓/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 1123 |
| 7689 | recent | 1 | 58d0b3b86604 | valid_text_json | blocked | — | —/—/—/— | not_run | SCRIPT_UNSUPPORTED | 1411 |
| 7679 | recent | 1 | 6039c6412023 | valid_text_json | blocked | — | —/—/—/— | not_run | SCRIPT_UNSUPPORTED | 2189 |
| 7662 | recent | 1 | 0dea1816be17 | valid_text_json | blocked | — | ✓/✓/✓/— | not_run | SCRIPT_UNSUPPORTED | 1531 |
| 7624 | recent | 1 | d8c23d171ca7 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | TIMEOUT | 288 |
| 7623 | recent | 1 | 950672e8489f | valid_text_json | blocked | — | ✓/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 365 |
| 7622 | recent | 1 | ac2a79b4ef05 | valid_text_json | blocked | — | ✓/✓/—/✓ | not_run | SCRIPT_UNSUPPORTED | 618 |
| 6109 | recent | 1 | c689dcd33b1f | valid_text_json | blocked | — | ✓/✓/—/— | not_run | SCRIPT_UNSUPPORTED | 344 |
| 3331 | recent | 1 | bc780257f440 | valid_text_json | blocked | — | —/—/—/— | not_run | SCRIPT_UNSUPPORTED | 278 |
| 7619 | recent | 1 | a5340abb6a1a | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 166 |
| 7617 | recent | 1 | 94ac628b454b | valid_text_json | blocked | — | ✓/✓/—/— | not_run | SCRIPT_UNSUPPORTED | 210 |
| 7536 | recent | 1 | e3d0ef8d7ce6 | valid_text_json | blocked | — | —/—/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 251 |
| 7614 | recent | 1 | 194afe7c3066 | valid_text_json | blocked | — | ✓/✓/✓/— | not_run | SCRIPT_UNSUPPORTED | 215 |
| 7613 | recent | 1 | bcdbd8df945b | valid_text_json | blocked | — | —/✓/✓/— | not_run | SCRIPT_UNSUPPORTED | 313 |
| 7612 | recent | 1 | 31c51237141d | valid_text_json | blocked | — | —/✓/✓/— | not_run | SCRIPT_UNSUPPORTED | 201 |
| 7610 | recent | 1 | e51f7dd5a104 | valid_text_json | blocked | — | —/—/—/— | not_run | SCRIPT_UNSUPPORTED | 248 |
| 7609 | recent | 1 | 3915d486c3d4 | valid_text_json | needs_login | ✓ | ✓/✓/✓/— | not_run | LOGIN_REQUIRED | 211 |
| 7607 | recent | 1 | d6b332f542da | valid_text_json | blocked | — | ✓/—/—/— | not_run | SCRIPT_UNSUPPORTED | 214 |
| 7606 | recent | 1 | 2717efa54d19 | valid_text_json | blocked | — | ✓/—/—/— | not_run | SCRIPT_UNSUPPORTED | 263 |
| 7604 | recent | 1 | de804351eab0 | valid_text_json | blocked | — | —/—/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 204 |
| 7603 | recent | 1 | 9de2c939c821 | valid_text_json | blocked | — | ✓/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 203 |
| 7602 | recent | 1 | 149e2604c922 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 228 |
| 7600 | recent | 1 | 6918dfd2d785 | valid_text_json | blocked | — | ✓/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 230 |
| 7597 | recent | 1 | 3ad5e5fd9a23 | valid_text_json | blocked | — | —/—/—/— | not_run | SCRIPT_UNSUPPORTED | 525 |
| 7596 | recent | 1 | 6856da567c44 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | passed |  | 493 |
| 7595 | recent | 1 | 68e3ce2ece5b | valid_text_json | blocked | — | —/—/—/— | not_run | SCRIPT_UNSUPPORTED | 943 |
| 7592 | recent | 1 | 8033b24e1a22 | valid_text_json | blocked | — | —/✓/✓/— | not_run | SCRIPT_UNSUPPORTED | 2101 |
| 7590 | recent | 1 | 3b7349f39afb | valid_text_json | needs_login | ✓ | ✓/✓/✓/✓ | not_run | LOGIN_REQUIRED | 2198 |
| 7589 | recent | 1 | 57a3262bd3e1 | valid_text_json | blocked | — | —/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 1239 |
| 7588 | recent | 1 | c0aac28b6e73 | valid_text_json | blocked | — | —/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 1190 |
| 7587 | recent | 1 | 1f35df84fd24 | valid_text_json | blocked | — | —/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 3748 |
| 7586 | recent | 1 | 9f577256a29c | valid_text_json | blocked | — | —/—/—/✓ | not_run | SCRIPT_UNSUPPORTED | 856 |
| 7585 | recent | 1 | 1dd3ac751a3e | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 1764 |
| 6873 | recent | 1 | 4461b9219891 | valid_text_json | blocked | — | —/—/—/— | not_run | SCRIPT_UNSUPPORTED | 2061 |
| 7583 | recent | 1 | 4f8aed8a1715 | valid_text_json | ready | ✓ | ✓/—/✓/✓ | failed | TIMEOUT | 2091 |
| 7581 | recent | 1 | ae3d8b5d8207 | valid_text_json | blocked | — | —/✓/—/— | not_run | SCRIPT_UNSUPPORTED | 1708 |
| 7574 | recent | 1 | 40a1eb47a048 | valid_text_json | blocked | — | —/—/—/— | not_run | SCRIPT_UNSUPPORTED | 1699 |
| 7573 | recent | 1 | 18be45c38751 | valid_text_json | blocked | — | —/✓/✓/— | not_run | SCRIPT_UNSUPPORTED | 875 |
| 7565 | recent | 1 | 31ded5e9efc7 | valid_text_json | blocked | — | —/✓/✓/— | not_run | SCRIPT_UNSUPPORTED | 1418 |
| 7563 | recent | 1 | 1ef1ba18d37f | valid_text_json | blocked | — | —/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 2308 |
| 7562 | recent | 1 | 5f41e330376b | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | TIMEOUT | 2292 |
| 7561 | recent | 1 | 3fe15f5cc1c0 | valid_text_json | needs_login | ✓ | ✓/✓/—/✓ | not_run | LOGIN_REQUIRED | 1928 |
| 7560 | recent | 1 | 36d0fb310707 | valid_text_json | blocked | — | ✓/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 1881 |
| 7559 | recent | 1 | fae4a08cf860 | valid_text_json | blocked | — | —/✓/—/— | not_run | SCRIPT_UNSUPPORTED | 1877 |
| 7558 | recent | 1 | e8285aabb685 | valid_text_json | blocked | — | —/—/✓/— | not_run | SCRIPT_UNSUPPORTED | 1809 |
| 7557 | recent | 1 | 21d27d94a6a7 | valid_text_json | blocked | — | ✓/✓/✓/— | not_run | SCRIPT_UNSUPPORTED | 1763 |
| 7556 | recent | 1 | 8f973531088b | valid_text_json | blocked | — | ✓/—/✓/— | not_run | SCRIPT_UNSUPPORTED | 1520 |
| 286 | middle | 28 | f5f576b0c34e | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 2304 |
| 288 | middle | 28 | e2a431ab4747 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 2289 |
| 289 | middle | 28 | fbc409b877d4 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 2304 |
| 290 | middle | 28 | 9cd2e28ae6da | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 2304 |
| 291 | middle | 28 | 3bcead8cca1e | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 2296 |
| 293 | middle | 28 | 3131d233d7c3 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 2283 |
| 308 | middle | 28 | 5c781d6a803d | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 2304 |
| 247 | middle | 28 | f59598c88e2e | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | SITE_UNREACHABLE | 2783 |
| 263 | middle | 28 | d044842f3078 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 2369 |
| 264 | middle | 28 | e9b2f632b3be | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 2136 |
| 265 | middle | 28 | 7ba6dbf34104 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 2116 |
| 275 | middle | 28 | c47521b22b6f | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 2352 |
| 277 | middle | 28 | 586a36574958 | valid_text_json | partial | ✓ | —/✓/✓/✓ | not_run | PARTIAL_CAPABILITY | 2360 |
| 303 | middle | 28 | 46f05af59c50 | valid_text_json | blocked | — | ✓/✓/✓/— | not_run | SCRIPT_UNSUPPORTED | 2345 |
| 319 | middle | 28 | 6852329eb981 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 2335 |
| 249 | middle | 28 | 9b926ba2cb24 | valid_text_json | blocked | — | —/—/—/— | not_run | SCRIPT_UNSUPPORTED | 1909 |
| 271 | middle | 28 | cc6dc51a3d5a | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 2712 |
| 272 | middle | 28 | 14ac03a60f78 | valid_text_json | blocked | — | ✓/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 3532 |
| 273 | middle | 28 | a56cc46b1554 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 3330 |
| 278 | middle | 28 | 88dba9b1007c | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 3234 |
| 280 | middle | 28 | 25582bbdb72b | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 2480 |
| 242 | middle | 28 | 62d8e918f5f2 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 2481 |
| 261 | middle | 28 | adee59b0c232 | valid_text_json | needs_login | ✓ | ✓/✓/✓/✓ | not_run | LOGIN_REQUIRED | 3560 |
| 266 | middle | 28 | a15bb3576f9e | valid_text_json | blocked | — | ✓/—/✓/— | not_run | SCRIPT_UNSUPPORTED | 2768 |
| 268 | middle | 28 | 8bf3a5a7189c | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 5923 |
| 269 | middle | 28 | 4f4ca2040879 | valid_text_json | blocked | — | ✓/—/—/✓ | not_run | SCRIPT_UNSUPPORTED | 2999 |
| 257 | middle | 28 | 4ae31743d15f | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 2971 |
| 281 | middle | 28 | 4e14be57fb08 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 1994 |
| 251 | middle | 28 | 3a9a02ffcee1 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 2133 |
| 252 | middle | 28 | 6713ca2143d2 | valid_text_json | blocked | — | —/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 1999 |
| 253 | middle | 28 | 860a88d5f8c4 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 1703 |
| 254 | middle | 28 | 04d6fb26ea5f | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 1528 |
| 255 | middle | 28 | 76bbf21c1c8a | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 1518 |
| 274 | middle | 28 | 0368ffb0cefa | valid_text_json | blocked | — | —/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 1438 |
| 276 | middle | 28 | c26efd3f458f | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_NOT_FOUND | 1429 |
| 294 | middle | 28 | 714eec26efe2 | valid_text_json | partial | ✓ | ✓/—/✓/✓ | not_run | PARTIAL_CAPABILITY | 1723 |
| 203 | middle | 28 | 8e2155e3d4cd | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 1448 |
| 229 | middle | 28 | b3e3c478486a | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 1416 |
| 231 | middle | 28 | 1420369f8069 | valid_text_json | blocked | — | ✓/—/✓/— | not_run | SCRIPT_UNSUPPORTED | 1499 |
| 232 | middle | 28 | bd53c3522d84 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 1431 |
| 235 | middle | 28 | 839ee07dd61a | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_SERVER_ERROR | 1737 |
| 236 | middle | 28 | 207a1a9988a6 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 1721 |
| 238 | middle | 28 | c8624ada2040 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 1705 |
| 243 | middle | 28 | e032b8314c24 | valid_text_json | blocked | — | —/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 1659 |
| 245 | middle | 28 | 938fe0399262 | valid_text_json | blocked | — | —/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 3585 |
| 246 | middle | 28 | 48e7c60b3957 | valid_text_json | blocked | — | —/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 3000 |
| 21 | middle | 28 | 71bdff7c3e72 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 1512 |
| 1709 | middle | 28 | 3a5a839a2050 | valid_text_json | blocked | — | ✓/—/—/✓ | not_run | SCRIPT_UNSUPPORTED | 1572 |
| 194 | middle | 28 | 8eb374a2294b | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | TIMEOUT | 1503 |
| 195 | middle | 28 | eee3ef11c9f7 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 1489 |
| 204 | middle | 28 | 3499f503ffb0 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 1867 |
| 219 | middle | 28 | 6fa60ba4a626 | valid_text_json | blocked | — | —/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 1586 |
| 222 | middle | 28 | 227b01411209 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 1562 |
| 226 | middle | 28 | 99f0d2f51f1d | valid_text_json | blocked | — | —/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 1572 |
| 227 | middle | 28 | 452fd92e8b22 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | SEARCH_EMPTY | 1521 |
| 228 | middle | 28 | 78d1503aa883 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 1543 |
| 230 | middle | 28 | eced1465f46c | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 1310 |
| 233 | middle | 28 | bac7457bf48d | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 1390 |
| 148 | middle | 28 | 0d8a18338164 | valid_text_json | needs_login | ✓ | ✓/✓/✓/✓ | not_run | LOGIN_REQUIRED | 1104 |
| 191 | middle | 28 | 0492d7ae4ed5 | valid_text_json | needs_login | ✓ | ✓/✓/—/✓ | not_run | LOGIN_REQUIRED | 1121 |
| 212 | middle | 28 | b8f55bf19d8a | valid_text_json | blocked | — | ✓/—/✓/— | not_run | SCRIPT_UNSUPPORTED | 1103 |
| 213 | middle | 28 | 7a0b82a17c30 | valid_text_json | needs_login | ✓ | ✓/✓/✓/✓ | not_run | LOGIN_REQUIRED | 1104 |
| 214 | middle | 28 | c6427ea51bdd | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 1500 |
| 215 | middle | 28 | 7f8a6eabdf5a | valid_text_json | partial | ✓ | ✓/✓/✓/✓ | not_run | PARTIAL_CAPABILITY | 1477 |
| 216 | middle | 28 | be38f4fbcc09 | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 1651 |
| 218 | middle | 28 | 0d5adfeca343 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 1634 |
| 234 | middle | 28 | e0d3fbad2c00 | valid_text_json | blocked | — | ✓/—/✓/— | not_run | SCRIPT_UNSUPPORTED | 1617 |
| 2692 | older | 56 | 22d926f057f7 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 1184 |
| 1936 | older | 56 | aa404658a218 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 1120 |
| 2705 | older | 56 | 28e6d7dfb867 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 1092 |
| 2722 | older | 56 | e212225d5a24 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 1532 |
| 1972 | older | 56 | c408e8b05da8 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 1544 |
| 2745 | older | 56 | 94cf2d79db39 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 1507 |
| 2312 | older | 56 | b3f3c92f5a0d | valid_text_json | needs_login | ✓ | ✓/✓/✓/✓ | not_run | LOGIN_REQUIRED | 1376 |
| 2066 | older | 56 | 44da1d4f1254 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | SITE_UNREACHABLE | 1356 |
| 2641 | older | 56 | 4b0b74d15f5f | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | TIMEOUT | 1355 |
| 3161 | older | 56 | 302d1c62531f | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 1354 |
| 2150 | older | 56 | 488e4e8f6e5e | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | SITE_UNREACHABLE | 1354 |
| 2669 | older | 56 | a9566de5620f | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 1557 |
| 2416 | older | 56 | 19de4a55cf82 | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 2072 |
| 1971 | older | 56 | cc03b97ffdfd | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 1393 |
| 1975 | older | 56 | 67df08586654 | valid_text_json | blocked | — | ✓/✓/—/✓ | not_run | SCRIPT_UNSUPPORTED | 1546 |
| 3024 | older | 56 | c96e16d46c9a | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 1546 |
| 3033 | older | 56 | d80d1cc6bb20 | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 1546 |
| 2533 | older | 56 | ff9a645cc639 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 1538 |
| 1776 | older | 56 | a4f9b53e51db | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 1538 |
| 2550 | older | 56 | 068cb2154026 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 1224 |
| 2811 | older | 56 | 6738f2599d43 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | SEARCH_EMPTY | 1312 |
| 3085 | older | 56 | 4be67f878f7f | valid_text_json | blocked | — | ✓/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 1181 |
| 3087 | older | 56 | 44734c6d2510 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | SITE_UNREACHABLE | 1392 |
| 3092 | older | 56 | c8d3f463f191 | valid_text_json | blocked | — | ✓/✓/—/— | not_run | SCRIPT_UNSUPPORTED | 1391 |
| 1831 | older | 56 | 99453189931f | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 1392 |
| 3134 | older | 56 | 0453bbaa6e80 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 1399 |
| 2625 | older | 56 | 1f6da3d11f00 | valid_text_json | ready | ✓ | ✓/—/✓/✓ | failed | HTTP_BLOCKED | 1374 |
| 3154 | older | 56 | da595373d0bf | valid_text_json | ready | ✓ | ✓/—/✓/✓ | failed | NETWORK_ERROR | 1409 |
| 2686 | older | 56 | 1465c467b358 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_NOT_FOUND | 1305 |
| 2968 | older | 56 | c0459462a309 | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 1297 |
| 2503 | older | 56 | 1b48120ff827 | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 1239 |
| 3015 | older | 56 | 563b7b65c50b | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 1266 |
| 2252 | older | 56 | 80ac652f2637 | valid_text_json | blocked | — | ✓/✓/✓/— | not_run | SCRIPT_UNSUPPORTED | 1275 |
| 2520 | older | 56 | ecc161b70053 | valid_text_json | blocked | — | ✓/✓/—/✓ | not_run | SCRIPT_UNSUPPORTED | 3067 |
| 2527 | older | 56 | e0b6087e49af | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 3315 |
| 1779 | older | 56 | ab8229165545 | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 1290 |
| 1815 | older | 56 | ad42ee748c03 | valid_text_json | blocked | — | —/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 1062 |
| 1863 | older | 56 | f3df8fc68479 | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 1062 |
| 2376 | older | 56 | e7d1e678c64a | valid_text_json | partial | ✓ | —/—/✓/✓ | not_run | PARTIAL_CAPABILITY | 2004 |
| 2147 | older | 56 | 7b9b02dcf063 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 1129 |
| 2718 | older | 56 | 60f5950970b5 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 857 |
| 1957 | older | 56 | d4bd1e88bb63 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 1168 |
| 2990 | older | 56 | 4d5fa542ec9c | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 1168 |
| 2223 | older | 56 | 7dc34a9ead4a | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 1379 |
| 2251 | older | 56 | f8d079316330 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 1379 |
| 3019 | older | 56 | 806fe5d62d9c | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 1122 |
| 2006 | older | 56 | 52fb874cf75f | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 1127 |
| 2821 | older | 56 | 99a9d5bd0758 | valid_text_json | needs_login | ✓ | ✓/✓/—/✓ | not_run | LOGIN_REQUIRED | 1061 |
| 1828 | older | 56 | 06c140054a97 | valid_text_json | blocked | — | ✓/—/—/— | not_run | SCRIPT_UNSUPPORTED | 1286 |
| 2859 | older | 56 | 95212094761c | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 888 |
| 3130 | older | 56 | ad62f53276e2 | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 1225 |
| 2901 | older | 56 | 3d656c04f27e | valid_text_json | ready | ✓ | ✓/—/✓/✓ | failed | NETWORK_ERROR | 1234 |
| 1878 | older | 56 | 9d8e5e6d9c41 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 1225 |
| 3175 | older | 56 | bbfb599bdcf2 | valid_text_json | blocked | — | ✓/—/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 1248 |
| 2947 | older | 56 | 6016be6ead6c | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 1528 |
| 2445 | older | 56 | dd08a582f59f | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | TIMEOUT | 1565 |
| 1942 | older | 56 | 67826bc0533d | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 1241 |
| 1955 | older | 56 | 0a35ec90d0c7 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 955 |
| 2764 | older | 56 | 5ed975ae43fc | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 910 |
| 3025 | older | 56 | c85018202864 | valid_text_json | blocked | — | ✓/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 901 |
| 2038 | older | 56 | 629820496fe7 | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 911 |
| 2305 | older | 56 | 01fea8550c20 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 861 |
| 2335 | older | 56 | 49da099a6b53 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 1312 |
| 2856 | older | 56 | 06be9b907a53 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 1248 |
| 2877 | older | 56 | 9cd87598e88e | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_SERVER_ERROR | 1034 |
| 2880 | older | 56 | 8883cee8504c | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 1041 |
| 198 | middle | 28 | dff91ae12993 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 2189 |
| 200 | middle | 28 | f6c3c627aaa1 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 1499 |
| 201 | middle | 28 | 97d1eb8d1cc6 | valid_text_json | blocked | — | —/✓/—/✓ | not_run | SCRIPT_UNSUPPORTED | 1491 |
| 202 | middle | 28 | 57acd114b158 | valid_text_json | blocked | — | —/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 2025 |
| 205 | middle | 28 | 77460c5fbb15 | valid_text_json | blocked | — | —/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 2522 |
| 206 | middle | 28 | 7370b6adf056 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 2514 |
| 208 | middle | 28 | c05066f39b4c | valid_text_json | blocked | — | —/✓/—/✓ | not_run | SCRIPT_UNSUPPORTED | 4011 |
| 209 | middle | 28 | 903f1278348a | valid_text_json | needs_login | ✓ | ✓/✓/—/✓ | not_run | LOGIN_REQUIRED | 4437 |
| 217 | middle | 28 | 71005b38a530 | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 3777 |
| 224 | middle | 28 | bb8b6d9f36b0 | valid_text_json | blocked | — | —/—/✓/— | not_run | SCRIPT_UNSUPPORTED | 3152 |
