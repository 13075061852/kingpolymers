'use strict';
if(location.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(location.hostname))location.replace('https://kingpolymer.com/login');
const form=document.querySelector('#loginForm'),error=document.querySelector('#loginError'),button=document.querySelector('#loginSubmit');
document.querySelector('#showPassword').onchange=e=>document.querySelector('#password').type=e.target.checked?'text':'password';
form.onsubmit=async e=>{e.preventDefault();error.textContent='';button.disabled=true;try{const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:form.username.value.trim(),password:form.password.value})}),x=await r.json();if(!r.ok)throw Error(x.error||'登录失败');location.replace('/')}catch(e){error.textContent=e.message}finally{button.disabled=false}};
