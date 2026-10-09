---
inject: 
  - service/agents.md
---

# Top

顶部标题栏

* 左侧：产品标题「产品星球 2.0」
* 右侧：操作区
  * 提交变更 + 文件改动数字
    * 有变更时才 enable
    * hover 数字时能 popover提示被改动的文件树
    * 点击提交时，调用 \<agents > 提交个 commit，让 \<agents> 自己总结改动
  * 当前包含「VSCode打开」按钮
    * 点击后调用 `POST /api/workspace/open-vscode`，服务端使用 `code` CLI 打开当前激活的 workspace 目录