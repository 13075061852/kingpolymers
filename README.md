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
