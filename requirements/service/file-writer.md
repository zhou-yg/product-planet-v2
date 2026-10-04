# file-writer

文件操作能力，支持文件的读、写、新建、删除、重命名、移动、复制等操作。

使用 next.js api 实现

## 通用约定

- 路径均指当前 workspace 下 requirements/ 内的相对路径，如 `pages/home.md`
- 接口可带 `ws` 指定 workspace 名称，缺省使用当前激活的 workspace
- 校验路径合法：拒绝绝对路径、`..` 越界等，只允许操作 requirements/ 内的文件/文件夹
- 新建 / 重命名 / 移动 / 复制的目标已存在同名时，返回错误
- 统一返回：成功 `{ ok: true }`，失败 `{ ok: false, message }` 并携带合适的 http 状态码

## 接口

- 读文件
  - `GET /api/file/raw?path=xx&ws=xx`
  - 根据路径返回文件内容，文本返回文本，图片/glb 等返回原始二进制
- 写文件
  - `POST /api/file/write`
  - 入参：`{ path, content, ws? }`
  - 根据路径和内容写入，用于覆盖已有文件
  - markdown 文件存在 meta 信息时需要保留
- 新建文件
  - `POST /api/file/create`
  - 入参：`{ dir, name, ws? }`
  - 在 dir 下创建名为 name 的空文件
- 新建文件夹
  - `POST /api/file/mkdir`
  - 入参：`{ dir, name, ws? }`
  - 在 dir 下创建名为 name 的文件夹，name 含 `/` 时一次创建多级
- 删除
  - `POST /api/file/delete`
  - 入参：`{ path, ws? }`
  - 删除文件或文件夹，文件夹连同内部内容一并（递归）删除
- 重命名
  - `POST /api/file/rename`
  - 入参：`{ path, name, ws? }`
  - 将文件/文件夹在原目录下重命名为 name
- 移动
  - `POST /api/file/move`
  - 入参：`{ path, dir, ws? }`
  - 将文件/文件夹移动到 dir 下
- 复制
  - `POST /api/file/copy`
  - 入参：`{ path, dir, ws? }`
  - 将文件/文件夹复制到 dir 下，文件夹递归复制
