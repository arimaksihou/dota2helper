const form=document.getElementById('bookingForm');
const note=document.getElementById('formNote');
const date=form.querySelector('[name="date"]');
date.min=new Date().toISOString().split('T')[0];
form.addEventListener('submit',e=>{
  e.preventDefault();
  const data=new FormData(form);
  note.textContent=`Спасибо, ${data.get('name')}! Заявка принята. Мы свяжемся с вами для подтверждения.`;
  note.style.color='#111';
  form.querySelector('button').textContent='Заявка отправлена ✓';
  form.reset();
});
document.querySelector('.menu').addEventListener('click',()=>{
  const nav=document.querySelector('.nav nav');
  nav.style.display=nav.style.display==='flex'?'none':'flex';
  nav.style.position='absolute'; nav.style.top='72px'; nav.style.left='20px'; nav.style.right='20px';
  nav.style.padding='20px'; nav.style.background='#111'; nav.style.flexDirection='column';
});
