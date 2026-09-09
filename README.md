# kingpolymers

React 双螺杆组合设计工作台。前端使用 React + Vite，后端保留 Python + SQLite 的工程校验与数据接口。

## 项目结构

```text
frontend/
  src/
    components/   通用窗口、绘图、图纸表单、机筒编辑
    pages/        设计、方案、元件、库存、设置、登录
    hooks/        设计状态与撤销重做
    domain/       型号解析、尺寸校验、矢量图形、工程报表
    lib/          API 与导入导出
  public/         当前使用的公共资源
backend/
  resources/      元件和方案初始化数据
  server.py       API 与 React 构建产物托管
  web_auth.py     SQLite 账号与会话
  web_handlers.py 登录、Cookie 与 CSRF
  barrel_models.py 机筒尺寸和校验规则
scripts/          本地启动、环境准备、后端测试入口
tests/            React 交互测试与后端验收测试
docs/             云端部署说明
runtime/          本机环境、业务数据库与自动备份（不提交 Git）
```

仅保留当前版本；没有 releases 历史目录、旧前端、旧截图包或旧项目压缩包。

## Windows 一键运行

安装 Python 3.11+ 和 Node.js 22.12+（建议 Node 24 LTS），双击根目录 `start_windows.bat`。

启动器自动准备 `runtime/venv`、安装锁定依赖并构建 React，然后打开 http://127.0.0.1:8731 。首次安装需要联网，后续会复用依赖。关闭窗口或 Ctrl+C 停止服务。

- 本机仅监听 127.0.0.1，不需要云端账号。
- `start_windows.bat --port 8732`：指定端口。
- `start_windows.bat --no-browser`：启动时不自动打开浏览器。
- 当前方案及库存保存在 `runtime/local/data/`；每日和手动备份在 `runtime/local/backups/`。
- 第一次运行优先复制 `runtime/server/data/guangjun_screw.db`；全新克隆使用初始化元件和模板。后续启动保留已编辑数据。

## 前端开发

先启动后端，再开另一个终端运行 Vite：

```powershell
python scripts/run.py --api-only --no-browser
npm ci
npm run dev
```

打开 Vite 输出的 http://127.0.0.1:5173 。API 自动代理到 8731，生产构建使用同源 API。

```powershell
npm run build
npm test
runtime\venv\Scripts\python.exe scripts/test_backend.py
npm run format:check
```

`npm test` 包含 React 交互、撤销重做、机器隔离、打印报表和 CSRF 测试。后端验收使用临时数据库，验证保存、导入导出、备份、登录和前后端尺寸算法一致性。测试不会写入业务数据库。

## 云端

详见 [部署说明](docs/deployment.md)。云端运行 `backend/server.py`，启用登录保护，经 Nginx HTTPS 提供服务。主站以外的独立 `/web/` 服务不在本仓库中。

## 界面与操作

界面采用紧凑单屏布局：顶部标签导航与方案工具栏、工程画布、下方元件库 / 安装顺序 / 机筒配置三栏。桌面三栏分别滚动，拖动画布下方分隔条调整高度，双击复位；聚焦分隔条后可用上下方向键微调。元件库、库存、方案管理均使用单行工具栏与可滚动数据表。

- 组合设计：标准模板起步、机筒内双轴组合示意、拖拽安装顺序与机筒模块（让位动画、插入占位、边缘滚动、Esc 取消）、撤销/重做、实时工程校验。Ctrl+S 保存，Ctrl+Z 撤销，Ctrl+Shift+Z / Ctrl+Y 重做；输入框内保留正常文字编辑快捷键。
- 项目方案：按状态、机型和名称筛选；已发布方案锁定编辑，可创建副本继续设计。
- 元件库：清单与参数侧栏，按需加载可旋转的 3D 示意模型。
- 库存：单件/套数显示、调整后数量预览、出入库记录。作废按实际扣库记录退回。
- 设置：本地访问状态、备份、云端账户密码和机器参数。
- 登录：可交互双螺杆 3D 展示、密码可见性切换、明确错误提示。
- 工程图：分页缩略图导航、缩放、A4 横向打印；支持 PDF、Excel、JSON 和 PNG 工作流。

动画尊重系统“减少动态效果”设置。3D 支持拖动旋转、暂停和复位；页面隐藏或模型离开视野后停止渲染，WebGL 不可用时回退到静态示意。3D 用于外形理解，制造尺寸以工程图纸为准。

设计稿和生成提示词集中在 [UI 设计目录](docs/ui-redesign/index.html)，不参与应用运行。

## 浏览器验收

```powershell
npm test
runtime\venv\Scripts\python.exe scripts/test_backend.py
npm run test:e2e
```

浏览器测试在 Windows 使用已安装的 Microsoft Edge；其他系统先执行 `npx playwright install chromium`。测试自动启动 8740 / 8741 两个临时服务并在完成后关闭，使用独立临时数据库和测试账号。端口占用时直接报错，不复用正式服务。

桌面布局验收覆盖 1366×768 和 1920×1080，检查三栏同屏、独立滚动、工具栏高度与分隔条操作。

截图保存在 `runtime/ui-checks/`，测试结果与失败追踪保存在 `runtime/test-artifacts/`，均不提交 Git。涵盖登录与密码轮换、设计保存与撤销、真实拖拽、导入导出、发布退库、库存调整、网络错误恢复、移动布局、3D 资源回退与帧间隔采样。

3D 使用 [Three.js](https://threejs.org/)；浏览器验收使用 [Playwright](https://playwright.dev/docs/test-webserver)。
