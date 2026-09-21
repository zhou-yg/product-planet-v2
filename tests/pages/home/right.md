# Home Right（右侧依赖区）

选中文件时

- 如果文件不是 markdown 文件，不展示依赖列表
- 如果是 markdown 文件但 meta 未声明 inject，不展示依赖列表
- 如果 markdown 文件 meta 声明了 inject: ["依赖"]，展示文件依赖列表

展示依赖列表时

- 仅显示依赖名称和文件路径
- 依赖路径相对于 requirements 目录解析

点击依赖项时

- 跳转到对应的依赖文件
- 文件树中高亮跳转后的文件
- url 同步更新为跳转后的文件路径
