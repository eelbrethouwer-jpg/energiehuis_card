function eh20Chart(result,pickedIndex){
 if(!result||!result.points?.length)return '<p class="subtle">Geen betrouwbare uurpunten voor de grafiek.</p>';
 const points=result.points;
 const segments=[];let current=[];
 for(let i=0;i<points.length;i++){
  const p=points[i];
  if(p.soc===null){if(current.length)segments.push(current);current=[];continue;}
  current.push(((i/Math.max(1,points.length-1))*640).toFixed(1)+','+(117-(p.soc/(result.usableCapacity||result.capacity))*100).toFixed(1));
 }
 if(current.length)segments.push(current);
 const lines=segments.map(s=>'<polyline fill="none" stroke="#54e8b7" stroke-width="3" stroke-linejoin="round" points="'+s.join(' ')+'"/>').join('');
 const selected=points[Math.max(0,Math.min(points.length-1,pickedIndex??points.length-1))];
 const marker=selected?.soc!==null?'<circle cx="'+((Math.max(0,Math.min(points.length-1,pickedIndex??points.length-1))/Math.max(1,points.length-1))*640).toFixed(1)+'" cy="'+(117-(selected.soc/(result.usableCapacity||result.capacity))*100).toFixed(1)+'" r="6" fill="#ffcc65" stroke="#fff" stroke-width="2"/>':'';
 return '<svg class="eh20-soc-chart" viewBox="0 0 640 144" role="img" aria-label="Historische berekende batterijvulling per uur, 0 tot '+(result.usableCapacity||result.capacity)+' kWh">'+
  '<line x1="0" y1="117" x2="640" y2="117" stroke="#849cab" stroke-width="1"/>'+
  '<line x1="0" y1="17" x2="640" y2="17" stroke="#849cab" stroke-width="1" stroke-dasharray="5 5"/>'+
  '<text x="3" y="13" fill="#bdd5e4" font-size="11">'+(result.usableCapacity||result.capacity)+' kWh</text>'+
  '<text x="3" y="135" fill="#bdd5e4" font-size="11">0 kWh</text>'+lines+marker+'</svg>';
}

