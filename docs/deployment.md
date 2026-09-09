# 云端部署

前端为 React + Vite，后端为 Python + SQLite。云端继续使用 Nginx HTTPS 反向代理。

## 安装与构建

```bash
npm ci
npm run build
python3 -m venv runtime/venv
runtime/venv/bin/python -m pip install -r backend/requirements-lock.txt
```

构建产物在 `frontend/dist/`，Python 自动托管该目录。构建产物与本机依赖不提交 Git。

## 配置后端

```bash
export GJ_HOST=127.0.0.1
export GJ_PORT=8731
export GJ_DATA_DIR=/var/lib/kingpolymers/data
export GJ_BACKUP_DIR=/var/lib/kingpolymers/backups
export GJ_AUTH_REQUIRED=1
# 首次创建登录数据库时，通过受保护的环境文件配置：
# GJ_AUTH_USER=<管理员账号>
# GJ_AUTH_PASSWORD=<至少10位的独立密码>
runtime/venv/bin/python -u backend/server.py
```

使用 systemd 管理进程，WorkingDirectory 指向项目根目录，ExecStart 使用上面的 Python 和 backend/server.py 绝对路径。登录数据库已存在时沿用其中的账号，启动环境不会覆盖密码。

Nginx 将 `/` 转发到 `http://127.0.0.1:8731`，传递 `Host`、`X-Real-IP` 和 `X-Forwarded-Proto`。Python 负责登录页面、React 静态资源及 `/api`。前端开发时，Vite 将 `/api` 代理至同一端口。

不要在云端运行 `scripts/start_local.py`：它是专门的本机免登录入口。服务器使用 `backend/server.py` 和 `GJ_AUTH_REQUIRED=1`，缺少登录数据库及初始化凭据时会拒绝启动。

## 数据迁移

本地编辑使用 `runtime/local/data/guangjun_screw.db`。迁移到云端前先停止写入，用 SQLite backup 接口导出一致的业务数据库，再放到云端数据目录。保留云端独立的 `web_auth.db`，不要以本地免登录状态替代。

原服务器复制来的当前数据库保存在 `runtime/server/data/`，只作本机数据迁移来源，不上传 Git。当前本地方案位于 `runtime/local/data/`，不会被重新初始化覆盖。不要复制运行中的裸 `.db` 文件并漏掉 WAL；不要直接覆盖正在使用的数据目录。

每次发布先执行构建和测试，再重启服务。原域名的 `/web/` 是另一个独立项目，不在此仓库内。
