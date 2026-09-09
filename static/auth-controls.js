(async function(){
 'use strict';
 const form=document.querySelector('#passwordForm'),info=document.querySelector('#loginAccount'),out=document.querySelector('#passwordMessage'),logout=document.querySelector('#logoutBtn');
 try{
  const session=await fetch('/api/auth/session',{cache:'no-store'}).then(r=>r.json());
  if(!session.enabled){info.textContent='本机服务未启用登录保护；云端使用独立登录密码。';return}
  if(!session.authenticated){location.replace('/login');return}
  info.textContent='当前账号：'+session.username;form.hidden=logout.hidden=false;
  const post=async(path,body)=>{const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':session.csrf},body:JSON.stringify(body)}),x=await r.json();if(!r.ok)throw Error(x.error||'操作失败');return x};
  form.onsubmit=async e=>{e.preventDefault();out.textContent='';if(form.new_password.value!==form.confirm_password.value){out.textContent='两次输入的新密码不一致';return}const button=form.querySelector('button');button.disabled=true;try{await post('/api/auth/password',{old_password:form.old_password.value,new_password:form.new_password.value});form.reset();location.replace('/login')}catch(e){out.textContent=e.message}finally{button.disabled=false}};
  logout.onclick=async()=>{if(!confirm('退出登录？请先保存尚未保存的组合。'))return;try{await post('/api/auth/logout',{});location.replace('/login')}catch(e){out.textContent=e.message}};
 }catch(e){info.textContent='登录状态读取失败，请刷新页面。'}
})();
