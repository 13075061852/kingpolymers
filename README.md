# kingpolymers

kingpolymer 双螺杆组合设计软件，包含元件库、机筒配置、方案管理、库存与工程图导入导出。当前界面版本 v1.28。

## Windows 启动

安装 Python 3.11 或更高版本，双击 `start_windows.bat`。首次启动自动创建 `.venv` 并安装固定版本依赖，然后打开 http://127.0.0.1:8731 。

本地仅监听 127.0.0.1，不需要云端账号。再次双击会打开已运行的同一项目。端口被其他程序占用时，可执行 `start_windows.bat --port 8732`。

本地数据位于 `runtime/local/data/`，备份位于 `runtime/local/backups/`；两者不会上传到 Git。首次运行优先复制本机 `data/guangjun_screw.db`，全新克隆时使用已提交的 `data/seed.json` 初始化元件与模板库。

## 验证

```powershell
.\.venv\Scripts\python.exe test_windows_runtime.py
.\.venv\Scripts\python.exe test_web_auth.py
```

验收测试使用临时数据库，覆盖保存与读取、PDF/Excel 导入、Excel 导出、备份、登录与权限校验。

## 后续云端部署

Linux 与 Windows 共用后端和静态资源。云端使用 `server.py`，通过环境变量配置数据路径和登录保护，在 Nginx HTTPS 后运行。详见 [WINDOWS使用说明.md](WINDOWS使用说明.md)。

本仓库只包含主站 Python 项目；原域名 `/web/` 的独立 Node 服务不在此仓库中。
