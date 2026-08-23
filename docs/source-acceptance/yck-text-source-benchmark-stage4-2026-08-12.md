# YCK 文字书源脱敏验收报告（第四轮，2026-08-12）

- 抓取时间：2026-08-12T13:45:29.598Z
- 分层页面：1、28、56
- 目标样本：200；有效文字 JSON：200
- JSON 导入成功率：100%（分母为有效文字 JSON）
- 静态状态：ready 83 / partial 29 / needs_login 10 / blocked 78 / invalid 0
- 静态候选：34；真实请求后合格分母：4；外部状态排除：30
- 完整阅读实测：2/4；完整阅读率 50%（全部静态候选共测试 34 个）
- 外部状态排除：LOGIN_REQUIRED 1 / TIMEOUT 4 / HTTP_BLOCKED 4 / NETWORK_ERROR 13 / SITE_UNREACHABLE 4 / HTTP_NOT_FOUND 2 / HTTP_SERVER_ERROR 2

> 报告不保存第三方正文、Cookie、Token 或完整书源 JSON；SHA-256 仅用于固定样本版本。未执行真机流程的行标记为 not_run，不能计为通过。

| ID | 层次 | 页 | SHA-256（前 12 位） | 下载 | 状态 | Android | 搜/详/目/文 | 流程 | 错误码 | 耗时(ms) |
|---:|---|---:|---|---|---|---|---|---|---|---:|
| 7697 | recent | 1 | e466765156a8 | valid_text_json | blocked | — | —/✓/—/— | not_run | SCRIPT_UNSUPPORTED | 490 |
| 7700 | recent | 1 | 1b3a3127f7b9 | valid_text_json | blocked | — | —/—/—/— | not_run | SCRIPT_UNSUPPORTED | 936 |
| 7661 | recent | 1 | cb87e179ff79 | valid_text_json | blocked | — | ✓/—/—/— | not_run | SCRIPT_UNSUPPORTED | 6851 |
| 7684 | recent | 1 | 2ade498bf040 | valid_text_json | blocked | — | ✓/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 7249 |
| 7699 | recent | 1 | 819051fa30ed | valid_text_json | blocked | — | ✓/—/—/— | not_run | SCRIPT_UNSUPPORTED | 2723 |
| 7698 | recent | 1 | 403970f6fef6 | valid_text_json | blocked | — | —/—/—/— | not_run | SCRIPT_UNSUPPORTED | 1469 |
| 7688 | recent | 1 | 0d8f3cf8be0a | valid_text_json | blocked | — | ✓/✓/✓/— | not_run | SCRIPT_UNSUPPORTED | 976 |
| 7696 | recent | 1 | 6a4ec0d0324d | valid_text_json | blocked | — | —/✓/—/— | not_run | SCRIPT_UNSUPPORTED | 2283 |
| 7694 | recent | 1 | f965b757e263 | valid_text_json | blocked | — | —/—/—/— | not_run | SCRIPT_UNSUPPORTED | 1828 |
| 7693 | recent | 1 | 621d703526f5 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 869 |
| 7692 | recent | 1 | c7a895d5ec22 | valid_text_json | needs_login | ✓ | ✓/✓/✓/✓ | not_run | LOGIN_REQUIRED | 876 |
| 7691 | recent | 1 | e8239d441d1e | valid_text_json | blocked | — | ✓/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 844 |
| 7689 | recent | 1 | 58d0b3b86604 | valid_text_json | blocked | — | —/—/—/— | not_run | SCRIPT_UNSUPPORTED | 1475 |
| 7679 | recent | 1 | 6039c6412023 | valid_text_json | blocked | — | —/—/—/— | not_run | SCRIPT_UNSUPPORTED | 1994 |
| 7662 | recent | 1 | 0dea1816be17 | valid_text_json | blocked | — | ✓/✓/✓/— | not_run | SCRIPT_UNSUPPORTED | 2049 |
| 7678 | recent | 1 | 01b56f86b57f | valid_text_json | partial | ✓ | —/✓/✓/✓ | not_run | PARTIAL_CAPABILITY | 914 |
| 7677 | recent | 1 | 8a5a5f74ae26 | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 3189 |
| 7674 | recent | 1 | 6c3b3b370fa4 | valid_text_json | blocked | — | ✓/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 3274 |
| 7671 | recent | 1 | 6c02ab0767fe | valid_text_json | partial | ✓ | —/✓/✓/✓ | not_run | PARTIAL_CAPABILITY | 3127 |
| 7672 | recent | 1 | 10e9a26ae5ec | valid_text_json | partial | ✓ | —/✓/✓/✓ | not_run | PARTIAL_CAPABILITY | 3225 |
| 7616 | recent | 1 | b79ec95b1a50 | valid_text_json | blocked | — | —/—/—/— | not_run | SCRIPT_UNSUPPORTED | 2602 |
| 7663 | recent | 1 | c9cc782f5a22 | valid_text_json | blocked | — | —/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 673 |
| 7630 | recent | 1 | 4a05264f666b | valid_text_json | needs_login | ✓ | ✓/✓/✓/✓ | not_run | LOGIN_REQUIRED | 663 |
| 7656 | recent | 1 | c5bee50ea10c | valid_text_json | partial | ✓ | —/✓/✓/✓ | not_run | PARTIAL_CAPABILITY | 201 |
| 7655 | recent | 1 | b113b607e18e | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | passed |  | 161 |
| 7419 | recent | 1 | 4d87a81ef122 | valid_text_json | blocked | — | —/—/—/— | not_run | SCRIPT_UNSUPPORTED | 1704 |
| 7650 | recent | 1 | 77199160d8a3 | valid_text_json | blocked | — | —/—/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 1044 |
| 7649 | recent | 1 | acf4f007ba3d | valid_text_json | blocked | — | ✓/—/✓/— | not_run | SCRIPT_UNSUPPORTED | 188 |
| 7643 | recent | 1 | 95b79814068e | valid_text_json | blocked | — | —/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 203 |
| 7640 | recent | 1 | 5512bcc0c92b | valid_text_json | ready | ✓ | —/✓/✓/✓ | not_run |  | 174 |
| 7639 | recent | 1 | 703bdc8eb648 | valid_text_json | blocked | — | —/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 650 |
| 7637 | recent | 1 | d569b0b839c1 | valid_text_json | blocked | — | —/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 619 |
| 7634 | recent | 1 | c8ec3de253ff | valid_text_json | blocked | — | ✓/—/✓/— | not_run | SCRIPT_UNSUPPORTED | 619 |
| 7633 | recent | 1 | b4d67095e6dd | valid_text_json | blocked | — | —/✓/✓/— | not_run | SCRIPT_UNSUPPORTED | 558 |
| 6807 | recent | 1 | 2ca5973fdae9 | valid_text_json | blocked | — | —/—/—/— | not_run | SCRIPT_UNSUPPORTED | 917 |
| 7632 | recent | 1 | bb230b430f3b | valid_text_json | blocked | — | —/—/—/— | not_run | SCRIPT_UNSUPPORTED | 1091 |
| 7631 | recent | 1 | 911b8bff7117 | valid_text_json | blocked | — | ✓/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 531 |
| 7629 | recent | 1 | 72da403cc19e | valid_text_json | blocked | — | ✓/✓/✓/— | not_run | SCRIPT_UNSUPPORTED | 780 |
| 7628 | recent | 1 | 086703974185 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | LOGIN_REQUIRED | 522 |
| 7624 | recent | 1 | d8c23d171ca7 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | TIMEOUT | 448 |
| 7623 | recent | 1 | 950672e8489f | valid_text_json | blocked | — | ✓/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 302 |
| 7622 | recent | 1 | ac2a79b4ef05 | valid_text_json | blocked | — | ✓/✓/—/✓ | not_run | SCRIPT_UNSUPPORTED | 362 |
| 6109 | recent | 1 | c689dcd33b1f | valid_text_json | blocked | — | ✓/✓/—/— | not_run | SCRIPT_UNSUPPORTED | 908 |
| 3331 | recent | 1 | bc780257f440 | valid_text_json | blocked | — | —/—/—/— | not_run | SCRIPT_UNSUPPORTED | 1881 |
| 7619 | recent | 1 | a5340abb6a1a | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 1049 |
| 7617 | recent | 1 | 94ac628b454b | valid_text_json | blocked | — | ✓/✓/—/— | not_run | SCRIPT_UNSUPPORTED | 775 |
| 7536 | recent | 1 | e3d0ef8d7ce6 | valid_text_json | blocked | — | —/—/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 1190 |
| 7614 | recent | 1 | 194afe7c3066 | valid_text_json | blocked | — | ✓/✓/✓/— | not_run | SCRIPT_UNSUPPORTED | 1172 |
| 7613 | recent | 1 | bcdbd8df945b | valid_text_json | blocked | — | —/✓/✓/— | not_run | SCRIPT_UNSUPPORTED | 2357 |
| 7612 | recent | 1 | 31c51237141d | valid_text_json | blocked | — | —/✓/✓/— | not_run | SCRIPT_UNSUPPORTED | 1595 |
| 7610 | recent | 1 | e51f7dd5a104 | valid_text_json | blocked | — | —/—/—/— | not_run | SCRIPT_UNSUPPORTED | 3241 |
| 7609 | recent | 1 | 3915d486c3d4 | valid_text_json | needs_login | ✓ | ✓/✓/✓/— | not_run | LOGIN_REQUIRED | 1397 |
| 7607 | recent | 1 | d6b332f542da | valid_text_json | blocked | — | ✓/—/—/— | not_run | SCRIPT_UNSUPPORTED | 1226 |
| 7606 | recent | 1 | 2717efa54d19 | valid_text_json | blocked | — | ✓/—/—/— | not_run | SCRIPT_UNSUPPORTED | 1225 |
| 7604 | recent | 1 | de804351eab0 | valid_text_json | blocked | — | —/—/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 362 |
| 7603 | recent | 1 | 9de2c939c821 | valid_text_json | blocked | — | ✓/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 569 |
| 7602 | recent | 1 | 149e2604c922 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 846 |
| 7600 | recent | 1 | 6918dfd2d785 | valid_text_json | blocked | — | ✓/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 1225 |
| 7597 | recent | 1 | 3ad5e5fd9a23 | valid_text_json | blocked | — | —/—/—/— | not_run | SCRIPT_UNSUPPORTED | 1223 |
| 7596 | recent | 1 | 6856da567c44 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | passed |  | 795 |
| 7595 | recent | 1 | 68e3ce2ece5b | valid_text_json | blocked | — | —/—/—/— | not_run | SCRIPT_UNSUPPORTED | 1199 |
| 7592 | recent | 1 | 8033b24e1a22 | valid_text_json | blocked | — | —/✓/✓/— | not_run | SCRIPT_UNSUPPORTED | 379 |
| 7590 | recent | 1 | 3b7349f39afb | valid_text_json | needs_login | ✓ | ✓/✓/✓/✓ | not_run | LOGIN_REQUIRED | 720 |
| 7589 | recent | 1 | 57a3262bd3e1 | valid_text_json | blocked | — | —/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 703 |
| 7588 | recent | 1 | c0aac28b6e73 | valid_text_json | blocked | — | —/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 669 |
| 7587 | recent | 1 | 1f35df84fd24 | valid_text_json | blocked | — | —/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 380 |
| 7586 | recent | 1 | 9f577256a29c | valid_text_json | blocked | — | —/—/—/✓ | not_run | SCRIPT_UNSUPPORTED | 420 |
| 288 | middle | 28 | e2a431ab4747 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 211 |
| 289 | middle | 28 | fbc409b877d4 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 203 |
| 290 | middle | 28 | 9cd2e28ae6da | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 202 |
| 291 | middle | 28 | 3bcead8cca1e | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 245 |
| 293 | middle | 28 | 3131d233d7c3 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 243 |
| 308 | middle | 28 | 5c781d6a803d | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 224 |
| 247 | middle | 28 | f59598c88e2e | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | SITE_UNREACHABLE | 281 |
| 263 | middle | 28 | d044842f3078 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 268 |
| 264 | middle | 28 | e9b2f632b3be | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 210 |
| 265 | middle | 28 | 7ba6dbf34104 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 248 |
| 275 | middle | 28 | c47521b22b6f | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 427 |
| 277 | middle | 28 | 586a36574958 | valid_text_json | partial | ✓ | —/✓/✓/✓ | not_run | PARTIAL_CAPABILITY | 412 |
| 303 | middle | 28 | 46f05af59c50 | valid_text_json | blocked | — | ✓/✓/✓/— | not_run | SCRIPT_UNSUPPORTED | 413 |
| 319 | middle | 28 | 6852329eb981 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 399 |
| 249 | middle | 28 | 9b926ba2cb24 | valid_text_json | blocked | — | —/—/—/— | not_run | SCRIPT_UNSUPPORTED | 374 |
| 271 | middle | 28 | cc6dc51a3d5a | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 333 |
| 272 | middle | 28 | 14ac03a60f78 | valid_text_json | blocked | — | ✓/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 333 |
| 273 | middle | 28 | a56cc46b1554 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 256 |
| 278 | middle | 28 | 88dba9b1007c | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 229 |
| 280 | middle | 28 | 25582bbdb72b | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 175 |
| 242 | middle | 28 | 62d8e918f5f2 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 201 |
| 261 | middle | 28 | adee59b0c232 | valid_text_json | needs_login | ✓ | ✓/✓/✓/✓ | not_run | LOGIN_REQUIRED | 201 |
| 266 | middle | 28 | a15bb3576f9e | valid_text_json | blocked | — | ✓/—/✓/— | not_run | SCRIPT_UNSUPPORTED | 201 |
| 268 | middle | 28 | 8bf3a5a7189c | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 202 |
| 269 | middle | 28 | 4f4ca2040879 | valid_text_json | blocked | — | ✓/—/—/✓ | not_run | SCRIPT_UNSUPPORTED | 204 |
| 257 | middle | 28 | 4ae31743d15f | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 196 |
| 281 | middle | 28 | 4e14be57fb08 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 169 |
| 248 | middle | 28 | 596d403f05cb | valid_text_json | blocked | — | —/—/—/— | not_run | SCRIPT_UNSUPPORTED | 230 |
| 250 | middle | 28 | cdc747857e51 | valid_text_json | blocked | — | —/—/—/— | not_run | SCRIPT_UNSUPPORTED | 213 |
| 251 | middle | 28 | 3a9a02ffcee1 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 210 |
| 252 | middle | 28 | 6713ca2143d2 | valid_text_json | blocked | — | —/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 210 |
| 253 | middle | 28 | 860a88d5f8c4 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 212 |
| 254 | middle | 28 | 04d6fb26ea5f | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 210 |
| 255 | middle | 28 | 76bbf21c1c8a | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 207 |
| 274 | middle | 28 | 0368ffb0cefa | valid_text_json | blocked | — | —/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 159 |
| 276 | middle | 28 | c26efd3f458f | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_NOT_FOUND | 180 |
| 294 | middle | 28 | 714eec26efe2 | valid_text_json | partial | ✓ | ✓/—/✓/✓ | not_run | PARTIAL_CAPABILITY | 235 |
| 203 | middle | 28 | 8e2155e3d4cd | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 236 |
| 229 | middle | 28 | b3e3c478486a | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 237 |
| 231 | middle | 28 | 1420369f8069 | valid_text_json | blocked | — | ✓/—/✓/— | not_run | SCRIPT_UNSUPPORTED | 234 |
| 232 | middle | 28 | bd53c3522d84 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 232 |
| 235 | middle | 28 | 839ee07dd61a | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_SERVER_ERROR | 216 |
| 236 | middle | 28 | 207a1a9988a6 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 168 |
| 238 | middle | 28 | c8624ada2040 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 184 |
| 243 | middle | 28 | e032b8314c24 | valid_text_json | blocked | — | —/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 227 |
| 244 | middle | 28 | 893e32652bbf | valid_text_json | blocked | — | ✓/✓/✓/— | not_run | SCRIPT_UNSUPPORTED | 332 |
| 245 | middle | 28 | 938fe0399262 | valid_text_json | blocked | — | —/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 228 |
| 246 | middle | 28 | 48e7c60b3957 | valid_text_json | blocked | — | —/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 226 |
| 21 | middle | 28 | 71bdff7c3e72 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 225 |
| 1709 | middle | 28 | 3a5a839a2050 | valid_text_json | blocked | — | ✓/—/—/✓ | not_run | SCRIPT_UNSUPPORTED | 207 |
| 194 | middle | 28 | 8eb374a2294b | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | TIMEOUT | 161 |
| 195 | middle | 28 | eee3ef11c9f7 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 168 |
| 204 | middle | 28 | 3499f503ffb0 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 188 |
| 219 | middle | 28 | 6fa60ba4a626 | valid_text_json | blocked | — | —/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 235 |
| 222 | middle | 28 | 227b01411209 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 235 |
| 226 | middle | 28 | 99f0d2f51f1d | valid_text_json | blocked | — | —/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 236 |
| 227 | middle | 28 | 452fd92e8b22 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | SEARCH_EMPTY | 234 |
| 228 | middle | 28 | 78d1503aa883 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 209 |
| 230 | middle | 28 | eced1465f46c | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 215 |
| 233 | middle | 28 | bac7457bf48d | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 210 |
| 148 | middle | 28 | 0d8a18338164 | valid_text_json | needs_login | ✓ | ✓/✓/✓/✓ | not_run | LOGIN_REQUIRED | 211 |
| 191 | middle | 28 | 0492d7ae4ed5 | valid_text_json | needs_login | ✓ | ✓/✓/—/✓ | not_run | LOGIN_REQUIRED | 255 |
| 212 | middle | 28 | b8f55bf19d8a | valid_text_json | blocked | — | ✓/—/✓/— | not_run | SCRIPT_UNSUPPORTED | 255 |
| 213 | middle | 28 | 7a0b82a17c30 | valid_text_json | needs_login | ✓ | ✓/✓/✓/✓ | not_run | LOGIN_REQUIRED | 254 |
| 214 | middle | 28 | c6427ea51bdd | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 209 |
| 215 | middle | 28 | 7f8a6eabdf5a | valid_text_json | partial | ✓ | ✓/✓/✓/✓ | not_run | PARTIAL_CAPABILITY | 217 |
| 216 | middle | 28 | be38f4fbcc09 | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 210 |
| 1936 | older | 56 | aa404658a218 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 222 |
| 2705 | older | 56 | 28e6d7dfb867 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 203 |
| 2722 | older | 56 | e212225d5a24 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 187 |
| 1972 | older | 56 | c408e8b05da8 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 201 |
| 2745 | older | 56 | 94cf2d79db39 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 203 |
| 2312 | older | 56 | b3f3c92f5a0d | valid_text_json | needs_login | ✓ | ✓/✓/✓/✓ | not_run | LOGIN_REQUIRED | 202 |
| 2066 | older | 56 | 44da1d4f1254 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | SITE_UNREACHABLE | 227 |
| 2641 | older | 56 | 4b0b74d15f5f | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | TIMEOUT | 204 |
| 3161 | older | 56 | 302d1c62531f | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 201 |
| 2150 | older | 56 | 488e4e8f6e5e | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | SITE_UNREACHABLE | 204 |
| 2669 | older | 56 | a9566de5620f | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 202 |
| 2416 | older | 56 | 19de4a55cf82 | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 183 |
| 1971 | older | 56 | cc03b97ffdfd | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 191 |
| 1975 | older | 56 | 67df08586654 | valid_text_json | blocked | — | ✓/✓/—/✓ | not_run | SCRIPT_UNSUPPORTED | 187 |
| 3024 | older | 56 | c96e16d46c9a | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 245 |
| 3033 | older | 56 | d80d1cc6bb20 | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 244 |
| 2533 | older | 56 | ff9a645cc639 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 219 |
| 1776 | older | 56 | a4f9b53e51db | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 220 |
| 2550 | older | 56 | 068cb2154026 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 220 |
| 2811 | older | 56 | 6738f2599d43 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | SEARCH_EMPTY | 204 |
| 3085 | older | 56 | 4be67f878f7f | valid_text_json | blocked | — | ✓/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 221 |
| 3087 | older | 56 | 44734c6d2510 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | SITE_UNREACHABLE | 241 |
| 3092 | older | 56 | c8d3f463f191 | valid_text_json | blocked | — | ✓/✓/—/— | not_run | SCRIPT_UNSUPPORTED | 295 |
| 1831 | older | 56 | 99453189931f | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 243 |
| 3134 | older | 56 | 0453bbaa6e80 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 293 |
| 2625 | older | 56 | 1f6da3d11f00 | valid_text_json | ready | ✓ | ✓/—/✓/✓ | failed | HTTP_BLOCKED | 243 |
| 3154 | older | 56 | da595373d0bf | valid_text_json | ready | ✓ | ✓/—/✓/✓ | failed | NETWORK_ERROR | 242 |
| 2686 | older | 56 | 1465c467b358 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_NOT_FOUND | 235 |
| 2968 | older | 56 | c0459462a309 | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 190 |
| 2503 | older | 56 | 1b48120ff827 | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 210 |
| 3015 | older | 56 | 563b7b65c50b | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 236 |
| 2252 | older | 56 | 80ac652f2637 | valid_text_json | blocked | — | ✓/✓/✓/— | not_run | SCRIPT_UNSUPPORTED | 234 |
| 2520 | older | 56 | ecc161b70053 | valid_text_json | blocked | — | ✓/✓/—/✓ | not_run | SCRIPT_UNSUPPORTED | 192 |
| 2527 | older | 56 | e0b6087e49af | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 187 |
| 1779 | older | 56 | ab8229165545 | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 218 |
| 1815 | older | 56 | ad42ee748c03 | valid_text_json | blocked | — | —/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 219 |
| 1863 | older | 56 | f3df8fc68479 | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 195 |
| 2376 | older | 56 | e7d1e678c64a | valid_text_json | partial | ✓ | —/—/✓/✓ | not_run | PARTIAL_CAPABILITY | 211 |
| 2147 | older | 56 | 7b9b02dcf063 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 211 |
| 2718 | older | 56 | 60f5950970b5 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 246 |
| 1957 | older | 56 | d4bd1e88bb63 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 244 |
| 2990 | older | 56 | 4d5fa542ec9c | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 211 |
| 2223 | older | 56 | 7dc34a9ead4a | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 210 |
| 2251 | older | 56 | f8d079316330 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 211 |
| 3019 | older | 56 | 806fe5d62d9c | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 228 |
| 2006 | older | 56 | 52fb874cf75f | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 228 |
| 2821 | older | 56 | 99a9d5bd0758 | valid_text_json | needs_login | ✓ | ✓/✓/—/✓ | not_run | LOGIN_REQUIRED | 193 |
| 1828 | older | 56 | 06c140054a97 | valid_text_json | blocked | — | ✓/—/—/— | not_run | SCRIPT_UNSUPPORTED | 297 |
| 2859 | older | 56 | 95212094761c | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 234 |
| 3130 | older | 56 | ad62f53276e2 | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 234 |
| 2901 | older | 56 | 3d656c04f27e | valid_text_json | ready | ✓ | ✓/—/✓/✓ | failed | NETWORK_ERROR | 232 |
| 1878 | older | 56 | 9d8e5e6d9c41 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 230 |
| 3175 | older | 56 | bbfb599bdcf2 | valid_text_json | blocked | — | ✓/—/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 228 |
| 2947 | older | 56 | 6016be6ead6c | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 227 |
| 2445 | older | 56 | dd08a582f59f | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | TIMEOUT | 227 |
| 1942 | older | 56 | 67826bc0533d | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 835 |
| 1955 | older | 56 | 0a35ec90d0c7 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 269 |
| 2764 | older | 56 | 5ed975ae43fc | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 227 |
| 3025 | older | 56 | c85018202864 | valid_text_json | blocked | — | ✓/✓/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 207 |
| 2038 | older | 56 | 629820496fe7 | valid_text_json | partial | ✓ | —/—/—/— | not_run | PARTIAL_CAPABILITY | 207 |
| 2305 | older | 56 | 01fea8550c20 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 210 |
| 2314 | older | 56 | 991da02eaefa | valid_text_json | partial | ✓ | ✓/✓/—/✓ | not_run | PARTIAL_CAPABILITY | 210 |
| 1819 | older | 56 | c0384234114b | valid_text_json | blocked | — | —/—/✓/✓ | not_run | SCRIPT_UNSUPPORTED | 203 |
| 2335 | older | 56 | 49da099a6b53 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 351 |
| 2856 | older | 56 | 06be9b907a53 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | not_run |  | 429 |
| 2877 | older | 56 | 9cd87598e88e | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_SERVER_ERROR | 534 |
