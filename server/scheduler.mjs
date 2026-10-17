export const intervals=[1,3,7,14,30,60,120];
export function schedule(content,rating,now=new Date()) {
 if(!['forgot','partial','remembered'].includes(rating)) throw new Error('Resposta inválida.');
 const step=rating==='forgot'?0:rating==='partial'?Math.max(0,content.step-1):Math.min(content.step+(content.reviews>0?1:0),6);
 const interval=intervals[step];
 return {step,interval,next_review:new Date(now.getTime()+interval*86400000).toISOString()};
}
export function priority(c,now=Date.now()) {return (Date.parse(c.next_review)<=now?100:0)+Math.max(0,(now-Date.parse(c.next_review))/86400000)*5+c.errors*8+(c.analysis?.difficulty||2)*3+(c.reviews===0?25:0);}
