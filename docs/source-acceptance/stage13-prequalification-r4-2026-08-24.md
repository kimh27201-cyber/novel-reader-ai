# YCK 文字书源脱敏验收报告（2026-08-11）

- 抓取时间：2026-08-23T17:38:06.263Z
- 分层页面：1、2、3、4、5、6、7、8、9、10、11、12、13、14、15、16、17、18、19、20、21、22、23、24、25、26、27、28、29、30、31、32、33、34、35、36、37、38、39、40、41、42、43、44、45、46、47、48、49、50、51、52、53、54、55、56、57
- 目标样本：200；有效文字 JSON：200
- JSON 导入成功率：100%（分母为有效文字 JSON）
- 静态状态：ready 200 / partial 0 / needs_login 0 / blocked 0 / invalid 0
- 静态候选：200；真实请求后合格分母：55；外部状态排除：145
- 完整阅读实测：29/55；完整阅读率 52.73%（全部静态候选共测试 200 个）
- 外部状态排除：HTTP_BLOCKED 54 / SITE_UNREACHABLE 1 / TIMEOUT 15 / NETWORK_ERROR 51 / LOGIN_REQUIRED 1 / HTTP_NOT_FOUND 15 / HTTP_SERVER_ERROR 7 / CAPTCHA_REQUIRED 1

> 报告不保存第三方正文、Cookie、Token 或完整书源 JSON；SHA-256 仅用于固定样本版本。未执行真机流程的行标记为 not_run，不能计为通过。

| ID | 层次 | 页 | SHA-256（前 12 位） | 下载 | 状态 | Android | 搜/详/目/文 | 流程 | 错误码 | 耗时(ms) |
|---:|---|---:|---|---|---|---|---|---|---|---:|
| 7711 | recent | 1 | 5ac9f7e9d949 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 420 |
| 7596 | middle | 2 | 6856da567c44 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | passed |  | 387 |
| 2623 | older | 57 | 6236e5a94153 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | SITE_UNREACHABLE | 397 |
| 7655 | recent | 1 | b113b607e18e | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | passed |  | 384 |
| 7583 | middle | 2 | 4f8aed8a1715 | valid_text_json | ready | ✓ | ✓/—/✓/✓ | failed | TIMEOUT | 391 |
| 2706 | older | 57 | f9b811ef931e | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 280 |
| 7628 | recent | 1 | 086703974185 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | LOGIN_REQUIRED | 397 |
| 7562 | middle | 2 | 5f41e330376b | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | TIMEOUT | 436 |
| 2258 | older | 57 | 60bbb849e6e6 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 175 |
| 7624 | recent | 1 | d8c23d171ca7 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | TIMEOUT | 202 |
| 7549 | middle | 2 | da1622caaff4 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | passed |  | 249 |
| 2759 | older | 57 | 84c25df1adf2 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 248 |
| 7619 | recent | 1 | a5340abb6a1a | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 267 |
| 7543 | middle | 2 | 07bee8df8834 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 259 |
| 2027 | older | 57 | 439eb6541c6e | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 250 |
| 7515 | middle | 2 | b985bcf5c2b8 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | PARSE_EMPTY | 251 |
| 3000 | older | 57 | 5e7ae765c6fb | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 217 |
| 7497 | middle | 2 | 6391891efaea | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 598 |
| 2507 | older | 57 | 9ee835f618cc | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_NOT_FOUND | 540 |
| 7415 | middle | 2 | c0eed0b8614e | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | PARSE_EMPTY | 549 |
| 7406 | middle | 2 | abcac613997c | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | passed |  | 552 |
| 7400 | middle | 2 | 90d0e8fc0874 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | TIMEOUT | 551 |
| 7390 | middle | 2 | 1254af3ff34b | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 544 |
| 7388 | middle | 2 | 60eb8ce3911e | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 510 |
| 7382 | middle | 2 | d9e46db1de81 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_SERVER_ERROR | 499 |
| 7259 | middle | 3 | 2ed26bb6fdfa | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 238 |
| 6979 | middle | 3 | 4e226435e780 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 237 |
| 7319 | middle | 3 | f62472388e08 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | passed |  | 228 |
| 7298 | middle | 3 | 7a1ca5b78613 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_SERVER_ERROR | 176 |
| 7285 | middle | 3 | ad6daaa3d0e5 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 237 |
| 7279 | middle | 3 | 8b570738e2fd | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 261 |
| 7163 | middle | 3 | e2016c41feba | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_SERVER_ERROR | 226 |
| 7132 | middle | 3 | 505c94a37567 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 237 |
| 7155 | middle | 3 | 53b39df0e6b6 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | passed |  | 170 |
| 7151 | middle | 3 | 3ddd53a4f0a5 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 249 |
| 7133 | middle | 3 | bfb053ed9dcd | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | PARSE_EMPTY | 193 |
| 7131 | middle | 3 | e0d76342bba5 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | passed |  | 250 |
| 7124 | middle | 3 | 5ff985cd38e5 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 249 |
| 7107 | middle | 3 | c2a2f68552fd | valid_text_json | ready | ✓ | ✓/—/✓/✓ | failed | NETWORK_ERROR | 250 |
| 7068 | middle | 3 | 61948555ad94 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 239 |
| 7066 | middle | 3 | 3381584b40f8 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_NOT_FOUND | 262 |
| 7064 | middle | 3 | 2f217bce94f3 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | passed |  | 219 |
| 7059 | middle | 3 | bab72271262b | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 212 |
| 7027 | middle | 3 | 5653b5a4cc36 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 264 |
| 7025 | middle | 3 | e86c4d92f58f | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | TOC_EMPTY | 229 |
| 6998 | middle | 4 | 1f384abf86e2 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | passed |  | 263 |
| 6994 | middle | 4 | 2acbf26530ea | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_SERVER_ERROR | 262 |
| 6931 | middle | 4 | 25bc88871fa6 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | passed |  | 262 |
| 6917 | middle | 4 | a6983008d8be | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 217 |
| 6906 | middle | 4 | 0a4ea9fefbf8 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_NOT_FOUND | 174 |
| 6897 | middle | 4 | ff57ecce2cca | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 1303 |
| 6896 | middle | 4 | f7e8edb2ab9c | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | CAPTCHA_REQUIRED | 1229 |
| 6890 | middle | 4 | e26b8db86fb1 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 1205 |
| 6875 | middle | 4 | 41e8d2447f96 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 1206 |
| 6834 | middle | 4 | 6338eba2fc37 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 1205 |
| 6813 | middle | 4 | 51643b495fff | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 1207 |
| 6808 | middle | 4 | 237d90206d6a | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | passed |  | 1205 |
| 6792 | middle | 4 | 9edd19c58b86 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 1206 |
| 6785 | middle | 4 | c20bf227ef36 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | TIMEOUT | 411 |
| 6775 | middle | 4 | bf14b1edad7c | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | passed |  | 412 |
| 6774 | middle | 4 | 38e505392fe1 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 401 |
| 6772 | middle | 4 | 2c0a520f31ca | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 390 |
| 6771 | middle | 4 | c634ec839047 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | TIMEOUT | 391 |
| 6763 | middle | 4 | 4f15fcea24a3 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | PARSE_EMPTY | 390 |
| 6754 | middle | 4 | c603adc92a93 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | passed |  | 399 |
| 6752 | middle | 4 | b0380eab73e1 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | PARSE_EMPTY | 400 |
| 6750 | middle | 4 | 3cd6ed04e0c6 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_NOT_FOUND | 202 |
| 6689 | middle | 4 | f12792ca2ae3 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 241 |
| 6736 | middle | 4 | 20a6b31df025 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 241 |
| 6715 | middle | 4 | a07485c8f5ad | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_NOT_FOUND | 241 |
| 6714 | middle | 4 | 6904e9dc214b | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_SERVER_ERROR | 284 |
| 6713 | middle | 4 | 74fd3efd97cc | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | PARSE_EMPTY | 261 |
| 6705 | middle | 5 | 981b4bcc968f | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 251 |
| 6697 | middle | 5 | d31ac3dd7270 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 250 |
| 6687 | middle | 5 | 971667e8e4dd | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 185 |
| 6678 | middle | 5 | 092415036f94 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_NOT_FOUND | 242 |
| 6656 | middle | 5 | 53057c7c259b | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_NOT_FOUND | 208 |
| 6645 | middle | 5 | ad1c1027beb8 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | passed |  | 241 |
| 6619 | middle | 5 | 766565b54072 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 243 |
| 6618 | middle | 5 | e06616e24650 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | PARSE_EMPTY | 233 |
| 6612 | middle | 5 | 8032939ed6d3 | valid_text_json | ready | ✓ | ✓/—/✓/✓ | failed | NETWORK_ERROR | 243 |
| 6597 | middle | 5 | 228eec5a3114 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 220 |
| 6491 | middle | 5 | 281d4b9e73b1 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | TIMEOUT | 173 |
| 6557 | middle | 5 | da7490d51efc | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 187 |
| 6543 | middle | 5 | 9afc8a2ee4ab | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | CONTENT_EMPTY | 270 |
| 6540 | middle | 5 | b2769453cb54 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 228 |
| 6535 | middle | 5 | 3a30f00fdab3 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | TIMEOUT | 271 |
| 6534 | middle | 5 | bd5927952b29 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | TIMEOUT | 260 |
| 6530 | middle | 5 | 214c975d95e7 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_NOT_FOUND | 260 |
| 6507 | middle | 5 | 75bf6bac46fb | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 262 |
| 6506 | middle | 5 | 6f7fde0d5304 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | passed |  | 204 |
| 6500 | middle | 5 | 4922620a835b | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | TIMEOUT | 207 |
| 6488 | middle | 5 | 5e4e2de32e94 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_NOT_FOUND | 234 |
| 6453 | middle | 5 | db73423058c0 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 253 |
| 6438 | middle | 5 | e25a028dc269 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | passed |  | 252 |
| 6429 | middle | 5 | bc1a185bdc81 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 259 |
| 6392 | middle | 6 | e5e4144c198b | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | TOC_EMPTY | 251 |
| 6336 | middle | 6 | 963ad5d74c2c | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_NOT_FOUND | 259 |
| 6326 | middle | 6 | d481ce8b065f | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 250 |
| 6322 | middle | 6 | 591bc789971a | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | PARSE_EMPTY | 210 |
| 6311 | middle | 6 | 17273d0fa726 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | passed |  | 209 |
| 6306 | middle | 6 | 9410e0435aa1 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | PARSE_EMPTY | 274 |
| 6305 | middle | 6 | 1693abb16703 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | passed |  | 224 |
| 6293 | middle | 6 | c4b35d295ead | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 286 |
| 6288 | middle | 6 | 4371cbf47e96 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 277 |
| 6281 | middle | 6 | f46acb26edd0 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 268 |
| 6265 | middle | 6 | 10091358f4d8 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 268 |
| 6248 | middle | 6 | 4f737fc0f19c | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 227 |
| 6247 | middle | 6 | 4b1a2a823a24 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | passed |  | 229 |
| 6235 | middle | 6 | 1b502daf30a0 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 198 |
| 6240 | middle | 6 | 9cb47c7f783d | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | SEARCH_EMPTY | 264 |
| 6238 | middle | 6 | d6f80ece85aa | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | PARSE_EMPTY | 219 |
| 6187 | middle | 7 | 10f77b1e8189 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | TIMEOUT | 264 |
| 6174 | middle | 7 | 7108da1bd2d0 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 264 |
| 6173 | middle | 7 | d7ec99151f66 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 263 |
| 6160 | middle | 7 | 1306871b0a14 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | passed |  | 255 |
| 6159 | middle | 7 | cfa62509a3c0 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | passed |  | 235 |
| 6148 | middle | 7 | db738d1aaf99 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 232 |
| 6138 | middle | 7 | ec67701a702b | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 235 |
| 6128 | middle | 7 | e77cac1ccc43 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 250 |
| 6121 | middle | 7 | f76fb5610180 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 308 |
| 6117 | middle | 7 | 9b70c1467297 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 250 |
| 6103 | middle | 7 | 06eabd84ac8e | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 250 |
| 6102 | middle | 7 | 7021d8cf9121 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | TIMEOUT | 250 |
| 6071 | middle | 7 | adfe41394ab1 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 235 |
| 6064 | middle | 7 | b2af2dafe015 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | TIMEOUT | 250 |
| 6050 | middle | 8 | 379d12c57b42 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 261 |
| 6034 | middle | 8 | 92801b83a1c1 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 260 |
| 6031 | middle | 8 | dd927e7ed828 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 260 |
| 6022 | middle | 8 | a7c8f6804c98 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_NOT_FOUND | 261 |
| 5999 | middle | 8 | 8cb62a5ad38d | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 262 |
| 5998 | middle | 8 | 587c78bf2741 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | PARSE_EMPTY | 261 |
| 3963 | middle | 8 | a585a8ae10d9 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_SERVER_ERROR | 261 |
| 5992 | middle | 8 | d32d3187167a | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_SERVER_ERROR | 252 |
| 5985 | middle | 8 | 632519c9734a | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 215 |
| 5957 | middle | 8 | 18efdfd0fca2 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 226 |
| 5950 | middle | 8 | 6213c8739ef0 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_NOT_FOUND | 296 |
| 5939 | middle | 8 | 67891e7ff6c8 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | PARSE_EMPTY | 295 |
| 5934 | middle | 8 | 6a03a35337c3 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 294 |
| 5928 | middle | 8 | 04ec7f9b8584 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 236 |
| 5912 | middle | 8 | d2530dcb4034 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 293 |
| 5918 | middle | 8 | 17af84161e5e | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 248 |
| 5915 | middle | 8 | 347b00a7bb46 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | PARSE_EMPTY | 246 |
| 5911 | middle | 8 | f97a98dc9561 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | PARSE_EMPTY | 228 |
| 5899 | middle | 8 | e9039eaabbe7 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 215 |
| 5897 | middle | 9 | c383e5a74079 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | passed |  | 260 |
| 5895 | middle | 9 | b3f03f92e0a3 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 259 |
| 5893 | middle | 9 | 4b6d28f3781a | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | passed |  | 261 |
| 5892 | middle | 9 | 8f845fce14de | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 199 |
| 5890 | middle | 9 | 7fb93c68d782 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 254 |
| 5889 | middle | 9 | f03186cc092c | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 254 |
| 5852 | middle | 9 | 4b59d43dcfc3 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 260 |
| 5848 | middle | 9 | c030083eaa55 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 263 |
| 5846 | middle | 9 | b7d4f69d7bc8 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 276 |
| 5845 | middle | 9 | 9203c3da565a | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 279 |
| 5843 | middle | 9 | a0427b6e4a4c | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 277 |
| 5825 | middle | 9 | cdd13680021a | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 276 |
| 5823 | middle | 9 | 942dab540d38 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | passed |  | 295 |
| 5816 | middle | 9 | fbe9dfe28de7 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 234 |
| 5815 | middle | 9 | 2b6ca32693fd | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 252 |
| 5814 | middle | 9 | 564eb1adc925 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 244 |
| 5813 | middle | 9 | 85fe7375257d | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | PARSE_EMPTY | 236 |
| 5807 | middle | 9 | 290fd5e8e82c | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | passed |  | 234 |
| 5804 | middle | 9 | 70108f017df8 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | PARSE_EMPTY | 233 |
| 5802 | middle | 9 | ebe852a3b1c6 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 235 |
| 5795 | middle | 9 | 9d3835cf49d0 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | PARSE_EMPTY | 227 |
| 5776 | middle | 9 | 4e8c53b68820 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 266 |
| 5775 | middle | 9 | ae368071599f | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | SEARCH_EMPTY | 252 |
| 5774 | middle | 9 | c035442e8872 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 250 |
| 5769 | middle | 9 | d95773f5bcc0 | valid_text_json | ready | ✓ | ✓/—/✓/✓ | failed | NETWORK_ERROR | 200 |
| 5766 | middle | 10 | 9db8bd91eea2 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 248 |
| 5752 | middle | 10 | 76433ca21219 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 247 |
| 5747 | middle | 10 | b7db20fa32c3 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | PARSE_EMPTY | 248 |
| 5727 | middle | 10 | 0e4320e12a6a | valid_text_json | ready | ✓ | ✓/—/✓/✓ | failed | NETWORK_ERROR | 198 |
| 5717 | middle | 10 | 654e9bc99774 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 298 |
| 5709 | middle | 10 | 2f96fcc5c7cf | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | passed |  | 247 |
| 5707 | middle | 10 | 460f1f4f69d9 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 237 |
| 5693 | middle | 10 | 7ac386455d72 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | PARSE_EMPTY | 238 |
| 5692 | middle | 10 | b76f54052afa | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 240 |
| 5690 | middle | 10 | 7afc305bd02e | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_NOT_FOUND | 274 |
| 5676 | middle | 10 | a74cc75ab928 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_NOT_FOUND | 275 |
| 5658 | middle | 10 | 6bbee8627b22 | valid_text_json | ready | ✓ | ✓/—/✓/✓ | failed | PARSE_EMPTY | 240 |
| 5656 | middle | 10 | f77f50a9d1a1 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | TIMEOUT | 216 |
| 5644 | middle | 10 | 6dfd76a64103 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | passed |  | 274 |
| 5642 | middle | 10 | c304c073f8b4 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 234 |
| 5641 | middle | 10 | 556ac43ec68a | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 234 |
| 5635 | middle | 10 | 65fe22cfa42d | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 243 |
| 5629 | middle | 10 | d95e26c2285b | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 244 |
| 5626 | middle | 10 | 2e1e172c5912 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 268 |
| 5621 | middle | 10 | d74348c9b74b | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | passed |  | 268 |
| 5602 | middle | 10 | f355d720f36a | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_NOT_FOUND | 235 |
| 5586 | middle | 11 | eb341f8f9503 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 301 |
| 5582 | middle | 11 | 0bb80321452a | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 301 |
| 5571 | middle | 11 | 58c334b1478c | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 502 |
| 5561 | middle | 11 | cca41fd6fd5f | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 444 |
| 5560 | middle | 11 | 29111704fbb1 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 494 |
| 5539 | middle | 11 | 4688515f47cc | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | TIMEOUT | 486 |
| 5519 | middle | 11 | 2125e4fb2bc2 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 434 |
| 5513 | middle | 11 | 56bb0cf21af2 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | PARSE_EMPTY | 428 |
| 5505 | middle | 11 | 1612d65a887b | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | passed |  | 304 |
