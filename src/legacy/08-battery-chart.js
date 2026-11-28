function eh20Chart(result,pickedIndex){
 if(!result||!result.points?.length)return '<p class="subtle">Geen betrouwbare uurpunten voor de grafiek.</p>';
 const points=result.points,cap=result.usableCapacity||result.capacity;
 // Gedeelde grafiekbouwer: assen (0, gemiddeld, vol), tikbare bubbel per uur; gaten blijven grijs.
 const known=points.filter(p=>p.soc!==null),avg=known.length?known.reduce((a,p)=>a+p.soc,0)/known.length:0;
 const fmt=v=>ehFmt(v,1)+' kWh',long=t=>new Date(t).toLocaleString('nl-NL',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).replace(/\./g,'');
 const items=points.map((p,i)=>p.soc===null?{i,miss:true,tip:{time:long(p.t),main:'Geen betrouwbare meting',sub:''}}:{i,v:p.soc,cls:'ehqt-mid',tip:{time:long(p.t),main:fmt(p.soc),sub:Math.round(p.soc/cap*100)+'% van '+ehFmt(cap,0)+' kWh'}});
 return ehQtDrawChart({key:'soc'+points[0].t+points.length,n:points.length,first:0,items,lo:0,hi:cap,avg,fmt,hiName:'vol',nowMs:-1,xEvery:Math.max(1,Math.ceil(points.length/6)),xlabel:i=>new Date(points[i].t).toLocaleDateString('nl-NL',{day:'numeric',month:'short'}).replace('.',''),hint:'Tik op een uur voor de vulling',label:'Historische berekende batterijvulling per uur, 0 tot '+cap+' kWh, gemiddeld '+fmt(avg)});
}

