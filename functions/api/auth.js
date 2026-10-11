import {json,normEmail,passwordValid,passwordHash,passwordCheck,sha256,signToken,sendOtp,logAction,rateLimit} from './_lib.js';
export async function onRequestPost({request,env}) {
  const db=env.DB;if(!db)return json({error:'Database belum dihubungkan.'},503);
  let body;try{body=await request.json()}catch{return json({error:'Format permintaan tidak valid.'},400)}
  const action=String(body.action||''),email=normEmail(body.email),password=body.password,ip=request.headers.get('CF-Connecting-IP')||'unknown';
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return json({error:'Email tidak valid.'},400);
  if(!await rateLimit(db,`${action}:${ip}`,action==='login'?15:5,600000))return json({error:'Terlalu banyak percobaan. Coba lagi beberapa menit.'},429);
  try {
    if(action==='register'){
      if(!passwordValid(password))return json({error:'Password minimal 10 karakter.'},400);
      if(await db.prepare('SELECT id FROM users WHERE email=?').bind(email).first())return json({error:'Email sudah terdaftar. Silakan login.'},409);
      if(!env.RESEND_API_KEY||!env.MAIL_FROM)return json({error:'Email OTP belum dikonfigurasi di pengaturan backend.'},503);
      const otp=String(crypto.getRandomValues(new Uint32Array(1))[0]%900000+100000),pwh=await passwordHash(password),now=Date.now();
      await db.prepare('INSERT INTO otp_codes(email,code_hash,expires_at,attempts,password_hash,created_at) VALUES(?,?,?,0,?,?) ON CONFLICT(email) DO UPDATE SET code_hash=excluded.code_hash,expires_at=excluded.expires_at,attempts=0,password_hash=excluded.password_hash,created_at=excluded.created_at').bind(email,await sha256(`${email}:${otp}:${env.OTP_PEPPER||env.JWT_SECRET}`),now+600000,pwh,now).run();
      try{await sendOtp(env,email,otp)}catch(e){await db.prepare('DELETE FROM otp_codes WHERE email=?').bind(email).run();return json({error:e.message},503)}
      return json({ok:true,requiresCode:true,message:'Kode verifikasi dikirim. Periksa inbox dan spam.'});
    }
    if(action==='verify'){
      if(!/^\d{6}$/.test(String(body.code||'')))return json({error:'Masukkan kode 6 digit.'},400);
      const row=await db.prepare('SELECT * FROM otp_codes WHERE email=?').bind(email).first();if(!row||row.expires_at<Date.now()||row.attempts>=5)return json({error:'Kode kedaluwarsa atau tidak tersedia. Daftar ulang.'},400);
      if(await sha256(`${email}:${body.code}:${env.OTP_PEPPER||env.JWT_SECRET}`)!==row.code_hash){await db.prepare('UPDATE otp_codes SET attempts=attempts+1 WHERE email=?').bind(email).run();return json({error:'Kode verifikasi salah.'},400)}
      if(await db.prepare('SELECT id FROM users WHERE email=?').bind(email).first()){await db.prepare('DELETE FROM otp_codes WHERE email=?').bind(email).run();return json({error:'Email sudah terdaftar. Silakan login.'},409)}
      const owner=normEmail(env.OWNER_EMAIL),role=owner&&email===owner?'owner':'user';const ins=await db.prepare('INSERT INTO users(email,password_hash,role,verified) VALUES(?,?,?,1)').bind(email,row.password_hash,role).run();await db.prepare('DELETE FROM otp_codes WHERE email=?').bind(email).run();const user={id:ins.meta.last_row_id,email,role};await logAction(db,email,'Account registered');return json({ok:true,token:await signToken(user,env),user},201);
    }
    if(action==='login'){
      if(!passwordValid(password))return json({error:'Email atau password salah.'},401);const user=await db.prepare('SELECT id,email,password_hash,role,verified FROM users WHERE email=?').bind(email).first();if(!user||!user.verified||!(await passwordCheck(password,user.password_hash)))return json({error:'Email atau password salah.'},401);await logAction(db,email,'Login');const safe={id:user.id,email:user.email,role:user.role};return json({ok:true,token:await signToken(safe,env),user:safe});
    }
    return json({error:'Aksi tidak dikenal.'},400);
  }catch(e){console.error('auth error',e);return json({error:'Kesalahan backend. Periksa binding database dan secrets.'},500)}
}
