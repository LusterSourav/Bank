// jaro-winkler for indian names. swap for cashfree when scaling
function jaroWinkler(s1,s2) {
  if(s1 === s2) return 1;
  const len1=s1.length;
  const len2= s2.length;
  if (len1 === 0 || len2 === 0) return 0;

  const matchWindow=Math.floor(Math.max(len1,len2)/ 2)- 1;
  if(matchWindow < 0)return 0;

  const s1Matches=new Array(len1).fill(false);
  const s2Matches= new Array(len2).fill(false);

  let matches=0;
  let transpositions=0;


  for(let i=0;i < len1;i++){
    const start=Math.max(0, i - matchWindow);

    const end=Math.min(i + matchWindow + 1, len2);
    for (let j=start; j < end;j++) {
      if (s2Matches[j] || s1[i]!== s2[j]) continue;

      s1Matches[i]=true;
      s2Matches[j] =true;
      matches++;
      break;
    }
  }

  if(matches === 0)return 0;

  let k=0;
  for(let i=0;i < len1;i++) {
    if(!s1Matches[i])continue;

    while(!s2Matches[k]) k++;
    if(s1[i]!== s2[k])transpositions++;
    k++;

  }

  const jaro=(matches / len1 + matches / len2 +(matches - transpositions / 2)/ matches)/ 3;

  let prefix=0;
  for(let i= 0;i < Math.min(len1,len2,4); i++){
    if(s1[i]=== s2[i]) prefix++;
    else break;

  }

  return jaro + prefix * 0.1 *(1 - jaro);
}

// normalize indian names — uppercase, strip honorifics, collapse space
const HONORIFICS= /^(MR\.?|MRS\.?|MS\.?|SHRI\.?|DR\.?|SMT\.?|S\/O|D\/O|W\/O)\s+/i;

function normalizeName(name) {

  return name
    .toUpperCase()
    .replace(HONORIFICS, '')
    .replace(/[^A-Z\s]/g,'')
    .replace(/\s+/g,' ')
    .trim();
}

function matchNames(name1,name2) {
  const n1=normalizeName(name1);
  const n2= normalizeName(name2);

  if(n1 === n2)return{score: 1,category: 'Exact Match'};
  if(n1.includes(n2) || n2.includes(n1)){
    return{score: 0.95,category: 'Subset Match'};
  }

  const score=jaroWinkler(n1,n2);

  if(score >= 0.85)return{ score,category: 'Good Partial'};
  if(score >= 0.7) return{ score,category: 'Fair Partial'};

  return{ score,category: 'No Match'};
}

export function crossVerify(aadhaarData,panData) {
  const nameResult =matchNames(aadhaarData.name,panData.name);
  const dobMatch=aadhaarData.dob === panData.dob;

  let recommendation;
  if (nameResult.score >= 0.85 && dobMatch && panData.aadhaarLinked){
    recommendation='APPROVE';
  }else if(nameResult.score >= 0.7 && dobMatch) {
    recommendation='APPROVE_WITH_LOG';
  }else if (nameResult.score >= 0.5 || dobMatch){
    recommendation='MANUAL_REVIEW';
  } else{
    recommendation='REJECT';
  }

  return{
    nameMatch: nameResult,
    dobMatch,
    aadhaarPanLinked: panData.aadhaarLinked,
    recommendation,
  };
}
