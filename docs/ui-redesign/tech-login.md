# 科技风登录页

## 页面与渲染

- 页面：`frontend/src/pages/Login.jsx`，样式：`frontend/src/login.css`。
- 依据用户提供的参考图重做深蓝工业环境、左侧标题与功能卡、斜置金属螺杆、悬浮说明板、右侧发光登录面板及地球弧面。
- 螺杆由 `frontend/src/lib/heroScene.js` 在 Three.js 中程序化建模，无需 Blender 或外部模型下载。包括双头螺旋叶片、倒角轴套、法兰、紧固件、错列捏合盘和花键。
- 展示模型用于登录页视觉，不参与工程计算，也不是可用于制造的尺寸模型。
- 螺杆沿自身轴线旋转；独立光环、扫描环、蓝色侧光和加法混合炫光随时间变化。
- 同材质静态金属几何合并，约 66,270 个三角形、31 次绘制调用。桌面像素比上限 1.5，窄画布上限 1.25；持续慢帧时降低像素比。
- 使用 IntersectionObserver / visibilitychange 停止屏外或后台动画；尊重 prefers-reduced-motion；退出页面释放几何体、材质、纹理、观察器与 WebGL 渲染器。
- 参考了 [Three.js WebGLRenderer 文档](https://threejs.org/docs/pages/WebGLRenderer.html)。炫光采用局部加法混合精灵，未使用全屏 bloom 后处理。

## 可用功能

登录请求、错误提示、密码显隐与退出登录保留。记住账号仅保存用户名，不保存密码、不改变后端会话有效期。忘记密码按钮展开现有管理员重置途径。统计区展示实际支持的机型、3D、本地草稿和导出能力，不使用参考图中未经证实的运营数字。

## 验证

- 16 项前端测试通过。
- Playwright 云端模式登录、错误凭据、密码修改、退出登录测试通过。
- 1672×941、1366×768、820×1180、390×844 四种尺寸无横向溢出，动画按钮可操作。
- 本机 Windows Edge headless 各连续采样 240 个 rAF 间隔，中位数约 10 ms，P95 约 10.1 ms，未采样到超过 33.4 ms 的帧。此为本机环境结果，并非所有设备的性能保证。
- 暂停后两次画布截图一致；减少动态偏好下画布保持静止。
- 禁用 WebGL 后静态回退可见，表单仍可用。
- 登录素材位于公开 `/assets/` 路径，未登录也能加载，不扩大业务接口权限。

## 图像素材与生成记录

使用内置 image_gen 工具。生成的背景与地球图仅作底图；网页文字、表单与螺杆不是烘焙在背景中的图片。最终发布文件为 WebP，由原图仅进行格式编码转换，不缩小原图尺寸：

- `frontend/public/assets/login/industrial-stage.webp`：工业背景，约 107 KB。
- `frontend/public/assets/login/earth-night.webp`：地球光效，约 317 KB。
- `frontend/public/assets/login/screw-fallback.webp`：当前 Three.js 模型静态渲染，约 100 KB；非 AI 生成模型图。

原始 PNG 副本留在不随应用发布的 `runtime/tech-login-sources/`；内置工具原件保留于 Codex generated_images 目录。

### 背景最终提示词

Use case: precise-object-edit. Asset type: background-only plate for a working interactive web login screen. Input image is the exact style/composition reference. Produce a high quality wide 16:9 cinematic industrial background preserving the reference's dark midnight navy metallic machine-room lighting, cobalt/cyan lights, out-of-focus screw machinery at extreme edges, atmospheric depth and large chrome concentric glowing platform in the bottom center-right. CRITICAL: Remove ALL text, logos, UI, login card, feature cards, stats, annotations, holographic panels and the ENTIRE large central diagonal screw assembly. The central area must be empty dark space for a separate real-time 3D model to be rendered on top later; the left center must be quiet very dark navy for white headline, and right must be quiet very dark blue for separate live login form. Keep only the atmospheric environment and a low chrome stage at bottom between 35% and 85% image width, cropped by lower frame, with thin electric blue cyan ring lights. Similar perspective and premium photorealistic machined materials as the reference, restrained cinematic bloom, no purple. No central floating objects, no legible text, no panels or graphic overlays, no watermark. Size 2048x1152.

### 地球最终提示词

Use case: stylized-concept. Asset: photorealistic background texture inside the bottom of a dark-blue futuristic industrial login panel. Produce only planet Earth from low orbit at NIGHT, cinematic realistic premium render. Wide 3:2 composition. Large curved Earth limb rises from bottom left about 80% down to upper right about 30% down, filling lower half of image. Continents and cities are illuminated with tiny dense brilliant electric cobalt blue lights, dark nearly black land and oceans, thin radiant blue atmospheric rim, faint soft atmospheric glow. Earth detail sharp and realistic, tiny glowing scattered city clusters and faint connected networks, not a wireframe sphere, not a graphic diagram. Upper half is quiet smooth deep midnight navy #041020, no stars, no clouds of smoke. The image will be feather-masked at its upper edge and laid into a glass sci-fi blue panel. No text, no UI, no logo, no border, no annotations. Palette: black navy, steel blue, electric blue and cyan highlights only. Size 1536x1024.
