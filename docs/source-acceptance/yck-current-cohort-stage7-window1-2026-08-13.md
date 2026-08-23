# YCK 文字书源脱敏验收报告（2026-08-11）

- 抓取时间：2026-08-13T07:47:19.021Z
- 分层页面：1、2、3、4、5、6、7、8、9、10、11、12、13、14、15、16、17、18、19、20、21、22、23、24、25、26、27、28、29、30、31、32、33、34、35、36、37、38、39、40、41、42、43、44、45、46、47、48、49、50、51、52、53、54、55、56、57
- 目标样本：120；有效文字 JSON：120
- JSON 导入成功率：100%（分母为有效文字 JSON）
- 静态状态：ready 120 / partial 0 / needs_login 0 / blocked 0 / invalid 0
- 静态候选：120；真实请求后合格分母：33；外部状态排除：87
- 完整阅读实测：9/33；完整阅读率 27.27%（全部静态候选共测试 120 个）
- 外部状态排除：TIMEOUT 13 / HTTP_BLOCKED 34 / NETWORK_ERROR 25 / HTTP_SERVER_ERROR 3 / HTTP_NOT_FOUND 11 / CAPTCHA_REQUIRED 1

> 报告不保存第三方正文、Cookie、Token 或完整书源 JSON；SHA-256 仅用于固定样本版本。未执行真机流程的行标记为 not_run，不能计为通过。

| ID | 层次 | 页 | SHA-256（前 12 位） | 下载 | 状态 | Android | 搜/详/目/文 | 流程 | 错误码 | 耗时(ms) |
|---:|---|---:|---|---|---|---|---|---|---|---:|
| 7624 | recent | 1 | d8c23d171ca7 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | TIMEOUT | 1427 |
| 7549 | middle | 2 | da1622caaff4 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | passed |  | 2042 |
| 7619 | recent | 1 | a5340abb6a1a | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 314 |
| 7543 | middle | 2 | 07bee8df8834 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 1424 |
| 7596 | recent | 1 | 6856da567c44 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | passed |  | 1108 |
| 7515 | middle | 2 | b985bcf5c2b8 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | PARSE_EMPTY | 2878 |
| 7583 | recent | 1 | 4f8aed8a1715 | valid_text_json | ready | ✓ | ✓/—/✓/✓ | failed | TIMEOUT | 1678 |
| 7497 | middle | 2 | 6391891efaea | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | PARSE_EMPTY | 2304 |
| 7562 | recent | 1 | 5f41e330376b | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | TIMEOUT | 2315 |
| 7415 | middle | 2 | c0eed0b8614e | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | PARSE_EMPTY | 1538 |
| 7406 | middle | 2 | abcac613997c | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | TOC_EMPTY | 1263 |
| 7400 | middle | 2 | 90d0e8fc0874 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | TIMEOUT | 1806 |
| 7390 | middle | 2 | 1254af3ff34b | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 1222 |
| 7388 | middle | 2 | 60eb8ce3911e | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 1378 |
| 7382 | middle | 2 | d9e46db1de81 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_SERVER_ERROR | 1190 |
| 7259 | middle | 2 | 2ed26bb6fdfa | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 1720 |
| 6979 | middle | 2 | 4e226435e780 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 1106 |
| 7319 | middle | 2 | f62472388e08 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_NOT_FOUND | 1174 |
| 7298 | middle | 2 | 7a1ca5b78613 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | passed |  | 970 |
| 7285 | middle | 2 | ad6daaa3d0e5 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 1007 |
| 7279 | middle | 2 | 8b570738e2fd | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 927 |
| 6931 | middle | 4 | 25bc88871fa6 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | PARSE_EMPTY | 1185 |
| 6928 | middle | 4 | d7cd846fba70 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | passed |  | 872 |
| 6917 | middle | 4 | a6983008d8be | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 1491 |
| 6906 | middle | 4 | 0a4ea9fefbf8 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_NOT_FOUND | 1498 |
| 6897 | middle | 4 | ff57ecce2cca | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 1488 |
| 6896 | middle | 4 | f7e8edb2ab9c | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | CAPTCHA_REQUIRED | 1643 |
| 6890 | middle | 4 | e26b8db86fb1 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 894 |
| 6875 | middle | 4 | 41e8d2447f96 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 836 |
| 6834 | middle | 4 | 6338eba2fc37 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 1084 |
| 6813 | middle | 4 | 51643b495fff | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 1010 |
| 6808 | middle | 4 | 237d90206d6a | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | PARSE_EMPTY | 947 |
| 6792 | middle | 4 | 9edd19c58b86 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 939 |
| 6785 | middle | 4 | c20bf227ef36 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | TIMEOUT | 1130 |
| 6775 | middle | 4 | bf14b1edad7c | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | passed |  | 994 |
| 6774 | middle | 4 | 38e505392fe1 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 993 |
| 6772 | middle | 4 | 2c0a520f31ca | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 748 |
| 6771 | middle | 4 | c634ec839047 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_NOT_FOUND | 748 |
| 6763 | middle | 4 | 4f15fcea24a3 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | PARSE_EMPTY | 923 |
| 6754 | middle | 4 | c603adc92a93 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | TIMEOUT | 1229 |
| 6752 | middle | 4 | b0380eab73e1 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | PARSE_EMPTY | 653 |
| 6750 | middle | 4 | 3cd6ed04e0c6 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_NOT_FOUND | 662 |
| 6689 | middle | 4 | f12792ca2ae3 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 686 |
| 6736 | middle | 4 | 20a6b31df025 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 591 |
| 6715 | middle | 4 | a07485c8f5ad | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_NOT_FOUND | 505 |
| 6714 | middle | 4 | 6904e9dc214b | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_SERVER_ERROR | 460 |
| 6713 | middle | 4 | 74fd3efd97cc | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | PARSE_EMPTY | 236 |
| 6705 | middle | 4 | 981b4bcc968f | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 826 |
| 6697 | middle | 4 | d31ac3dd7270 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 801 |
| 6687 | middle | 4 | 971667e8e4dd | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 722 |
| 6678 | middle | 4 | 092415036f94 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_NOT_FOUND | 512 |
| 6656 | middle | 4 | 53057c7c259b | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_NOT_FOUND | 380 |
| 6645 | middle | 4 | ad1c1027beb8 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | PARSE_EMPTY | 201 |
| 6619 | middle | 5 | 766565b54072 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 261 |
| 6618 | middle | 5 | e06616e24650 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | PARSE_EMPTY | 261 |
| 6612 | middle | 5 | 8032939ed6d3 | valid_text_json | ready | ✓ | ✓/—/✓/✓ | failed | NETWORK_ERROR | 261 |
| 6597 | middle | 5 | 228eec5a3114 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 235 |
| 6491 | middle | 5 | 281d4b9e73b1 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | TIMEOUT | 208 |
| 6557 | middle | 5 | da7490d51efc | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 241 |
| 6543 | middle | 5 | 9afc8a2ee4ab | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | CONTENT_EMPTY | 386 |
| 6540 | middle | 5 | b2769453cb54 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 386 |
| 6535 | middle | 5 | 3a30f00fdab3 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | TIMEOUT | 191 |
| 6534 | middle | 5 | bd5927952b29 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | TIMEOUT | 244 |
| 6530 | middle | 5 | 214c975d95e7 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_NOT_FOUND | 243 |
| 6507 | middle | 5 | 75bf6bac46fb | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 244 |
| 6506 | middle | 5 | 6f7fde0d5304 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | passed |  | 246 |
| 6500 | middle | 5 | 4922620a835b | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | TIMEOUT | 294 |
| 6488 | middle | 5 | 5e4e2de32e94 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_NOT_FOUND | 286 |
| 6453 | middle | 5 | db73423058c0 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 226 |
| 6438 | middle | 5 | e25a028dc269 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | SEARCH_RESULT_INCOMPLETE | 196 |
| 6429 | middle | 5 | bc1a185bdc81 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 268 |
| 6392 | middle | 5 | e5e4144c198b | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | TIMEOUT | 251 |
| 6336 | middle | 6 | 963ad5d74c2c | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_NOT_FOUND | 243 |
| 6326 | middle | 6 | d481ce8b065f | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 227 |
| 6322 | middle | 6 | 591bc789971a | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 260 |
| 6311 | middle | 6 | 17273d0fa726 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | PARSE_EMPTY | 203 |
| 6306 | middle | 6 | 9410e0435aa1 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | PARSE_EMPTY | 224 |
| 6305 | middle | 6 | 1693abb16703 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | PARSE_EMPTY | 235 |
| 6293 | middle | 6 | c4b35d295ead | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 234 |
| 6281 | middle | 6 | f46acb26edd0 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 220 |
| 6265 | middle | 6 | 10091358f4d8 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 267 |
| 6248 | middle | 6 | 4f737fc0f19c | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | PARSE_EMPTY | 246 |
| 6247 | middle | 6 | 4b1a2a823a24 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | PARSE_EMPTY | 252 |
| 6235 | middle | 6 | 1b502daf30a0 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 218 |
| 6240 | middle | 6 | 9cb47c7f783d | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | SEARCH_EMPTY | 216 |
| 6238 | middle | 6 | d6f80ece85aa | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | PARSE_EMPTY | 215 |
| 6187 | middle | 6 | 10f77b1e8189 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | TIMEOUT | 228 |
| 5999 | middle | 8 | 8cb62a5ad38d | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 269 |
| 5998 | middle | 8 | 587c78bf2741 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | PARSE_EMPTY | 267 |
| 3963 | middle | 8 | a585a8ae10d9 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_SERVER_ERROR | 262 |
| 5992 | middle | 8 | d32d3187167a | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | REQUEST_TEMPLATE_UNSUPPORTED | 309 |
| 5985 | middle | 8 | 632519c9734a | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 275 |
| 5957 | middle | 8 | 18efdfd0fca2 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 260 |
| 5950 | middle | 8 | 6213c8739ef0 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_NOT_FOUND | 251 |
| 5939 | middle | 8 | 67891e7ff6c8 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | TIMEOUT | 801 |
| 5934 | middle | 8 | 6a03a35337c3 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 559 |
| 5928 | middle | 8 | 04ec7f9b8584 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 223 |
| 5912 | middle | 8 | d2530dcb4034 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 252 |
| 5918 | middle | 8 | 17af84161e5e | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 217 |
| 5915 | middle | 8 | 347b00a7bb46 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | PARSE_EMPTY | 221 |
| 5911 | middle | 8 | f97a98dc9561 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 231 |
| 5899 | middle | 8 | e9039eaabbe7 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 604 |
| 5897 | middle | 8 | c383e5a74079 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | passed |  | 245 |
| 5895 | middle | 8 | b3f03f92e0a3 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 251 |
| 5893 | middle | 8 | 4b6d28f3781a | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | passed |  | 251 |
| 5892 | middle | 8 | 8f845fce14de | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 247 |
| 5890 | middle | 8 | 7fb93c68d782 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 320 |
| 5889 | middle | 8 | f03186cc092c | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 319 |
| 5852 | middle | 9 | 4b59d43dcfc3 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 974 |
| 5848 | middle | 9 | c030083eaa55 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 990 |
| 5846 | middle | 9 | b7d4f69d7bc8 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 997 |
| 5845 | middle | 9 | 9203c3da565a | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 990 |
| 5843 | middle | 9 | a0427b6e4a4c | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 1107 |
| 5825 | middle | 9 | cdd13680021a | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 1174 |
| 5823 | middle | 9 | 942dab540d38 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | passed |  | 1603 |
| 5816 | middle | 9 | fbe9dfe28de7 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 4672 |
| 5815 | middle | 9 | 2b6ca32693fd | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 5521 |
| 5814 | middle | 9 | 564eb1adc925 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | HTTP_BLOCKED | 1233 |
| 5813 | middle | 9 | 85fe7375257d | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | PARSE_EMPTY | 1164 |
| 5802 | middle | 9 | ebe852a3b1c6 | valid_text_json | ready | ✓ | ✓/✓/✓/✓ | failed | NETWORK_ERROR | 991 |
