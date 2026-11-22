import {checkOrigin} from '@/lib/briefing.mjs';
import {db} from '@/lib/store';
import {readPerformance,savePerformance} from '@/lib/zillow-performance.mjs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export async function GET(){try{return Response.json(await readPerformance(db()),{headers});}catch{return Response.json({error:'Zillow assessment unavailable; this is not zero activity.'},{status:503,headers});}}
export async function POST(request:Request){
 if(!checkOrigin(request))return Response.json({error:'Cross-origin write denied'},{status:403,headers});
 try{const body=await request.text();if(body.length>350000)throw Error('Assessment too large');return Response.json(await savePerformance(db(),JSON.parse(body)),{headers});}
 catch(e){return Response.json({error:e instanceof Error?e.message:'Read current report before retrying'},{status:409,headers});}
}
