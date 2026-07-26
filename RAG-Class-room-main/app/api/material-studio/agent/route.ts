import { NextResponse } from "next/server";
import { requireStudent } from "@/lib/auth";
import { callGemini } from "@/lib/teacher-prompts";
import { serverAiEnabledOnServer } from "@/lib/ai-features";
export const runtime="nodejs";
const roles=new Set(["curriculum-planner","material-specialist","visual-specialist","assessment-specialist","qa-grounding","repair-agent","local-specialist"]);
export async function POST(req:Request){
  if (!serverAiEnabledOnServer()) return NextResponse.json({error:"Managed Server AI is temporarily disabled."},{status:503});
  try{
    await requireStudent();
    const {role,system,prompt}=await req.json();
    if(!roles.has(role)||typeof system!=="string"||typeof prompt!=="string") return NextResponse.json({error:"Invalid agent request"},{status:400});
    if(system.length>16000||prompt.length>70000) return NextResponse.json({error:"Agent prompt is too large"},{status:413});
    const text=await callGemini(system,prompt);
    return NextResponse.json({text,role});
  }catch(e:any){
    const message = typeof e?.message === 'string' ? e.message : 'Agent execution failed';
    const isUnauthorized = message.includes("Unauthorized");
    return NextResponse.json({error:message},{status:isUnauthorized?401:500});
  }
}
