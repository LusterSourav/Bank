//deterministic avatar from name — 8-color palette, simple hash
//  tried gradient avatars, too much work for an initial
const COLORS=[
  '#F7931A', '#58A6FF', '#3FB950', '#D29922',
  '#9B59B6','#E74C3C','#1ABC9C', '#3498DB',
];


export function getInitial(name){
  return name?.charAt(0)?.toUpperCase()|| '?';
}

export function getColor(name){
  let hash = 0;
  for(let i=0; i <(name || '').length;i++){
    hash= name.charCodeAt(i) +((hash << 5)- hash);

  }
  return COLORS[Math.abs(hash) % COLORS.length];
}
