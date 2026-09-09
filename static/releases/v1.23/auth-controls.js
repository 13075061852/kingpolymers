(async function(){
 'use strict';
 const form=document.querySelector('#passwordForm'),info=document.querySelector('#loginAccount'),out=document.querySelector('#passwordMessage'),logout=document.querySelector('#logoutBtn'),quickLogout=document.querySelector('#quickLogoutBtn'),quickPassword=document.querySelector('#quickPasswordBtn'),account=document.querySelector('#quickAccountName');
 quickPassword.onclick=()=>{switchView('settings');document.querySelector('#loginSettings').scrollIntoView({block:'start'});if(!form.hidden)form.elements.old_password.focus({preventScroll:true})};
 const error=e=>{out.textContent=e.message;if(typeof toast==='function')toast(e.message,true)};
 try{
  const response=await fetch('/api/auth/session',{cache:'no-store'});if(!response.ok)throw Error('无法读取登录状态');const session=await response.json();
  if(!session.enabled){info.textContent='本机服务未启用登录保护；云端使用独立登录密码。';account.textContent='本机免登录';return}
  if(!session.authenticated){location.replace('/login');return}
  info.textContent='当前账号：'+session.username;account.textContent=session.username;account.title='当前登录账号：'+session.username;form.hidden=logout.hidden=quickLogout.hidden=false;
  const post=async(path,body)=>{const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':session.csrf},body:JSON.stringify(body)}),x=await r.json();if(!r.ok)throw Error(x.error||'操作失败');return x};
  form.onsubmit=async e=>{e.preventDefault();out.textContent='';if(form.new_password.value!==form.confirm_password.value){out.textContent='两次输入的新密码不一致';return}const button=form.querySelector('button');button.disabled=true;try{await post('/api/auth/password',{old_password:form.old_password.value,new_password:form.new_password.value});form.reset();location.replace('/login')}catch(e){error(e)}finally{button.disabled=false}};
  const signOut=async()=>{if(!confirm('退出登录？请先保存尚未保存的组合。'))return;logout.disabled=quickLogout.disabled=true;try{await post('/api/auth/logout',{});location.replace('/login')}catch(e){error(e)}finally{logout.disabled=quickLogout.disabled=false}};
  logout.onclick=quickLogout.onclick=signOut;
 }catch(e){info.textContent='登录状态读取失败，请刷新页面。';account.textContent='登录状态未读取'}
})();
