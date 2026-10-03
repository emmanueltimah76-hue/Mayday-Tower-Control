import type {Point} from '../src/airports.js';
const tau=Math.PI*2,mod=(a:number)=>((a%tau)+tau)%tau;
const length=(a:Point,b:Point)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
// Forward-only circle / tangent / circle paths. Tangents are constructed
// geometrically for each pair of left/right turn circles (no heading reset).
export function poseCurves(from:Point,heading:number,to:Point,endHeading:number,radius:number):Point[][]{
 const h=heading*Math.PI/180,endH=endHeading*Math.PI/180,candidates:{points:Point[];length:number}[]=[];
 for(const s of [-1,1])for(const e of [-1,1]){
  const a:Point=[from[0]+Math.cos(h)*radius*s,from[1]+Math.sin(h)*radius*s],b:Point=[to[0]+Math.cos(endH)*radius*e,to[1]+Math.sin(endH)*radius*e],d=length(a,b);
  if(s!==e&&d<2*radius-.0001)continue;
  const angle=d<.0001?endH-Math.PI/2:Math.atan2(b[1]-a[1],b[0]-a[0])+(s===e?0:Math.asin(Math.max(-1,Math.min(1,2*s*radius/d))));
  const v:Point=[Math.cos(angle),Math.sin(angle)],entry:Point=[a[0]+v[1]*radius*s,a[1]-v[0]*radius*s],exit:Point=[b[0]+v[1]*radius*e,b[1]-v[0]*radius*e];
  const first=s*mod(s*(Math.atan2(entry[1]-a[1],entry[0]-a[0])-Math.atan2(from[1]-a[1],from[0]-a[0]))),last=e*mod(e*(Math.atan2(to[1]-b[1],to[0]-b[0])-Math.atan2(exit[1]-b[1],exit[0]-b[0])));
  const points:Point[]=[[...from]];
  const arc=(center:Point,begin:Point,sweep:number,end:Point)=>{const start=Math.atan2(begin[1]-center[1],begin[0]-center[0]),steps=Math.ceil(Math.abs(sweep)*360/Math.PI);for(let i=1;i<=steps;i++){const ang=start+sweep*i/steps;points.push(i===steps?[...end]:[center[0]+Math.cos(ang)*radius,center[1]+Math.sin(ang)*radius]);}};
  arc(a,from,first,entry);if(length(points.at(-1)!,exit)>.0001)points.push(exit);arc(b,exit,last,to);
  if(length(points.at(-1)!,to)>.0001)points.push(to);candidates.push({points,length:(Math.abs(first)+Math.abs(last))*radius+length(entry,exit)});
 }
 for(const side of [-1,1]){
  const a:Point=[from[0]+Math.cos(h)*radius*side,from[1]+Math.sin(h)*radius*side],b:Point=[to[0]+Math.cos(endH)*radius*side,to[1]+Math.sin(endH)*radius*side],d=length(a,b);if(d<.0001||d>4*radius)continue;
  const midpoint:Point=[(a[0]+b[0])/2,(a[1]+b[1])/2],height=Math.sqrt(Math.max(0,4*radius*radius-d*d/4));
  for(const branch of [-1,1]){const middle:Point=[midpoint[0]-(b[1]-a[1])/d*height*branch,midpoint[1]+(b[0]-a[0])/d*height*branch],entry:Point=[(a[0]+middle[0])/2,(a[1]+middle[1])/2],exit:Point=[(b[0]+middle[0])/2,(b[1]+middle[1])/2],points:Point[]=[[...from]];let total=0;
   for(const [center,begin,end,turn]of [[a,from,entry,side],[middle,entry,exit,-side],[b,exit,to,side]] as [Point,Point,Point,number][]){const start=Math.atan2(begin[1]-center[1],begin[0]-center[0]),sweep=turn*mod(turn*(Math.atan2(end[1]-center[1],end[0]-center[0])-start)),steps=Math.ceil(Math.abs(sweep)*360/Math.PI);total+=Math.abs(sweep)*radius;for(let i=1;i<=steps;i++){const ang=start+sweep*i/steps;points.push(i===steps?[...end]:[center[0]+Math.cos(ang)*radius,center[1]+Math.sin(ang)*radius]);}}
   candidates.push({points,length:total});
  }
 }
 return candidates.sort((a,b)=>a.length-b.length).map(c=>c.points);
}
export function smoothCorners(points:Point[]){for(let i=1;i<points.length-1;i++){const a=points[i-1],b=points[i],c=points[i+1],ab=length(a,b),bc=length(b,c);if(ab<.0001||bc<.0001)continue;const angle=Math.acos(Math.max(-1,Math.min(1,((b[0]-a[0])*(c[0]-b[0])+(b[1]-a[1])*(c[1]-b[1]))/(ab*bc))));if(angle>Math.PI/180)return false;}return true;}
