import {checkOrigin} from '@/lib/briefing.mjs';
import {db} from '@/lib/store';
import {readPostShowing,commandPostShowing,openPostShowing} from '@/lib/post-showing.mjs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export async function GET(){
  try {const d=db(),state=await readPostShowing(d),replay=await readPostShowing(d,'replay');return Response.json({serverTime:new Date().toISOString(),state,replay,openActions:openPostShowing(state),replayActions:openPostShowing(replay)},{headers});}
  catch{return Response.json({error:'Post-showing receipts unavailable. Do not infer no promises.'},{status:503,headers});}
}
export async function POST(request:Request){
  if(!checkOrigin(request))return Response.json({error:'Cross-origin write denied'},{status:403,headers});
  try {const body=await request.text();if(body.length>80000)throw Error('Command too large');return Response.json(await commandPostShowing(db(),JSON.parse(body)),{headers});}
  catch(e){return Response.json({error:e instanceof Error?e.message:'Read state before retry'},{status:409,headers});}
}
