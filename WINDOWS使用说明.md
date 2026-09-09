# Windows 本地运行

双击 `start_windows.bat`，等待启动成功，浏览器会自动打开 http://127.0.0.1:8731 。使用 Chrome 或 Edge；不要直接双击 static/index.html。

首次启动需要 Python 3.11 或更高版本以及网络，用于创建独立 `.venv` 和安装 PDF/Excel 组件。当前电脑已配置好环境，后续直接双击即可。关闭启动窗口或按 Ctrl+C 停止服务。

`requirements-lock.txt` 固定了本次验证使用的依赖版本，可用于重新安装或云端部署时复现环境。

本机版本不需要云端登录密码，只接受本机访问。编辑、保存、库存操作只更新本地副本，不会同步到线上。负责人确认码仍沿用项目原来的规则。

## 文件与数据

- `server.py`、`web_auth.py`、`web_handlers.py`：Windows/Linux 共用后端。
- `static/`：完整前端和 v1.28 页面资源。
- `data/`：从服务器复制的原始数据及初始化模板。
- `runtime/local/data/guangjun_screw.db`：首次运行通过 SQLite 备份接口复制出的本地业务数据库；再次启动保留编辑结果。
- `runtime/local/backups/`：本地每日备份及手动备份。
- `.venv/`：Windows 专用 Python 环境。
- `.local-backups/`：原服务器完整压缩包，仅保存在本机，不上传 GitHub。
- `server-config/`：原服务器配置存档，含部署敏感信息，不纳入源码提交。

重复双击会打开已运行的同一项目。如果 8731 被其他程序占用，在此目录终端执行 `start_windows.bat --port 8732`。`--no-browser` 可关闭自动打开浏览器。

## 后续云端部署

云端继续运行 `server.py`，不要运行本地入口 `start_local.py`。本次没有重新部署线上系统。

1. 上传源码、完整 `static/` 和 `data/seed.json`，在 Linux 创建新虚拟环境并运行 `python -m pip install -r requirements.txt`。不要上传 Windows `.venv` 或旧 Linux `venv`。
2. 用 `GJ_DATA_DIR` 指定云端数据目录，`GJ_BACKUP_DIR` 指定备份目录。默认沿用项目的 `data` 和 `backups`。若要迁移本地编辑成果，停止本地服务后使用 SQLite backup 接口导出业务数据库，再放入云端数据目录；不要覆盖仍在运行的数据库。
3. 设置 `GJ_HOST=127.0.0.1`、`GJ_PORT=8731`、`GJ_AUTH_REQUIRED=1`。首次初始化账号时通过受保护的服务环境文件设置 `GJ_AUTH_USER` 与至少 10 位的 `GJ_AUTH_PASSWORD`。已有 `web_auth.db` 时继续使用其中的账号。不要把真实密码写入源码。
4. 使用 systemd 管理进程，Nginx HTTPS 反向代理到 127.0.0.1:8731，并传递 Host、X-Real-IP 和 X-Forwarded-Proto。`server-config` 可作为原服务器配置参考。
5. 部署前验证登录、项目保存、PDF/Excel 导入、Excel 导出和备份。域名 `/web/` 对应的独立 Node 项目不包含在此目录。
