---
inject:
  - service/view-and-diff.md
---
# Home - 右侧

* 获取提示词, + 一个“获取“按钮，点击时使用<view-prompts> 组件
* 如果 markdown 文件且 meta 声明 inject: \["依赖"]，
  * 展示文件依赖列表， 仅显示名称和文件路径，可点击跳转
* 底部有“新增”按钮
  * 点击后出现 文件树选择器，展示 requirements/下的所有文件，
    * 支持前端搜索
    * 支持多选
    * 点击确定后，将所选文件的加入到当前的markdown 里的 meta inject依赖中