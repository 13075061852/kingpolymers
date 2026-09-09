let csrf = '';
export function setSession(session) {
  csrf = session?.csrf || '';
}
export async function api(path, body, method = body === undefined ? 'GET' : 'POST') {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const json = response.headers.get('content-type')?.includes('application/json');
  const result = json ? await response.json() : await response.blob();
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event('session-expired'));
    const error = new Error(result.error || `请求失败 (${response.status})`);
    error.status = response.status;
    error.details = result;
    throw error;
  }
  return result;
}
export function download(content, name) {
  const url = URL.createObjectURL(content);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}
