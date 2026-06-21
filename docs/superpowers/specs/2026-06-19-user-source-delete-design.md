# 用户导入书源删除功能设计

## 目标

在书源详情面板提供可发现、可确认的删除入口，方便清理验收书源，同时保护内置源和 API 源不被误删。

## 交互与权限

- 仅当 `selectedSource.importedAt` 存在时，在详情滚动区底部显示“删除此书源”。
- 内置源和 API 源不显示删除按钮，仍可启用或停用。
- 点击删除后复用现有 `confirmRemoveSource(source)` 二次确认，弹窗包含书源名称。
- 用户确认后复用 `deleteUserSource(source.id)`，刷新书源列表并关闭详情面板。
- 删除书源时继续由数据层清理该源的本地设置和 Cookie。

## 实现边界

只修改 `pages/library/library.vue` 的入口、提示和危险操作样式，不增加批量删除、滑动删除或后端删除接口，不改变内置/API 源的数据模型。

## 测试与验收

- 静态契约测试验证删除按钮受 `selectedSource.importedAt` 控制并调用 `confirmRemoveSource(selectedSource)`。
- 现有数据层测试继续验证用户源删除行为。
- 浏览器手动验收：删除一个验收源，确认取消时保留、确认时从列表消失；内置/API 源详情无删除按钮。
