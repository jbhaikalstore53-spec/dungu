import {json,getUser} from './_lib.js';
export async function onRequestGet({request,env}){const user=await getUser(request,env);if(!user)return json({error:'Sesi tidak valid atau kedaluwarsa.'},401);return json({user:{id:user.sub,email:user.email,role:user.role}})}
