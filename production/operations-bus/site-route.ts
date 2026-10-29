import {checkOrigin} from '@/lib/briefing.mjs';
import {db} from '@/lib/store';
import {readBus,commandBus} from '@/lib/kickoff-bus.mjs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function GET(){return Response.json({serverTime:new Date().toISOString(),state:await readBus(db())},{headers});}
export async function POST(request:Request){
  if(!checkOrigin(request))return Response.json({error:'Cross-origin write denied'},{status:403,headers});
  try{
    const body=await request.text();if(body.length>40000)throw Error('Command too large');
    return Response.json(await commandBus(db(),JSON.parse(body)),{headers});
  }catch(e){return Response.json({error:e instanceof Error?e.message:'Storage unavailable; read state before retry'},{status:409,headers});}
}
