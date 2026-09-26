# View and Diff

入参是
- 某个文件路径 

返回
- markdown 文本内容，组成如下 
  - 文件相对路径，相对于 requirements/
  - 文件内容 (含 meta 信息) 及其 inject 的内容
  - 获取到文件内容如果还有 inject，则需要继续的**递归** inject 对应的文件内容
  - 修改 diff， 只取涉及的文件的 diff

内容的排列顺序
- 每个文件的修改 diff， 使用 <diff content="文件路径"></diff> 标签包裹
- 间隔线，提示“以下为完整内容“
- 文件内容
- 依赖inject的内容，每个依赖内容使用 <inject content="文件路径"></inject> 标签包裹


注意事项：
- 只获取纯文本内容，不获取图片等非文本形式的内容