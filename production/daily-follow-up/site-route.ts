import {checkOrigin} from '@/lib/briefing.mjs';
import {db} from '@/lib/store';
import {readFollowUp,commandFollowUp} from '@/lib/daily-follow-up.mjs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
// Existing owner-private Sites policy protects this shared agent store.
export async function GET(){return Response.json({serverTime:new Date().toISOString(),state:await readFollowUp(db())},{headers});}
export async function POST(request:Request){
  if(!checkOrigin(request))return Response.json({error:'Cross-origin write denied'},{status:403,headers});
  try{const body=await request.text();if(body.length>100000)throw Error('Command too large');return Response.json(await commandFollowUp(db(),JSON.parse(body)),{headers});}
  catch(e){return Response.json({error:e instanceof Error?e.message:'Storage unavailable; read before retry'},{status:409,headers});}
}
