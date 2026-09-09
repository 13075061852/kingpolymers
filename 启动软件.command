#!/bin/bash
cd "$(dirname "$0")"
clear
echo "正在启动：广俊双螺杆组合设计软件……"
if ! python3 -c "import fitz, openpyxl" >/dev/null 2>&1; then
  echo "正在安装PDF/Excel功能组件（首次运行需要网络）……"
  python3 -m pip install --user -r requirements.txt || echo "组件安装失败，核心设计功能仍可使用。"
fi
python3 server.py &
SERVER_PID=$!
sleep 2
open "http://127.0.0.1:8731"
echo ""
echo "软件运行中。请不要关闭本窗口。"
echo "停止软件：按 Control+C。"
trap 'kill $SERVER_PID 2>/dev/null; exit' INT TERM EXIT
wait $SERVER_PID
