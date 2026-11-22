import {checkOrigin} from '@/lib/briefing.mjs';
import {db} from '@/lib/store';
import {readTours,commandTours,morningTourActions} from '@/lib/zillow-tours.mjs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export async function GET(){
 try{const d=db(),state=await readTours(d),replay=await readTours(d,'replay');return Response.json({serverTime:new Date().toISOString(),state,replay,morningActions:morningTourActions(state)},{headers});}
 catch{return Response.json({error:'Tour state unavailable. Do not infer an empty queue.'},{status:503,headers});}
}
export async function POST(request:Request){
 if(!checkOrigin(request))return Response.json({error:'Cross-origin write denied'},{status:403,headers});
 try{const body=await request.text();if(body.length>40000)throw Error('Command too large');return Response.json(await commandTours(db(),JSON.parse(body)),{headers});}
 catch(e){return Response.json({error:e instanceof Error?e.message:'Read state before retry'},{status:409,headers});}
}
